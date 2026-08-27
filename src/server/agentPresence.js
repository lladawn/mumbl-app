import { decryptContentFields, encryptContentFields } from "./encryption";
import { getServerEnv } from "./env";
import { hashToken } from "./hash";
import { cleanString } from "./validation";
import { incrementDailyTotal } from "./dayRecap";

export const AGENT_STATUSES = ["idle", "working", "blocked", "done"];

// The fixed category vocabulary the office self-assembles from. Enforced in the
// app layer (not a DB enum) so adding a category is a code change, not a
// migration. A null/unknown category from an existing Claude Code row is read
// as 'agent' — those rows predate the shape columns.
export const ACTIVITY_CATEGORIES = [
  "coding",
  "design",
  "writing",
  "call",
  "music",
  "review",
  "browsing",
  "focus",
  "agent",
];

// How many events the panel's activity log reads back per actor.
const EVENTS_PER_ACTOR = 12;
// Older than this and an actor has "walked out" — the office stops rendering it.
const STALE_MS = 5 * 60 * 1000;

// Privacy posture #2: the office is an ephemeral relay of the CURRENT shape of
// work, not a durable log. These knobs come from env (see env.js):
//   - history OFF (default): events carry a TTL and are purged; reads drop
//     anything expired.
//   - history ON (opt-in): events retained, no TTL, no purge.
//   - offline: if a space's freshest agent hasn't been seen within the offline
//     window, we render an "away" state instead of a stale live snapshot.
function officePosture() {
  const env = getServerEnv();
  return {
    historyEnabled: env.officeHistoryEnabled,
    eventTtlMs: env.officeEventTtlMinutes * 60 * 1000,
    offlineMs: env.officeOfflineMinutes * 60 * 1000,
  };
}

// Hooks fire far more often than a human posts, so the caps here are per space
// and generous. See rateLimit.js for the enforced numbers.
const MAX_TASK = 300;
const MAX_DETAIL = 500;

export function isValidAgentStatus(value) {
  return AGENT_STATUSES.includes(value);
}

export async function resolveSpaceByIngestToken(supabase, token) {
  if (!token) return null;
  const tokenHash = hashToken(token);

  // A paired DEVICE token is tried first, because it is the credential we want
  // people to be holding: scoped to one machine and revocable on its own. The
  // space-wide token below is the legacy shape — one secret for the whole
  // space, revocable only by breaking every reporter at once — and it stays
  // accepted so existing Claude Code hooks and MCP setups keep working.
  //
  // Both resolve to the same { id, slug, name }, so /api/agents/ingest does not
  // need to know which kind it was handed. That is the point of resolving here:
  // ingest-only is expressed by this being the ONLY thing a device token can
  // unlock — nothing in the read path consults agent_device_tokens.
  const device = await resolveSpaceByDeviceToken(supabase, tokenHash);
  if (device) return device;

  const { data, error } = await supabase
    .from("agent_spaces")
    .select("id, slug, name")
    .eq("ingest_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function resolveSpaceByDeviceToken(supabase, tokenHash) {
  const { data, error } = await supabase
    .from("agent_device_tokens")
    .select("id, space_id, agent_spaces ( id, slug, name )")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)          // REVOCABLE: a stamped row stops resolving
    .maybeSingle();

  // The pairing tables arrive in migration 0010. An environment that has not
  // run it yet must keep ingesting on the legacy token rather than 500, so a
  // missing relation falls through instead of throwing.
  if (error) {
    if (isMissingPairingTable(error)) return null;
    throw error;
  }
  if (!data?.agent_spaces) return null;

  // Last-seen is what the device list renders as "active 2 minutes ago"; it is
  // best-effort and must never fail an ingest.
  supabase
    .from("agent_device_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(null, () => {});

  return data.agent_spaces;
}

function isMissingPairingTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42P01" || message.includes("agent_device_tokens");
}

/**
 * Upsert the agent's current state and append one event.
 *
 * The agent row is "where is this collaborator now" (what the world renders);
 * agent_events is "what has it been doing" (what the side panel reads). Both
 * are written together so the world can never show a state with no trail.
 */
