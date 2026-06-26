import { badRequest, ok, serverError } from "../../../../src/server/http";
import { resolveRequestOwner } from "../../../../src/server/auth";
import { resolveCreatorAccess } from "../../../../src/server/creatorAccess";
import { decryptContentFields, encryptContentFields, withoutEncryptedPayload } from "../../../../src/server/encryption";
import { hashToken } from "../../../../src/server/hash";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

const AUTHOR_EDIT_TYPES = new Set(["find", "thought", "rant", "win", "lol"]);

export async function PATCH(request, { params }) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const content = cleanString(body.content, 420);
    const editToken = cleanString(body.editToken, 256);
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!postId) return badRequest("post id is required");
    if (!content) return badRequest("post content is required");

    const supabase = getSupabaseAdmin();
    const post = await getPostForMutation(supabase, postId);
    if (!AUTHOR_EDIT_TYPES.has(post.type)) return badRequest("team reads are edited from your dump.");
    const owner = await resolveRequestOwner({ request, sessionToken });
    await assertPostEditAccess({ supabase, postId: post.id, editToken, owner });

    const { data: updatedPost, error } = await supabase
      .from("posts")
      .update({
        encrypted_payload: {
          ...(post.encrypted_payload || {}),
          ...encryptContentFields("posts", { content }),
        },
      })
      .eq("id", post.id)
      .select("*")
      .single();
    if (error) throw error;

    return ok({ post: withoutEncryptedPayload(decryptContentFields("posts", updatedPost, ["content", "display_name", "field_note_title"])) });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const editToken = cleanString(body.editToken, 256);
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!postId) return badRequest("post id is required");

    const supabase = getSupabaseAdmin();
    const post = await getPostForMutation(supabase, postId);
    const owner = await resolveRequestOwner({ request, sessionToken });
    const canDeleteAsAuthor = await hasPostDeleteAccess({ supabase, post, editToken, owner });
    const canDeleteAsCreator = post.type !== "field_note" && await canCreatorDeletePost({ request, body, post });
    if (!canDeleteAsAuthor && !canDeleteAsCreator) return badRequest("post edit token or creator access is required");

    if (post.type === "field_note") {
      const { error: unlinkError } = await supabase
        .from("field_notes")
        .update({
          team_room_id: null,
          is_published: false,
          published_post_id: null,
          published_at: null,
          is_public: false,
          public_profile_id: null,
          public_published_at: null,
        })
        .eq("published_post_id", post.id);
      if (unlinkError) throw unlinkError;
    }

    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) throw error;

    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}

async function getPostForMutation(supabase, postId) {
  const { data: post, error } = await supabase
    .from("posts")
    .select("id,space_id,type,encrypted_payload,spaces(id,creator_token_hash,creator_user_id)")
    .eq("id", postId)
    .single();
  if (error?.code === "PGRST116") {
    const notFoundError = new Error("post not found");
    notFoundError.status = 404;
    throw notFoundError;
  }
  if (error) throw error;
  return post;
}

async function assertPostEditAccess({ supabase, postId, editToken, owner }) {
  if (!(await hasPostEditAccess({ supabase, postId, editToken, owner }))) {
    const error = new Error("post edit token did not match");
    error.status = 400;
    throw error;
  }
}

async function hasPostEditAccess({ supabase, postId, editToken, owner }) {
  if (editToken && (await hasPostEditToken(supabase, postId, editToken, owner))) return true;
  if (!owner.userId) return false;
  return hasPostEditOwner(supabase, postId, owner.userId);
}

async function hasPostDeleteAccess({ supabase, post, editToken, owner }) {
  if (await hasPostEditAccess({ supabase, postId: post.id, editToken, owner })) return true;
  if (post.type !== "field_note") return false;
  return hasPublishedFieldNoteOwner(supabase, post.id, owner);
}

async function hasPublishedFieldNoteOwner(supabase, postId, owner) {
  if (!owner.userId && !owner.sessionTokenHash) return false;
  let query = supabase
    .from("field_notes")
    .select("id")
    .eq("published_post_id", postId)
    .limit(1);
  query = owner.userId ? query.eq("user_id", owner.userId) : query.eq("session_token_hash", owner.sessionTokenHash);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function hasPostEditToken(supabase, postId, editToken, owner) {
  const { data, error } = await supabase
    .from("post_edit_tokens")
    .select("post_id,owner_user_id")
    .eq("post_id", postId)
    .eq("edit_token_hash", hashToken(editToken))
    .maybeSingle();
  if (isMissingPostEditTokensTable(error)) {
    const migrationError = new Error("Post edit-token migration is not applied yet. Run supabase/migrations/0024_post_edit_tokens.sql.");
    migrationError.status = 503;
    throw migrationError;
  }
  if (error) throw error;
  if (!data?.post_id) return false;
  if (!data.owner_user_id) return true;
  return owner.userId === data.owner_user_id;
}

async function hasPostEditOwner(supabase, postId, userId) {
  const { data, error } = await supabase
    .from("post_edit_tokens")
    .select("post_id")
    .eq("post_id", postId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (isMissingPostEditTokensTable(error)) {
    const migrationError = new Error("Post edit-token migration is not applied yet. Run supabase/migrations/0024_post_edit_tokens.sql.");
    migrationError.status = 503;
    throw migrationError;
  }
  if (error) throw error;
  return Boolean(data?.post_id);
}

async function canCreatorDeletePost({ request, body, post }) {
  const space = Array.isArray(post.spaces) ? post.spaces[0] : post.spaces;
  const access = await resolveCreatorAccess({ request, body, space: space || {} });
  return access.canManage;
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
