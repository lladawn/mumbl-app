import { ok, serverError } from "../../../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";
import { readSpaceState } from "../../../../../../src/server/agentPresence";
import { demoSpaceState } from "../../../../../../src/server/officeDemo";

/**
 * The owner-scoped read of a space's live office state.
 *
 *   GET /api/agents/spaces/<slug>/state
 *
 * Service-role and server-side: RLS stays closed, decryption never leaves the
 * server. LiveOffice polls this every ~4s and reconciles the scene.
 *
 * Demo fallback: the env ships with empty Supabase secrets, so if the DB is
 * unreachable (or the slug has no live space yet) this returns a seeded demo
 * office instead of an error — the phase-1 route is meant to be visibly working
 * before DB bring-up. Real data supersedes the demo the moment it exists.
 */
export async function GET(_request, { params }) {
  const { slug } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const state = await readSpaceState(supabase, slug);
    // unknown slug → fall back to the demo cast rather than 404, so the route
    // is never a dead page while the product is still being wired up
    if (!state || !state.actors.length) {
      return ok(demoSpaceState(slug));
    }
    return ok(state);
  } catch (error) {
    // The whole point of the fallback is to stay visibly working before DB
    // bring-up. Anything that means "the DB isn't ready" — missing creds (503),
    // no connectivity, or the migrations not being applied yet (table missing)
    // — lands on the demo cast rather than an error page. A genuine bug still
    // surfaces.
    if (error?.status === 503 || isDbNotReady(error)) {
      return ok(demoSpaceState(slug));
    }
    return serverError(error);
  }
}

function isDbNotReady(error) {
  // PostgREST "table not found" is PGRST205 / 42P01; also treat connectivity +
  // missing-env as not-ready.
  const code = String(error?.code || "");
  if (code === "PGRST205" || code === "42P01") return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    message.includes("fetch failed") ||
    message.includes("missing backend environment") ||
    message.includes("supabaseurl") ||
    message.includes("network")
  );
}
