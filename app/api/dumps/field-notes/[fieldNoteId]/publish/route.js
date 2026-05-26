import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { enforceRateLimit } from "../../../../../../src/server/rateLimit";
import { hashToken } from "../../../../../../src/server/hash";
import { serializeFieldNote } from "../../../../../../src/server/dumps";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";
import { cleanString } from "../../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { fieldNoteId } = await params;
    const body = await request.json();
    const slug = cleanString(body.slug, 64);
    const sessionToken = cleanString(body.sessionToken, 256);
    const title = cleanString(body.title, 120);
    const content = cleanString(body.content, 4000);
    const isAnonymous = body.isAnonymous !== false;
    const displayName = isAnonymous ? null : cleanString(body.displayName, 48) || "someone brave";

    if (!fieldNoteId) return badRequest("field note id is required");
    if (!slug) return badRequest("space slug is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!title) return badRequest("field note title is required");
    if (!content) return badRequest("field note content is required");

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "post", sessionToken });
    const sessionTokenHash = hashToken(sessionToken);

    const [{ data: fieldNote, error: noteError }, { data: space, error: spaceError }] = await Promise.all([
      supabase.from("field_notes").select("*").eq("id", fieldNoteId).eq("session_token_hash", sessionTokenHash).single(),
      supabase.from("spaces").select("id").eq("slug", slug).single(),
    ]);
    if (noteError?.code === "PGRST116") return notFound("field note not found");
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (noteError) throw noteError;
    if (spaceError) throw spaceError;
    if (fieldNote.is_published) return badRequest("field note is already published");

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        space_id: space.id,
        type: "field_note",
        field_note_title: title,
        content,
        is_anonymous: isAnonymous,
        display_name: displayName,
      })
      .select()
      .single();
    if (postError) throw postError;

    const { data: updatedNote, error: updateError } = await supabase
      .from("field_notes")
      .update({
        team_room_id: space.id,
        title,
        content,
        is_published: true,
        published_post_id: post.id,
        published_at: new Date().toISOString(),
      })
      .eq("id", fieldNote.id)
      .eq("session_token_hash", sessionTokenHash)
      .select("*")
      .single();
    if (updateError) throw updateError;

    if (isAnonymous) {
      await supabase.from("anon_audit").insert({
        post_id: post.id,
        session_token_hash: sessionTokenHash,
      });
    }

    await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);

    return ok({ fieldNote: serializeFieldNote(updatedNote), post });
  } catch (error) {
    return serverError(error);
  }
}
