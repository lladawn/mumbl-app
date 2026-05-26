import { badRequest, ok, serverError } from "../../../src/server/http";
import { hashToken } from "../../../src/server/hash";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";
import { isValidHandle, normalizeHandle, serializePublicProfile } from "../../../src/server/publicProfiles";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const sessionTokenHash = hashToken(sessionToken);
    const { data: profile, error } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("session_token_hash", sessionTokenHash)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) {
      return ok({ profile: null, migrationRequired: true });
    }
    if (error) throw error;

    return ok({ profile: profile ? serializePublicProfile(profile) : null });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const handle = normalizeHandle(body.handle);
    const displayName = cleanString(body.displayName || handle, 80);
    const bio = cleanString(body.bio, 220);

    if (!sessionToken) return badRequest("session token is required");
    if (!isValidHandle(handle)) return badRequest("choose a handle with 2-30 letters, numbers, underscores, or dashes");

    const supabase = getSupabaseAdmin();
    const sessionTokenHash = hashToken(sessionToken);
    const { data: existingForHandle, error: handleError } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("handle", handle)
      .maybeSingle();
    if (isMissingTableError(handleError)) return serverError(missingPublicProfileMigrationError());
    if (handleError) throw handleError;
    if (existingForHandle && existingForHandle.session_token_hash !== sessionTokenHash) {
      return badRequest("that handle is already taken");
    }

    const { data: existingForSession, error: sessionError } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("session_token_hash", sessionTokenHash)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (sessionError) throw sessionError;

    const mutation = existingForSession
      ? supabase
          .from("public_profiles")
          .update({ handle, display_name: displayName || handle, bio, updated_at: new Date().toISOString() })
          .eq("id", existingForSession.id)
      : supabase
          .from("public_profiles")
          .insert({ session_token_hash: sessionTokenHash, handle, display_name: displayName || handle, bio });

    const { data: profile, error } = await mutation.select("*").single();
    if (error?.code === "23505") return badRequest("that handle is already taken");
    if (error) throw error;

    return ok({ profile: serializePublicProfile(profile) });
  } catch (error) {
    return serverError(error);
  }
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function missingPublicProfileMigrationError() {
  const error = new Error("Public profile migration is not applied yet. Run supabase/migrations/0015_public_profiles.sql.");
  error.status = 503;
  return error;
}