/**
 * Reporters send when the event happened. Insert order is not event order —
 * hooks fire faster than the round-trip — but a client clock cannot be trusted
 * either, so anything implausible falls back to server time.
 */
export function resolveOccurredAt(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();

  const now = Date.now();
  const skew = parsed.getTime() - now;
  if (skew > 5 * 60 * 1000 || skew < -24 * 60 * 60 * 1000) return new Date().toISOString();
  return parsed.toISOString();
}

// A category is only trusted if it is in the fixed vocabulary. A Claude Code
// agent has no reason to send one, so it falls back to 'agent' — the seated
// collaborator the office was built around.
function resolveCategory(value, source) {
  const clean = cleanString(value, 20).toLowerCase();
  if (ACTIVITY_CATEGORIES.includes(clean)) return clean;
  return source === "claude-code" ? "agent" : "focus";
}

// Maximum seconds we credit per event gap. Caps gaps caused by the helper
// being paused, a machine sleeping, or very infrequent hooks. Anything longer
// than this looks like "away", not continuous focus.
const DAILY_TOTAL_MAX_GAP_SEC = 10 * 60; // 10 minutes

export async function recordAgentState(supabase, { spaceId, agent, status, task, kind, detail, occurredAt, tool, category, object }) {
  const externalId = cleanString(agent.externalId, 200);
  if (!externalId) {
    const error = new Error("agent.id is required");
    error.status = 400;
    throw error;
  }

  const name = cleanString(agent.name, 80) || "Agent";
  const role = cleanString(agent.role, 60) || "General";
  const source = cleanString(agent.source, 40) || "unknown";
  const cleanTask = cleanString(task, MAX_TASK);
  const cleanDetail = cleanString(detail, MAX_DETAIL);
  // SHAPE — plaintext, safe to render and share
  const cleanTool = cleanString(tool, 40) || (source === "claude-code" ? "claude-code" : null);
  const cleanCategory = resolveCategory(category, source);
  const cleanObject = cleanString(object, 40) || null;

  // ── Daily aggregate: capture previous state BEFORE the upsert so we can
  //    compute elapsed seconds since the actor's last event. This is a PK
  //    lookup (space_id, external_id) so it's cheap. If the actor is new, the
  //    row won't exist and delta = 0 (first session bump only).
  const nowMs = Date.now();
  let prevLastSeenAt = null;
  let prevTool = null;
  let prevCategory = null;
  const { data: prevRow } = await supabase
    .from("agents")
    .select("last_seen_at, tool, category")
    .eq("space_id", spaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (prevRow) {
    prevLastSeenAt = prevRow.last_seen_at;
    prevTool = prevRow.tool;
    prevCategory = prevRow.category;
  }

  const { data: agentRow, error: upsertError } = await supabase
    .from("agents")
    .upsert(
      {
        space_id: spaceId,
        external_id: externalId,
        name,
        role,
        source,
        status,
        tool: cleanTool,
        category: cleanCategory,
        object: cleanObject,
        encrypted_payload: encryptContentFields("agents", { current_task: cleanTask }),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "space_id,external_id" }
    )
    .select("id, external_id, name, role, status, tool, category, object, last_seen_at")
    .single();

  if (upsertError) throw upsertError;

  // Posture #2: default is ephemeral. When history is OFF, the event lapses
  // after the TTL — invisible to reads immediately, purged shortly after. When
  // history is ON (opt-in), expires_at stays null and the row is retained.
  const { historyEnabled, eventTtlMs } = officePosture();
  const expiresAt = historyEnabled ? null : new Date(Date.now() + eventTtlMs).toISOString();

  const { error: eventError } = await supabase.from("agent_events").insert({
    space_id: spaceId,
    agent_id: agentRow.id,
    kind: cleanString(kind, 60) || "status",
    status,
    tool: cleanTool,
    category: cleanCategory,
    object: cleanObject,
    occurred_at: resolveOccurredAt(occurredAt),
    expires_at: expiresAt,
    encrypted_payload: encryptContentFields("agent_events", { detail: cleanDetail || cleanTask }),
  });

  if (eventError) throw eventError;

  // ── Durable day-aggregate increment (best-effort — never fails ingest) ──
  //
  // Credit the elapsed seconds since the actor's last event to the PREVIOUS
  // tool+category (what they were doing in that window). Cap at
  // DAILY_TOTAL_MAX_GAP_SEC so a machine sleep or long pause doesn't inflate
  // the total. A new actor (no prevRow) gets a session bump with 0 seconds.
  //
  // Shape-only: we only write tool + category, never task/detail/object.
  await (async () => {
    // Determine which (tool, category) to credit the elapsed time to.
    // Use the PREVIOUS tool+category (the one active during the elapsed gap),
    // falling back to the current event's shape if this is a new actor.
    const creditTool = prevTool || cleanTool;
    const creditCategory = prevCategory || cleanCategory;
    if (!creditTool || !creditCategory) return;

    const rawDeltaSec = prevLastSeenAt
      ? Math.round((nowMs - new Date(prevLastSeenAt).getTime()) / 1000)
      : 0;
    const deltaSec = Math.min(Math.max(0, rawDeltaSec), DAILY_TOTAL_MAX_GAP_SEC);

    // isNewSession: true on the very first event of the day for this actor+tool
    // combination, or when the actor switches to a different tool. This gives
    // a rough "session" count (number of distinct focus blocks).
    const isNewSession = !prevLastSeenAt || prevTool !== cleanTool;

    await incrementDailyTotal(supabase, {
      spaceId,
      actorExternalId: externalId,
      tool: creditTool,
      category: creditCategory,
      deltaSec,
      isNewSession,
    }).catch(() => {}); // best-effort: a failed aggregate must not fail ingest
  })();

  // Purge-on-write: this space's own writes sweep its lapsed events, so the DB
  // stays a thin relay without needing a cron. Best-effort — a failed purge
  // must not fail the ingest, and reads already exclude expired rows anyway.
  if (!historyEnabled) {
    await purgeExpiredEvents(supabase, spaceId).catch(() => {});
  }

  return agentRow;
}

// Delete this space's lapsed events. Kept narrow (one space) so an ingest only
// ever pays for its own tenant's cleanup.
export async function purgeExpiredEvents(supabase, spaceId) {
  const { error } = await supabase
    .from("agent_events")
    .delete()
    .eq("space_id", spaceId)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
}

/**
 * The owner-scoped read path — the mirror of recordAgentState.
 *
 * The LIVE VIEW is sourced entirely from the `agents` current-state upsert
 * (last-known shape per collaborator) — the office renders correctly from that
 * alone. agent_events only enriches the side panel's activity trail, and only
 * NON-EXPIRED events are ever returned (posture #2: an ephemeral relay, not a
 * durable log). Returns each actor's shape plus the decrypted current_task and
 * that short trail, ordered by occurred_at (never created_at — hooks land out
 * of order; see 0005). Service-role and server-side: RLS stays closed and the
 * browser never sees keys or ciphertext.
 *
 * When the space's freshest agent hasn't been seen within the offline window,
 * `offline` is set so the caller renders an "away" state rather than a stale
 * live snapshot.
 */
export async function readSpaceState(supabase, slug) {
  const cleanSlug = cleanString(slug, 64).toLowerCase();
  if (!cleanSlug) return null;

  const { data: space, error: spaceError } = await supabase
    .from("agent_spaces")
    .select("id, slug, name")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (spaceError) throw spaceError;
  if (!space) return null;

  const { data: agentRows, error: agentsError } = await supabase
    .from("agents")
    .select("id, external_id, name, role, status, source, tool, category, object, encrypted_payload, last_seen_at")
    .eq("space_id", space.id)
    .order("last_seen_at", { ascending: false });
  if (agentsError) throw agentsError;

  const agents = agentRows || [];
  const generatedAt = new Date().toISOString();
  const { offlineMs } = officePosture();

  if (!agents.length) {
    return { space: { slug: space.slug, name: space.name }, actors: [], generatedAt, offline: true };
  }

  // The whole space is offline if even its most-recently-seen agent has gone
  // quiet past the window. agents are ordered by last_seen_at desc, so [0] is
  // the freshest.
  const freshestSeenAt = agents[0].last_seen_at;
  const offline = Date.now() - new Date(freshestSeenAt).getTime() > offlineMs;

  // Only non-expired events feed the panel. A lapsed row is invisible here the
  // instant its TTL passes, even before purge-on-write removes it. Null
  // expires_at = retained (history ON, or legacy rows) and always passes.
  const nowIso = new Date().toISOString();
  const { data: eventRows, error: eventsError } = await supabase
    .from("agent_events")
    .select("agent_id, kind, status, tool, category, object, occurred_at, encrypted_payload")
    .eq("space_id", space.id)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("occurred_at", { ascending: false })
    .limit(EVENTS_PER_ACTOR * agents.length);
  if (eventsError) throw eventsError;

  // group the newest events under their actor, keeping occurred_at order
  const eventsByAgent = new Map();
  for (const raw of eventRows || []) {
    const list = eventsByAgent.get(raw.agent_id) || [];
    if (list.length >= EVENTS_PER_ACTOR) continue;
    const decrypted = decryptContentFields("agent_events", raw, ["detail"]);
    list.push({
      kind: decrypted.kind,
      status: decrypted.status,
      category: decrypted.category || "agent",
      detail: decrypted.detail || "",
      occurredAt: decrypted.occurred_at,
    });
    eventsByAgent.set(raw.agent_id, list);
  }

  const actors = agents.map((row) => {
    const decrypted = decryptContentFields("agents", row, ["current_task"]);
    // the log reads oldest → newest, the way the panel types it out
    const events = (eventsByAgent.get(row.id) || []).slice().reverse();
    return {
      externalId: row.external_id,
      name: row.name,
      role: row.role,
      status: row.status,
      source: row.source,
      tool: row.tool || null,
      category: row.category || "agent",
      object: row.object || null,
      currentTask: decrypted.current_task || "",
      lastSeenAt: row.last_seen_at,
      stale: Date.now() - new Date(row.last_seen_at).getTime() > STALE_MS,
      events,
    };
  });

  return { space: { slug: space.slug, name: space.name }, actors, generatedAt, offline };
}

/**
 * The single gate for anything public — SHAPE ONLY.
 *
 * Everything that could carry content (current_task, event detail, exact
 * occurred_at, external_id) is dropped here and never leaves. What survives is
 * the shareable shape: status, category, tool, object, and a coarse recency
 * bucket. This is what the OG card and the public page are allowed to see.
 */
export function redactForPublic(state) {
  if (!state) return { actors: [], objects: [], offline: true, generatedAt: new Date().toISOString() };

  // Offline guard: never serve a durable-looking snapshot of someone who has
  // gone away. When offline, the card renders an "away" state with no cast — we
  // do not expose the last-known shape of an absent user as if it were live.
  if (state.offline) {
    return { actors: [], objects: [], offline: true, generatedAt: state.generatedAt || new Date().toISOString() };
  }

  const actors = (state.actors || []).map((a) => ({
    name: cleanString(a.name, 24) || "Someone",
    status: a.status,
    category: a.category || "agent",
    tool: a.tool || null,
    object: a.object || null,
    recency: recencyBucket(a.lastSeenAt),
  }));

  // the office self-assembles: one object per distinct active category
  const counts = new Map();
  for (const a of actors) {
    if (a.recency === "idle") continue;
    const key = a.category;
    const prev = counts.get(key) || { category: key, object: a.object, count: 0 };
    prev.count += 1;
    counts.set(key, prev);
  }

  return {
    actors,
    objects: Array.from(counts.values()),
    offline: false,
    generatedAt: state.generatedAt || new Date().toISOString(),
  };
}

function recencyBucket(lastSeenAt) {
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age < 90 * 1000) return "active";
  if (age < STALE_MS) return "recently";
  return "idle";
}
