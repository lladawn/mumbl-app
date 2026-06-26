import { badRequest, ok, serverError } from "../../../src/server/http";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, ownerInsertFields, ownerMatches, resolveRequestOwner } from "../../../src/server/auth";
import { encryptContentFields } from "../../../src/server/encryption";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";
import { isValidHandle, normalizeHandle, serializePublicProfile } from "../../../src/server/publicProfiles";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(request.headers.get("x-session-token"), 256);
    const expectsAuthenticatedOwner = url.searchParams.get("expectsAuthenticatedOwner") === "true";
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: profile, error } = await applyOwnerFilter(supabase.from("public_profiles").select("*"), owner)
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
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!sessionToken) return badRequest("session token is required");
    if (!isValidHandle(handle)) return badRequest("choose a handle with 2-30 letters, numbers, underscores, or dashes");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: existingForHandle, error: handleError } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("handle", handle)
      .maybeSingle();
    if (isMissingTableError(handleError)) return serverError(missingPublicProfileMigrationError());
    if (handleError) throw handleError;
    if (existingForHandle && !ownerMatches(existingForHandle, owner)) {
      return badRequest("that handle is already taken");
    }

    let { data: existingForSession, error: sessionError } = await applyOwnerFilter(supabase.from("public_profiles").select("*"), owner)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!existingForSession && existingForHandle && ownerMatches(existingForHandle, owner)) {
      existingForSession = existingForHandle;
    }

    const mutation = existingForSession
      ? supabase
          .from("public_profiles")
          .update({
            handle,
            encrypted_payload: encryptContentFields("public_profiles", {
              display_name: displayName || handle,
              bio,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingForSession.id)
      : supabase
          .from("public_profiles")
          .insert({
            ...ownerInsertFields(owner),
            handle,
            encrypted_payload: encryptContentFields("public_profiles", {
              display_name: displayName || handle,
              bio,
            }),
          });

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
