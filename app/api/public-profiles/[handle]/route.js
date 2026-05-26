import { notFound, ok, serverError } from "../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { normalizeHandle, serializePublicProfile } from "../../../../src/server/publicProfiles";

export async function GET(_request, { params }) {
  try {
    const { handle: rawHandle } = await params;
    const handle = normalizeHandle(rawHandle);
    if (!handle) return notFound("public profile not found");

    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase.from("public_profiles").select("*").eq("handle", handle).single();
    if (error?.code === "PGRST116") return notFound("public profile not found");
    if (isMissingTableError(error)) return notFound("public profile not found");
    if (error) throw error;

    const { data: fieldNotes, error: notesError } = await supabase
      .from("field_notes")
      .select("id, title, content, created_at, public_published_at")
      .eq("public_profile_id", profile.id)
      .eq("is_public", true)
      .eq("is_published", true)
      .order("public_published_at", { ascending: false })
      .limit(40);
    if (isMissingTableError(notesError) || isMissingColumnError(notesError)) return notFound("public profile not found");
    if (notesError) throw notesError;

    return ok({ profile: serializePublicProfile(profile, fieldNotes || []) });
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
