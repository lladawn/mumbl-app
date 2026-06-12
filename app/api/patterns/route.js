import { badRequest, ok, serverError } from "../../../src/server/http";
import { assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../src/server/auth";
import { getServerEnv } from "../../../src/server/env";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    const expectsAuthenticatedOwner = url.searchParams.get("expectsAuthenticatedOwner") === "true";
    const includeDismissed = url.searchParams.get("includeDismissed") === "true";
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const testToolsEnabled = getServerEnv().patternGraphTestToolsEnabled;
    if (!owner.userId) return ok({ patterns: [], testToolsEnabled });

    let query = supabase
      .from("patterns")
      .select("id, summary, question, period_start, period_end, user_confirmed, user_dismissed, delivered_slack, delivered_at, triggered_at_count, created_at")
      .eq("user_id", owner.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!includeDismissed) query = query.or("user_dismissed.is.null,user_dismissed.eq.false");

    const { data, error } = await query;
    if (isMissingTableError(error)) return serverError(missingPatternMigrationError());
    if (error) throw error;
    return ok({ patterns: data || [], testToolsEnabled });
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
