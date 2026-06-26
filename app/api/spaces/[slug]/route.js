import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { resolveRequestOwner } from "../../../../src/server/auth";
import { claimCreatorAccess, resolveCreatorAccess } from "../../../../src/server/creatorAccess";
import { encryptContentFields } from "../../../../src/server/encryption";
import { hashToken } from "../../../../src/server/hash";
import { getOrCreateKnownPublicRoom } from "../../../../src/server/demoRoom";
import { getTopReactionLabels, startOfTodayIso } from "../../../../src/server/roomVibe";
import { assertRoomAccess, cleanRoomAccessToken, saveRoomAccessForUser } from "../../../../src/server/roomAccess";
import { serializeSpace, summariseReactions } from "../../../../src/server/serializers";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 40;
const POST_TYPES = new Set(["find", "thought", "rant", "win", "lol", "dump", "field_note"]);

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("space slug is required");

    const url = new URL(request.url);
    const sessionToken = cleanString(request.headers.get("x-session-token"), 256);
    const owner = await resolveRequestOwner({ request, sessionToken });
    const sessionTokenHash = sessionToken ? hashToken(sessionToken) : null;
    const reactionIdentityHash = owner.userId ? hashToken(`auth-reaction:${owner.userId}`) : sessionTokenHash;
    const postLimit = parsePostLimit(url.searchParams.get("limit"));
    const postCursor = parsePostCursor(url.searchParams.get("before"));
    const postType = parsePostType(url.searchParams.get("type"));
    const accessToken = cleanRoomAccessToken(url.searchParams.get("key") || url.searchParams.get("accessToken"));
    const supabase = getSupabaseAdmin();

    let { data: space, error: spaceError } = await supabase.from("spaces").select("*").eq("slug", slug).single();
    if (spaceError?.code === "PGRST116") {
      space = await getOrCreateKnownPublicRoom(supabase, slug);
      if (!space) return notFound("space not found");
      spaceError = null;
    }
    if (spaceError) throw spaceError;
    await assertRoomAccess({ supabase, space, accessToken, owner });
    await saveRoomAccessForUser({ supabase, owner, space, accessToken });

    let postsQuery = supabase
      .from("posts")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false })
      .limit(postLimit + 1);
    let postCountQuery = supabase.from("posts").select("id", { count: "exact", head: true }).eq("space_id", space.id);

    if (postType === "reads") {
      postsQuery = postsQuery.eq("type", "field_note");
      postCountQuery = postCountQuery.eq("type", "field_note");
    } else if (postType) {
      postsQuery = postsQuery.eq("type", postType);
      postCountQuery = postCountQuery.eq("type", postType);
    }
    if (postCursor) postsQuery = postsQuery.lt("created_at", postCursor);

    const [{ data: postRows, error: postsError }, { error: postCountError, count: postCount }] = await Promise.all([
      postsQuery,
      postCountQuery,
    ]);
    if (postsError) throw postsError;
    if (postCountError) throw postCountError;

    const posts = (postRows || []).slice(0, postLimit);
    const hasMorePosts = (postRows || []).length > postLimit;
    const lastPost = posts.at(-1);
    const postIds = posts.map((post) => post.id);
    const todayPostIdsPromise = supabase
      .from("posts")
      .select("id")
      .eq("space_id", space.id)
      .gte("created_at", startOfTodayIso());
    const [
      reactionsResult,
      activeReactionsResult,
      accountEditablePostsResult,
      localEditablePostsResult,
      heartbeatsResult,
      todayReactionsResult,
      slackTeamReadsResult,
    ] = await Promise.all([
      postIds.length
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length && reactionIdentityHash
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds).eq("session_token_hash", reactionIdentityHash)
        : Promise.resolve({ data: [], error: null }),
      postIds.length && owner.userId
        ? supabase.from("post_edit_tokens").select("post_id").in("post_id", postIds).eq("owner_user_id", owner.userId)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from("post_edit_tokens").select("post_id").in("post_id", postIds).is("owner_user_id", null)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("heartbeats").select("*").eq("space_id", space.id).order("week_of", { ascending: false }),
      todayPostIdsPromise.then(({ data, error }) => {
        if (error) return { data: [], error };
        const todayPostIds = (data || []).map((post) => post.id);
        return todayPostIds.length
          ? supabase.from("reactions").select("label,created_at").in("post_id", todayPostIds).gte("created_at", startOfTodayIso())
          : Promise.resolve({ data: [], error: null });
      }),
      supabase.from("slack_space_channels").select("*").eq("space_id", space.id).maybeSingle(),
    ]);

    if (reactionsResult.error) throw reactionsResult.error;
    if (activeReactionsResult.error) throw activeReactionsResult.error;
    if (accountEditablePostsResult.error && !isMissingPostEditTokensTable(accountEditablePostsResult.error)) throw accountEditablePostsResult.error;
    if (localEditablePostsResult.error && !isMissingPostEditTokensTable(localEditablePostsResult.error)) throw localEditablePostsResult.error;
    if (heartbeatsResult.error) throw heartbeatsResult.error;
    if (todayReactionsResult.error) throw todayReactionsResult.error;
    if (slackTeamReadsResult.error && !isMissingSlackTeamReadsTable(slackTeamReadsResult.error)) throw slackTeamReadsResult.error;

    return ok({
      space: serializeSpace(
        space,
        posts,
        heartbeatsResult.data,
        summariseReactions(reactionsResult.data),
        activeReactionsResult.data,
        {
          roomVibe: getTopReactionLabels(todayReactionsResult.data),
          slackTeamReads: slackTeamReadsResult.error ? null : slackTeamReadsResult.data,
          canManage: Boolean(owner.userId && space.creator_user_id === owner.userId),
          accountEditablePostIds: new Set((accountEditablePostsResult.error ? [] : accountEditablePostsResult.data || []).map((row) => row.post_id)),
          localEditablePostIds: new Set((localEditablePostsResult.error ? [] : localEditablePostsResult.data || []).map((row) => row.post_id)),
          postsPage: {
            limit: postLimit,
            count: postCount || 0,
            hasMore: hasMorePosts,
            nextCursor: hasMorePosts && lastPost ? lastPost.created_at : "",
            type: postType || "",
          },
        },
      ),
    });
  } catch (error) {
    return serverError(error);
  }
}

function isMissingPostEditTokensTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("post_edit_tokens") ||
    message.includes("owner_user_id")
  );
}

function isMissingSlackTeamReadsTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("slack_space_channels");
}

function parsePostLimit(value) {
  const limit = Number.parseInt(value || "", 10);
  if (!Number.isFinite(limit)) return DEFAULT_POST_LIMIT;
  return Math.min(Math.max(limit, 1), MAX_POST_LIMIT);
}

function parsePostCursor(value) {
  if (!value) return "";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "";
  return timestamp.toISOString();
}

function parsePostType(value) {
  if (value === "reads") return "reads";
  return POST_TYPES.has(value) ? value : "";
}

export async function PATCH(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const updates = {};

    if (Object.hasOwn(body, "isPublic")) {
      const isPublic = body.isPublic === true;
      updates.is_public = isPublic;
    }

    if (Object.hasOwn(body, "description")) {
      updates.description_changed = true;
    }

    if (!slug) return badRequest("space slug is required");
    if (!Object.keys(updates).length) return badRequest("no space settings to update");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,creator_token_hash,creator_user_id,encrypted_payload")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const access = await resolveCreatorAccess({ request, body, space });
    if (!access.canManage) {
      return badRequest("creator token did not match");
    }
    if (access.shouldClaim) await claimCreatorAccess({ supabase, spaceId: space.id, userId: access.owner.userId });

    const encryptedFields = {};
    if (Object.hasOwn(body, "isPublic")) encryptedFields.public_name = body.isPublic === true ? cleanString(body.publicName, 80) || null : null;
    if (Object.hasOwn(body, "description")) encryptedFields.description = cleanString(body.description, 180) || null;
    if (Object.keys(encryptedFields).length) {
      updates.encrypted_payload = {
        ...(space.encrypted_payload || {}),
        ...encryptContentFields("spaces", encryptedFields),
      };
    }
    delete updates.description_changed;

    const { data: updatedSpace, error: updateError } = await supabase
      .from("spaces")
      .update(updates)
      .eq("id", space.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return ok({ space: serializeSpace(updatedSpace) });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();

    if (!slug) return badRequest("space slug is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,slug,creator_token_hash,creator_user_id")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const access = await resolveCreatorAccess({ request, body, space });
    if (!access.canManage) return badRequest("creator token did not match");
    if (access.shouldClaim) await claimCreatorAccess({ supabase, spaceId: space.id, userId: access.owner.userId });

    const { error: unlinkError } = await supabase
      .from("field_notes")
      .update({
        team_room_id: null,
        published_post_id: null,
      })
      .eq("team_room_id", space.id);
    if (unlinkError) throw unlinkError;

    const { error: deleteError } = await supabase.from("spaces").delete().eq("id", space.id);
    if (deleteError) throw deleteError;

    return ok({ deleted: true, slug: space.slug });
  } catch (error) {
    return serverError(error);
  }
}
