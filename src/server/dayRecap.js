/**
 * Day-recap aggregate: write path helper + read path.
 *
 * Privacy posture #2: shape-only throughout. daily_app_totals stores only
 * tool names, categories, and second counts — never window titles, task text,
 * repo names, or any content field.
 *
 * Service-role only. RLS is closed on daily_app_totals; all paths here run
 * server-side and never expose raw rows to the browser.
 */

import { cleanString } from "./validation";

// Maximum seconds credited per event gap. Caps gaps from machine sleep,
// helper pause, or very infrequent hook fire — anything longer looks like
// "away" time, not continuous focus.
export const DAILY_TOTAL_MAX_GAP_SEC = 10 * 60; // 10 minutes

// ── Write path ───────────────────────────────────────────────────────────────

/**
 * Increment today's (space, actor, tool, category) aggregate by `deltaSec`
 * seconds and bump sessions by 1 when isNewSession is true.
 *
 * Idempotent and safe to call on every ingest: the Postgres RPC does an
 * INSERT … ON CONFLICT DO UPDATE with atomic addition, so concurrent calls
 * are safe.
 *
 * Degrades gracefully: if daily_app_totals or the RPC doesn't exist (migration
 * not yet applied), the error is swallowed so ingest continues unchanged.
 *
 * @param {object} supabase           - service-role Supabase client
 * @param {object} opts
 * @param {string} opts.spaceId           - agent_spaces.id (uuid)
 * @param {string} opts.actorExternalId   - agents.external_id
 * @param {string} opts.tool              - SHAPE tool name (e.g. 'vscode')
 * @param {string} opts.category          - SHAPE category (e.g. 'coding')
 * @param {number} opts.deltaSec          - seconds to add (≥ 0)
 * @param {boolean} opts.isNewSession     - true → bump sessions by 1
 */
export async function incrementDailyTotal(supabase, {
  spaceId,
  actorExternalId,
  tool,
  category,
  deltaSec,
  isNewSession,
}) {
  if (!spaceId || !actorExternalId || !tool || !category) return;
  const safeDelta = Math.max(0, Math.round(deltaSec || 0));
  if (safeDelta === 0 && !isNewSession) return;

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  const { error } = await supabase.rpc("upsert_daily_app_total", {
    p_space_id:          spaceId,
    p_actor_external_id: actorExternalId,
    p_day:               day,
    p_tool:              tool,
    p_category:          category,
    p_delta_sec:         safeDelta,
    p_new_session:       isNewSession ? 1 : 0,
  });

  if (error) {
    // Degrade gracefully when the migration or RPC hasn't been applied yet.
    if (
      error.code === "42883" || // function does not exist
      error.code === "42P01" || // relation does not exist
      error.message?.includes("upsert_daily_app_total") ||
      error.message?.includes("daily_app_totals")
    ) {
      return; // silently skip — ingest proceeds unchanged
    }
    // Other errors are unexpected — log but do not throw (best-effort path).
    console.warn("[dayRecap] incrementDailyTotal error:", error.message);
  }
}

// ── Read path ─────────────────────────────────────────────────────────────────

/**
 * Read today's daily_app_totals for a space and return the recap aggregate
 * shape the opengraph card expects:
 *
 *   { date: "Aug 20", apps: [{ tool, seconds }], injectCatSec: { coding: N, ... } }
 *
 * Aggregates across ALL actors in the space so a single-person space (like
 * "disha") produces the owner's full-day picture even when the desktop helper
 * sends separate actor rows per app (desktop:UUID:vscode, desktop:UUID:chrome …).
 *
 * Returns null when:
 *   - space slug not found
 *   - no rows for today (helper hasn't run yet, or migration not applied)
 *   - any unexpected error — caller falls back to mock
 *
 * @param {object} supabase  - service-role Supabase client
 * @param {string} slug      - agent_spaces.slug
 * @returns {object|null}
 */
export async function readDayRecap(supabase, slug) {
  const cleanSlug = cleanString(slug, 64).toLowerCase();
  if (!cleanSlug) return null;

  // Resolve space id
  const { data: space, error: spaceError } = await supabase
    .from("agent_spaces")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (spaceError || !space) return null;

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  let rows;
  try {
    const { data, error } = await supabase
      .from("daily_app_totals")
      .select("tool, category, seconds, sessions")
      .eq("space_id", space.id)
      .eq("day", day)
      .order("seconds", { ascending: false });

    if (error) {
      // Table doesn't exist yet (migration not applied) — fall back silently.
      if (error.code === "42P01" || error.message?.includes("daily_app_totals")) {
        return null;
      }
      return null;
    }
    rows = data || [];
  } catch {
    return null;
  }

  if (!rows.length) return null;

  // Merge rows by tool (multiple actors may have the same tool — e.g. two
  // desktop:UUID:vscode runs on the same day — so we sum their seconds).
  const toolMap = new Map();
  const catSec = {};

  for (const row of rows) {
    // Accumulate seconds by tool
    const existing = toolMap.get(row.tool);
    if (existing) {
      existing.seconds += row.seconds;
    } else {
      toolMap.set(row.tool, { tool: row.tool, category: row.category, seconds: row.seconds });
    }
    // Accumulate seconds by category
    catSec[row.category] = (catSec[row.category] || 0) + row.seconds;
  }

  const apps = Array.from(toolMap.values()).sort((a, b) => b.seconds - a.seconds);

  const dateStr = formatDateUTC(new Date());

  return { date: dateStr, apps, injectCatSec: catSec };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateUTC(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
