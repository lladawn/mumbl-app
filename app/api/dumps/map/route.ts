import { badRequest, ok, serverError } from "../../../../src/server/http";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../src/server/auth";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";
import {
  addFieldNoteMemory,
  addPrivateDumpMemory,
  type DumpSearchProbe,
  isSupermemoryConfigured,
  makeDumpGraph,
  searchPrivateDumpMemories,
  searchFieldNoteMemories,
} from "../../../../src/server/supermemory";

const SYNC_BATCH_SIZE = 12;
const SEARCH_PROBES: DumpSearchProbe[] = [
  {
    id: "blockers",
    label: "blockers and stuck loops",
    tone: "clay",
    query: "private work notes about blockers, stuck loops, confusion, waiting, unresolved friction, things that keep coming back",
  },
  {
    id: "momentum",
    label: "momentum and wins",
    tone: "mint",
    query: "private work notes about wins, shipped work, progress, useful decisions, flow, energy, what is working",
  },
  {
    id: "team-process",
    label: "team process signals",
    tone: "gold",
    query: "private work notes about meetings, standup, planning, collaboration, handoffs, team process, communication gaps",
  },
  {
    id: "load",
    label: "load and attention",
    tone: "violet",
    query: "private work notes about tiredness, overload, attention, context switching, burnout, hard days, emotional load",
  },
];

type DumpRow = {
  id: string;
  content: string;
  created_at: string;
  supermemory_id?: string | null;
  supermemory_status?: string | null;
};

