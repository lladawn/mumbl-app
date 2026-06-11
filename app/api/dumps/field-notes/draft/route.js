import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { draftFieldNote } from "../../../../../src/server/fieldNotes";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, ownerInsertFields, resolveRequestOwner } from "../../../../../src/server/auth";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { serializeFieldNote } from "../../../../../src/server/dumps";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

const MAX_DUMPS_PER_DRAFT = 10;

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const dumpIds = Array.isArray(body.dumpIds) ? body.dumpIds.map((id) => cleanString(id, 64)).filter(Boolean) : [];
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!sessionToken) return badRequest("session token is required");
    if (!dumpIds.length) return badRequest("choose at least one dump");
    if (dumpIds.length > MAX_DUMPS_PER_DRAFT) return badRequest(`choose ${MAX_DUMPS_PER_DRAFT} dumps or fewer`);

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "field_note", sessionToken });

    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: dumps, error: dumpsError } = await applyOwnerFilter(supabase.from("dumps").select("*").in("id", dumpIds), owner);
    if (dumpsError) throw dumpsError;
    if (!dumps?.length) return badRequest("no matching private dumps found");

    const orderedDumps = [...dumpIds].reverse().map((id) => dumps.find((dump) => dump.id === id)).filter(Boolean);
    const draft = await draftFieldNote({ dumps: orderedDumps });

    const { data: fieldNote, error: noteError } = await supabase
      .from("field_notes")
      .insert({
        ...ownerInsertFields(owner),
        source_dump_ids: draft.sourceDumpIds,
        title: draft.title || "field note",
        content: draft.content,
      })
      .select("*")
      .single();
    if (noteError) throw noteError;

    return ok({ fieldNote: serializeFieldNote(fieldNote), visibilityReminder: draft.visibilityReminder });
  } catch (error) {
    return serverError(error);
  }
}
