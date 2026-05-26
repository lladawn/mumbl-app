import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { hashToken } from "../../../../../../src/server/hash";
import { serializeFieldNote } from "../../../../../../src/server/dumps";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";
import { cleanString } from "../../../../../../src/server/validation";
import { normalizeHandle, serializePublicProfile } from "../../../../../../src/server/publicProfiles";

export async function PATCH(request, { params }) {
  try {
    const { fieldNoteId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const isPublic = body.isPublic === true;
    const handle = normalizeHandle(body.handle);

    if (!fieldNoteId) return badRequest("field note id is required");
    if (!sessionToken) return badRequest("session token is required");
    if (isPublic && !handle) return badRequest("choose a public handle first");

    const supabase = getSupabaseAdmin();
    const sessionTokenHash = hashToken(sessionToken);
    const { data: fieldNote, error: noteError } = await supabase
      .from("field_notes")
      .select("*")
      .eq("id", fieldNoteId)
      .eq("session_token_hash", sessionTokenHash)
      .single();
    if (noteError?.code === "PGRST116") return notFound("field note not found");
    if (isMissingColumnError(noteError) || isMissingTableError(noteError)) return serverError(missingPublicProfileMigrationError());
    if (noteError) throw noteError;
    if (isPublic && !fieldNote.is_published) return badRequest("publish to team reads before putting this on your profile");

    let profile = null;
    if (isPublic) {
      const { data: profileRow, error: profileError } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("session_token_hash", sessionTokenHash)
        .eq("handle", handle)
        .single();
      if (profileError?.code === "PGRST116") return badRequest("create that public handle first");
      if (isMissingTableError(profileError)) return serverError(missingPublicProfileMigrationError());
      if (profileError) throw profileError;
      profile = profileRow;
    }

    const updates = isPublic
      ? {
          is_public: true,
          public_profile_id: profile.id,
          public_published_at: fieldNote.public_published_at || new Date().toISOString(),
        }
      : {
          is_public: false,
          public_profile_id: null,
          public_published_at: null,
        };

    const { data: updatedNote, error: updateError } = await supabase
      .from("field_notes")
      .update(updates)
      .eq("id", fieldNote.id)
      .eq("session_token_hash", sessionTokenHash)
      .select("*")
      .single();
    if (isMissingColumnError(updateError)) return serverError(missingPublicProfileMigrationError());
    if (updateError) throw updateError;

    return ok({
      fieldNote: serializeFieldNote(updatedNote),
      profile: profile ? serializePublicProfile(profile) : null,
    });
  } catch (error) {
    return serverError(error);
  }
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || error?.code === "PGRST204" || (message.includes("could not find") && message.includes("column"));
}

function missingPublicProfileMigrationError() {
  const error = new Error("Public profile migration is not applied yet. Run supabase/migrations/0015_public_profiles.sql.");
  error.status = 503;
  return error;
}