type FieldNoteRow = {
  id: string;
  title: string;
  content: string;
  source_dump_ids: string[];
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
  supermemory_id?: string | null;
  supermemory_status?: string | null;
  supermemory_synced_at?: string | null;
};

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    const includePrivateDumps = url.searchParams.get("includePrivateDumps") === "true";
    const expectsAuthenticatedOwner = url.searchParams.get("expectsAuthenticatedOwner") === "true";
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const sessionTokenHash = owner.sessionTokenHash;
    const [{ data: dumps, error }, { data: fieldNotes, error: fieldNotesError }] = await Promise.all([
      applyOwnerFilter(supabase.from("dumps").select("id, content, created_at, supermemory_id, supermemory_status"), owner)
        .order("created_at", { ascending: false })
        .limit(80),
      applyOwnerFilter(supabase.from("field_notes").select("*"), owner).order("created_at", { ascending: false }).limit(50),
    ]);
    const hasFieldNoteSupermemoryColumns = !isMissingColumnError(fieldNotesError);
    if (isMissingTableError(error) || isMissingTableError(fieldNotesError)) {
      return serverError(missingDumpMigrationError());
    }
    if (error) throw error;
    if (fieldNotesError && hasFieldNoteSupermemoryColumns) throw fieldNotesError;

    const fallbackFieldNotes = hasFieldNoteSupermemoryColumns
      ? fieldNotes || []
      : await loadFieldNotesWithoutSupermemoryColumns({ supabase, owner });

    const dumpRows = dumps || [];
    const fieldNoteRows = fallbackFieldNotes;
    let source: "local" | "supermemory" = "local";
    let syncError = "";
    let searchResults: unknown[] = [];

    if (isSupermemoryConfigured() && hasFieldNoteSupermemoryColumns && (fieldNoteRows.length || (includePrivateDumps && dumpRows.length))) {
      try {
        await syncMissingFieldNotes({ supabase, fieldNotes: fieldNoteRows, sessionTokenHash });
        if (includePrivateDumps) {
          await syncOptedInPrivateDumps({ supabase, dumps: dumpRows, sessionTokenHash });
        }
        searchResults = (
          await Promise.all(
            SEARCH_PROBES.map(async (probe) => {
              const fieldNoteResults = await searchFieldNoteMemories({
                sessionTokenHash,
                query: probe.query,
                limit: 6,
              });
              const privateDumpResults = includePrivateDumps
                ? await searchPrivateDumpMemories({
                    sessionTokenHash,
                    query: probe.query,
                    limit: 6,
                  })
                : [];
              return [...fieldNoteResults, ...privateDumpResults].map((result) => ({
                ...(result && typeof result === "object" ? result : {}),
                probe: {
                  id: probe.id,
                  label: probe.label,
                  tone: probe.tone,
                },
              }));
            }),
          )
        ).flat();
        source = "supermemory";
      } catch (error) {
        console.warn("Supermemory map sync failed", error);
        syncError = error instanceof Error ? error.message : "Supermemory sync failed";
      }
    }

    const memoryStatus = makeMemoryStatus({
      configured: isSupermemoryConfigured(),
      hasFieldNoteSupermemoryColumns,
      includePrivateDumps,
      source,
      syncError,
      fieldNoteCount: fieldNoteRows.length,
      dumpCount: dumpRows.length,
    });

    return ok({
      graph: makeDumpGraph({ dumps: dumpRows, fieldNotes: fieldNoteRows, includePrivateDumps, searchResults, source }),
      supermemory: {
        configured: isSupermemoryConfigured(),
        status: memoryStatus.status,
        label: memoryStatus.label,
        detail: memoryStatus.detail,
        source,
        syncError: syncError ? "Memory sync is unavailable right now. Showing a lower-confidence local read." : "",
        includePrivateDumps,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

function makeMemoryStatus({
  configured,
  hasFieldNoteSupermemoryColumns,
  includePrivateDumps,
  source,
  syncError,
  fieldNoteCount,
  dumpCount,
}: {
  configured: boolean;
  hasFieldNoteSupermemoryColumns: boolean;
  includePrivateDumps: boolean;
  source: "local" | "supermemory";
  syncError: string;
  fieldNoteCount: number;
  dumpCount: number;
}) {
  if (!configured) {
    return {
      status: "local",
      label: "local only",
      detail: "Supermemory is not configured. Field notes stay local to this session view.",
    };
  }

  if (!hasFieldNoteSupermemoryColumns) {
    return {
      status: "waiting",
      label: "memory migration needed",
      detail: "Apply migration 0014 to enable Supermemory sync for field notes. Showing a local read for now.",
    };
  }

  if (syncError) {
    return {
      status: "unavailable",
      label: "memory unavailable",
      detail: "Supermemory could not sync right now. The page is showing a lower-confidence local read.",
    };
  }

  if (source === "supermemory") {
    return {
      status: "active",
      label: "supermemory active",
      detail: includePrivateDumps
        ? "Field notes and opted-in private dumps can shape this graph."
        : "Field notes are shaping this graph.",
    };
  }

  if (!fieldNoteCount && !(includePrivateDumps && dumpCount)) {
    return {
      status: "waiting",
      label: "memory waiting",
      detail: includePrivateDumps
        ? "Write a few dumps or draft a field note to start the memory graph."
        : "Draft a field note to start the memory graph.",
    };
  }

  return {
    status: "local",
    label: "local read",
    detail: "Memory sources exist, but Supermemory has not shaped this view yet.",
  };
}

function isMissingTableError(error: unknown) {
  const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const message = `${supabaseError?.message || ""} ${supabaseError?.details || ""} ${supabaseError?.hint || ""}`.toLowerCase();
  return supabaseError?.code === "42P01" || supabaseError?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingColumnError(error: unknown) {
  const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const message = `${supabaseError?.message || ""} ${supabaseError?.details || ""} ${supabaseError?.hint || ""}`.toLowerCase();
  return supabaseError?.code === "PGRST204" || message.includes("could not find") && message.includes("column");
}

async function loadFieldNotesWithoutSupermemoryColumns({
  supabase,
  owner,
}: {
  supabase: SupabaseAdmin;
  owner: Awaited<ReturnType<typeof resolveRequestOwner>>;
}) {
  const { data, error } = await applyOwnerFilter(
    supabase.from("field_notes").select("id, title, content, source_dump_ids, is_published, published_at, created_at"),
    owner,
  )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

function missingDumpMigrationError() {
  const error = new Error("Dump database migration is not applied yet. Run supabase/migrations/0011_mumbl_dump.sql.");
  (error as Error & { status?: number }).status = 503;
  return error;
}

async function syncMissingFieldNotes({
  supabase,
  fieldNotes,
  sessionTokenHash,
}: {
  supabase: SupabaseAdmin;
  fieldNotes: FieldNoteRow[];
  sessionTokenHash: string;
}) {
  const missing = fieldNotes
    .filter((fieldNote) => !fieldNote.supermemory_id || !fieldNote.supermemory_status?.startsWith("field_note_scoped:"))
    .slice(0, SYNC_BATCH_SIZE);

  for (const fieldNote of missing) {
    const result = await addFieldNoteMemory({ fieldNote, sessionTokenHash });
    if (!result?.id) continue;

    const { error } = await supabase
      .from("field_notes")
      .update({
        supermemory_id: result.id,
        supermemory_status: result.status,
        supermemory_synced_at: new Date().toISOString(),
      })
      .eq("id", fieldNote.id);
    if (error) throw error;

    fieldNote.supermemory_id = result.id;
    fieldNote.supermemory_status = result.status;
  }
}

async function syncOptedInPrivateDumps({
  supabase,
  dumps,
  sessionTokenHash,
}: {
  supabase: SupabaseAdmin;
  dumps: DumpRow[];
  sessionTokenHash: string;
}) {
  const missing = dumps
    .filter((dump) => !dump.supermemory_id || !dump.supermemory_status?.startsWith("private_dump_opt_in:"))
    .slice(0, SYNC_BATCH_SIZE);

  for (const dump of missing) {
    const result = await addPrivateDumpMemory({ dump, sessionTokenHash });
    if (!result?.id) continue;

    const { error } = await supabase
      .from("dumps")
      .update({
        supermemory_id: result.id,
        supermemory_status: result.status,
        supermemory_synced_at: new Date().toISOString(),
      })
      .eq("id", dump.id);
    if (error) throw error;

    dump.supermemory_id = result.id;
    dump.supermemory_status = result.status;
  }
}
