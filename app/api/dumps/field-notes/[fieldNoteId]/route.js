import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../../src/server/auth";
import { serializeFieldNote } from "../../../../../src/server/dumps";
import { encryptContentFields } from "../../../../../src/server/encryption";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function PATCH(request, { params }) {
  try {
    const { fieldNoteId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const title = cleanString(body.title, 120);
    const content = cleanString(body.content, 4000);
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!fieldNoteId) return badRequest("field note id is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!title) return badRequest("field note title is required");
    if (!content) return badRequest("field note content is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: fieldNote, error: noteError } = await applyOwnerFilter(
      supabase.from("field_notes").select("*").eq("id", fieldNoteId),
      owner,
    ).single();
    if (noteError?.code === "PGRST116") return notFound("field note not found");
    if (noteError) throw noteError;

    const updates = {
      encrypted_payload: encryptContentFields("field_notes", { title, content }),
    };
    const { data: updatedNote, error: updateError } = await supabase
      .from("field_notes")
      .update(updates)
      .eq("id", fieldNote.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    if (fieldNote.is_published && fieldNote.published_post_id) {
      const { data: publishedPost, error: publishedPostError } = await supabase
        .from("posts")
        .select("id,encrypted_payload")
        .eq("id", fieldNote.published_post_id)
        .single();
      if (publishedPostError) throw publishedPostError;
      const { error: postError } = await supabase
        .from("posts")
        .update({
          encrypted_payload: {
            ...(publishedPost.encrypted_payload || {}),
            ...encryptContentFields("posts", {
              field_note_title: title,
              content,
            }),
          },
        })
        .eq("id", fieldNote.published_post_id);
      if (postError) throw postError;
    }

    return ok({ fieldNote: serializeFieldNote(updatedNote) });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { fieldNoteId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!fieldNoteId) return badRequest("field note id is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: fieldNote, error: noteError } = await applyOwnerFilter(
      supabase.from("field_notes").select("*").eq("id", fieldNoteId),
      owner,
    ).single();
    if (noteError?.code === "PGRST116") return notFound("field note not found");
    if (noteError) throw noteError;

    if (fieldNote.published_post_id) {
      const { error: postError } = await supabase.from("posts").delete().eq("id", fieldNote.published_post_id);
      if (postError) throw postError;
    }

    const { error: deleteError } = await supabase
      .from("field_notes")
      .delete()
      .eq("id", fieldNote.id);
    if (deleteError) throw deleteError;

    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
