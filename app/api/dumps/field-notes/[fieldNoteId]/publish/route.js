import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { enforceRateLimit } from "../../../../../../src/server/rateLimit";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../../../src/server/auth";
import { serializeFieldNote } from "../../../../../../src/server/dumps";
import { decryptContentFields, encryptContentFields, withoutEncryptedPayload } from "../../../../../../src/server/encryption";
import { assertRoomAccess, cleanRoomAccessToken, saveRoomAccessForUser } from "../../../../../../src/server/roomAccess";
import { postTeamReadToSlack, recordSlackTeamReadFailure } from "../../../../../../src/server/slack";
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
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;
    const accessToken = cleanRoomAccessToken(body.accessToken);

    if (!fieldNoteId) return badRequest("field note id is required");
    if (!slug) return badRequest("space slug is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!title) return badRequest("field note title is required");
    if (!content) return badRequest("field note content is required");

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "post", sessionToken });
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);

    const [{ data: fieldNote, error: noteError }, { data: space, error: spaceError }] = await Promise.all([
      applyOwnerFilter(supabase.from("field_notes").select("*").eq("id", fieldNoteId), owner).single(),
      supabase.from("spaces").select("id,slug,encrypted_payload,read_token_hash,is_public,creator_user_id").eq("slug", slug).single(),
    ]);
    if (noteError?.code === "PGRST116") return notFound("field note not found");
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (noteError) throw noteError;
    if (spaceError) throw spaceError;
    await assertRoomAccess({ supabase, space, accessToken, owner });
    await saveRoomAccessForUser({ supabase, owner, space, accessToken });
    if (fieldNote.is_published) return badRequest("field note is already published");
    const readableSpace = decryptContentFields("spaces", space, ["name", "description", "public_name"]);

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        space_id: space.id,
        type: "field_note",
        is_anonymous: isAnonymous,
        encrypted_payload: encryptContentFields("posts", {
          field_note_title: title,
          content,
          display_name: displayName,
        }),
      })
      .select()
      .single();
    if (postError) throw postError;

    const { data: updatedNote, error: updateError } = await supabase
      .from("field_notes")
      .update({
        team_room_id: space.id,
        encrypted_payload: encryptContentFields("field_notes", { title, content }),
        is_published: true,
        published_post_id: post.id,
        published_at: new Date().toISOString(),
      })
      .eq("id", fieldNote.id)
      .select("*")
      .single();
    if (updateError) {
      await supabase.from("posts").delete().eq("id", post.id);
      throw updateError;
    }

    if (isAnonymous) {
      await supabase.from("anon_audit").insert({
        post_id: post.id,
        session_token_hash: owner.sessionTokenHash,
      });
    }

    await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);

    try {
      await postTeamReadToSlack({ space: readableSpace, post: decryptContentFields("posts", post, ["content", "display_name", "field_note_title"]) });
    } catch (slackError) {
      await recordSlackTeamReadFailure({ spaceId: space.id, error: slackError });
    }

    return ok({
      fieldNote: serializeFieldNote(updatedNote),
      post: withoutEncryptedPayload(decryptContentFields("posts", post, ["content", "display_name", "field_note_title"])),
    });
  } catch (error) {
    return serverError(error);
  }
}
