import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../src/server/auth";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { createToken, hashToken } from "../../../../../src/server/hash";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString, isValidPostType } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const type = cleanString(body.type, 24);
    const content = cleanString(body.content, type === "dump" || type === "field_note" ? 4000 : 420);
    const isAnonymous = body.isAnonymous !== false;
    const displayName = isAnonymous ? null : cleanString(body.displayName, 48) || "someone brave";
    const sessionToken = cleanString(body.sessionToken, 256);
    const promptId = cleanString(body.promptId, 64) || null;
    const dumpId = cleanString(body.dumpId, 64) || null;
    const fieldNoteTitle = type === "field_note" ? cleanString(body.title, 120) : null;

    if (!slug) return badRequest("space slug is required");
    if (!isValidPostType(type)) return badRequest("unsupported post type");
    if (type === "dump") return badRequest("raw dumps stay private. publish a field note to team reads instead.");
    if (!content) return badRequest("post content is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    await enforceRateLimit({ supabase, action: "post", sessionToken: owner.userId ? `auth-post:${owner.userId}` : sessionToken });

    const { data: space, error: spaceError } = await supabase.from("spaces").select("id").eq("slug", slug).single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const editToken = createToken();
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        space_id: space.id,
        prompt_id: promptId,
        dump_id: dumpId,
        field_note_title: fieldNoteTitle,
        type,
        content,
        is_anonymous: isAnonymous,
        display_name: displayName,
      })
      .select()
      .single();
    if (postError) throw postError;

    const { error: tokenError } = await supabase.from("post_edit_tokens").insert({
      post_id: post.id,
      edit_token_hash: hashToken(editToken),
      owner_user_id: owner.userId || null,
    });
    if (tokenError) {
      await supabase.from("posts").delete().eq("id", post.id);
      if (isMissingPostEditTokensTable(tokenError)) return serverError(missingPostEditTokensMigrationError());
      throw tokenError;
    }

    if (isAnonymous && sessionToken) {
      await supabase.from("anon_audit").insert({
        post_id: post.id,
        session_token_hash: hashToken(sessionToken),
      });
    }

    const { error: updateError } = await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);
    if (updateError) throw updateError;

    return ok({ post, editToken });
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

function missingPostEditTokensMigrationError() {
  const error = new Error("Post edit-token migration is not applied yet. Run supabase/migrations/0024_post_edit_tokens.sql.");
  error.status = 503;
  return error;
}
