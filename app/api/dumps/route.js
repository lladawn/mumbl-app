import { badRequest, ok, serverError } from "../../../src/server/http";
import { applyOwnerFilter, ownerInsertFields, resolveRequestOwner } from "../../../src/server/auth";
import { serializeDump, serializeFieldNote, makeLocalReflection } from "../../../src/server/dumps";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    const [{ data: dumps, error }, { data: fieldNotes, error: fieldNotesError }] = await Promise.all([
      applyOwnerFilter(supabase.from("dumps").select("*"), owner).order("created_at", { ascending: false }).limit(80),
      applyOwnerFilter(supabase.from("field_notes").select("*"), owner).order("created_at", { ascending: false }).limit(20),
    ]);
    if (isMissingTableError(error)) {
      return serverError(missingDumpMigrationError());
    }
    if (error) throw error;
    if (fieldNotesError && !isMissingTableError(fieldNotesError)) throw fieldNotesError;

    return ok({ dumps: (dumps || []).map(serializeDump), fieldNotes: fieldNotesError ? [] : (fieldNotes || []).map(serializeFieldNote) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const content = cleanString(body.content, 4000);
    const wantsReflection = body.wantsReflection === true;

    if (!sessionToken) return badRequest("session token is required");
    if (!content) return badRequest("dump content is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    const { data: dump, error } = await supabase
      .from("dumps")
      .insert({
        ...ownerInsertFields(owner),
        content,
        visibility: "private",
        ai_reflection: wantsReflection ? makeLocalReflection(content) : null,
      })
      .select("*")
      .single();
    if (isMissingTableError(error)) {
      return serverError(missingDumpMigrationError());
    }
    if (error) throw error;

    return ok({ dump: serializeDump(dump) });
  } catch (error) {
    return serverError(error);
  }
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function missingDumpMigrationError() {
  const error = new Error("Dump database migration is not applied yet. Run supabase/migrations/0011_mumbl_dump.sql.");
  error.status = 503;
  return error;
}
