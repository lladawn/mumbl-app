import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { hashToken } from "../../../../src/server/hash";
import { getOrCreateKnownPublicRoom } from "../../../../src/server/demoRoom";
import { getTopReactionLabels, startOfTodayIso } from "../../../../src/server/roomVibe";
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
    const sessionToken = url.searchParams.get("sessionToken");
    const sessionTokenHash = sessionToken ? hashToken(sessionToken) : null;
    const postLimit = parsePostLimit(url.searchParams.get("limit"));
    const postCursor = parsePostCursor(url.searchParams.get("before"));
    const postType = parsePostType(url.searchParams.get("type"));
    const supabase = getSupabaseAdmin();

    let { data: space, error: spaceError } = await supabase.from("spaces").select("*").eq("slug", slug).single();
    if (spaceError?.code === "PGRST116") {
      space = await getOrCreateKnownPublicRoom(supabase, slug);
      if (!space) return notFound("space not found");
      spaceError = null;
    }
    if (spaceError) throw spaceError;

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
    const [reactionsResult, activeReactionsResult, heartbeatsResult, todayReactionsResult] = await Promise.all([
      postIds.length
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length && sessionTokenHash
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds).eq("session_token_hash", sessionTokenHash)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("heartbeats").select("*").eq("space_id", space.id).order("week_of", { ascending: false }),
      todayPostIdsPromise.then(({ data, error }) => {
        if (error) return { data: [], error };
        const todayPostIds = (data || []).map((post) => post.id);
        return todayPostIds.length
          ? supabase.from("reactions").select("label,created_at").in("post_id", todayPostIds).gte("created_at", startOfTodayIso())
          : Promise.resolve({ data: [], error: null });
      }),
    ]);

    if (reactionsResult.error) throw reactionsResult.error;
    if (activeReactionsResult.error) throw activeReactionsResult.error;
    if (heartbeatsResult.error) throw heartbeatsResult.error;
    if (todayReactionsResult.error) throw todayReactionsResult.error;

    return ok({
      space: serializeSpace(
        space,
        posts,
        heartbeatsResult.data,
        summariseReactions(reactionsResult.data),
        activeReactionsResult.data,
        {
          roomVibe: getTopReactionLabels(todayReactionsResult.data),
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
    const creatorToken = cleanString(body.creatorToken, 256);
    const updates = {};

    if (Object.hasOwn(body, "isPublic")) {
      const isPublic = body.isPublic === true;
      updates.is_public = isPublic;
      updates.public_name = isPublic ? cleanString(body.publicName, 80) || null : null;
    }

    if (Object.hasOwn(body, "description")) {
      updates.description = cleanString(body.description, 180) || null;
    }

    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");
    if (!Object.keys(updates).length) return badRequest("no space settings to update");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,creator_token_hash")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    if (space.creator_token_hash !== hashToken(creatorToken)) {
      return badRequest("creator token did not match");
    }

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
