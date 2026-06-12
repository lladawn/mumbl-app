import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../../src/server/auth";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { patternId: rawPatternId } = await params;
    const patternId = cleanString(rawPatternId, 64);
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;
    if (!patternId) return badRequest("pattern id is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    if (!owner.userId) return badRequest("login is required");

    const confirmed = body.confirmed === true;
    const dismissed = body.confirmed === false;
    const { data, error } = await supabase
      .from("patterns")
      .update({
        user_confirmed: confirmed ? true : null,
        user_dismissed: dismissed ? true : null,
      })
      .eq("id", patternId)
      .eq("user_id", owner.userId)
      .select("id, user_confirmed, user_dismissed")
      .single();
    if (error?.code === "PGRST116") return badRequest("pattern not found");
    if (isMissingTableError(error)) return serverError(missingPatternMigrationError());
    if (error) throw error;
    return ok({ pattern: data });
  } catch (error) {
    return serverError(error);
  }
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function missingPatternMigrationError() {
  const error = new Error("Pattern graph migration is not applied yet. Run supabase/migrations/0026_pattern_graph.sql.");
  error.status = 503;
  return error;
}
