import { badRequest, ok, serverError } from "../../../../src/server/http";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../src/server/auth";
import { buildPatternGraph } from "../../../../src/server/patternGraph";
import { getServerEnv } from "../../../../src/server/env";
import { embedContent } from "../../../../src/server/signals";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    const expectsAuthenticatedOwner = url.searchParams.get("expectsAuthenticatedOwner") === "true";
    if (!sessionToken) return badRequest("session token is required");

    const env = getServerEnv();
    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    if (!owner.userId) {
      return ok({
        graph: emptyGraph("log in to build your private working map."),
        memory: {
          status: "auth-required",
          label: "login needed",
          detail: "private patterns are only processed for logged-in dump owners.",
          source: "none",
        },
        testToolsEnabled: env.patternGraphTestToolsEnabled,
      });
    }

    const [{ data: dumps, error: dumpsError }, { data: signals, error: signalsError }, { data: patterns, error: patternsError }] =
      await Promise.all([
        applyOwnerFilter(supabase.from("dumps").select("id, content, created_at").eq("visibility", "private"), owner)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("dump_signals")
          .select("dump_id, energy, emotions, topics, is_blocker, signal_strength, extraction_status")
          .eq("user_id", owner.userId)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("patterns")
          .select("id, dump_ids, summary, question, user_confirmed, user_dismissed, triggered_at_count, created_at")
          .eq("user_id", owner.userId)
          .or("user_dismissed.is.null,user_dismissed.eq.false")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (isMissingTableError(dumpsError)) return serverError(missingDumpMigrationError());
    if (isMissingTableError(signalsError) || isMissingTableError(patternsError)) return serverError(missingPatternMigrationError());
    if (dumpsError) throw dumpsError;
    if (signalsError) throw signalsError;
    if (patternsError) throw patternsError;

    const graph = await buildPatternGraph({
      supabase,
      userId: owner.userId,
      dumps: dumps || [],
      signals: signals || [],
      patterns: patterns || [],
      embedContent,
    });

    return ok({
      graph,
      memory: makeMemoryStatus({ dumpCount: dumps?.length || 0, signalCount: signals?.length || 0, syncedCount: graph.syncedCount || 0 }),
      testToolsEnabled: env.patternGraphTestToolsEnabled,
    });
  } catch (error) {
    return serverError(error);
  }
}

function makeMemoryStatus({ dumpCount, signalCount, syncedCount }) {
  if (!dumpCount) {
    return {
      status: "waiting",
      label: "waiting for dumps",
      detail: "write a logged-in private dump to start your working map.",
      source: "pattern_graph",
    };
  }

  if (!signalCount) {
    return {
      status: "waiting",
      label: "processing soon",
      detail: "your saved dumps are private. pattern signals will appear after the async pass finishes.",
      source: "pattern_graph",
    };
  }

  return {
    status: syncedCount ? "active" : "waiting",
    label: syncedCount ? "pattern graph active" : "processing",
    detail: syncedCount
      ? "logged-in private dumps are shaping this map. nothing is posted to a room."
      : "signal extraction has started, but no completed vectors are ready yet.",
    source: "pattern_graph",
  };
}

function emptyGraph(detail) {
  return {
    nodes: [],
    edges: [],
    source: "none",
    syncedCount: 0,
    patterns: [],
    insights: [],
    summary: {
      headline: "No private pattern yet",
      detail,
      nextStep: "log in and save a private dump.",
    },
  };
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

function missingPatternMigrationError() {
  const error = new Error("Pattern graph migration is not applied yet. Run supabase/migrations/0026_pattern_graph.sql.");
  error.status = 503;
  return error;
}
