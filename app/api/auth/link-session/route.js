import { badRequest, ok, serverError } from "../../../../src/server/http";
import { resolveRequestOwner } from "../../../../src/server/auth";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    if (!sessionToken) return badRequest("session token is required");

    const owner = await resolveRequestOwner({ request, sessionToken });
    if (!owner.userId) return badRequest("login is required");

    const supabase = getSupabaseAdmin();
    const updates = await Promise.all([
      linkTable({ supabase, table: "dumps", owner }),
      linkTable({ supabase, table: "field_notes", owner }),
      linkTable({ supabase, table: "public_profiles", owner, tolerateMissing: true }),
      linkTable({ supabase, table: "dump_insights", owner, tolerateMissing: true }),
    ]);

    return ok({
      linked: true,
      dumps: updates[0],
      fieldNotes: updates[1],
      publicProfiles: updates[2],
      dumpInsights: updates[3],
    });
  } catch (error) {
    return serverError(error);
  }
}

async function linkTable({ supabase, table, owner, tolerateMissing = false }) {
  const { count, error } = await supabase
    .from(table)
    .update({ user_id: owner.userId }, { count: "exact" })
    .eq("session_token_hash", owner.sessionTokenHash)
    .is("user_id", null);

  if (tolerateMissing && (isMissingTableError(error) || isMissingColumnError(error))) return 0;
  if (isMissingColumnError(error)) return throwMissingAuthMigration();
  if (error) throw error;
  return count || 0;
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || error?.code === "PGRST204" || (message.includes("could not find") && message.includes("column"));
}

function throwMissingAuthMigration() {
  const error = new Error("Dump auth migration is not applied yet. Run supabase/migrations/0016_dump_auth_ownership.sql.");
  error.status = 503;
  throw error;
}
