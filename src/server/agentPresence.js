import { decryptContentFields, encryptContentFields } from "./encryption";
import { hashToken } from "./hash";
import { cleanString } from "./validation";

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

// Hooks fire far more often than a human posts, so the caps here are per space
// and generous. See rateLimit.js for the enforced numbers.
const MAX_TASK = 300;
const MAX_DETAIL = 500;

export function isValidAgentStatus(value) {
  return AGENT_STATUSES.includes(value);
}

export async function resolveSpaceByIngestToken(supabase, token) {
  if (!token) return null;

  const { data, error } = await supabase
    .from("agent_spaces")
    .select("id, slug, name")
    .eq("ingest_token_hash", hashToken(token))
    .maybeSingle();

  if (error) throw error;
  return data || null;
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

  const { error: eventError } = await supabase.from("agent_events").insert({
    space_id: spaceId,
    agent_id: agentRow.id,
    kind: cleanString(kind, 60) || "status",
    status,
    tool: cleanTool,
    category: cleanCategory,
    object: cleanObject,
    occurred_at: resolveOccurredAt(occurredAt),
    encrypted_payload: encryptContentFields("agent_events", { detail: cleanDetail || cleanTask }),
  });

  if (eventError) throw eventError;

  return agentRow;
}

/**
 * The owner-scoped read path — the mirror of recordAgentState.
 *
 * Returns each actor's shape (status/name/role/tool/category/object) plus the
 * decrypted current_task and a decrypted activity log ordered by occurred_at
 * (never created_at — hooks land out of order; see 0005). Service-role and
 * server-side: RLS stays closed and the browser never sees keys or ciphertext.
 * The scene adapter turns these rows into seated agents.
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

  if (!agents.length) {
    return { space: { slug: space.slug, name: space.name }, actors: [], generatedAt };
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from("agent_events")
    .select("agent_id, kind, status, tool, category, object, occurred_at, encrypted_payload")
    .eq("space_id", space.id)
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

  return { space: { slug: space.slug, name: space.name }, actors, generatedAt };
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
  if (!state) return { actors: [], objects: [], generatedAt: new Date().toISOString() };

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
    generatedAt: state.generatedAt || new Date().toISOString(),
  };
}

function recencyBucket(lastSeenAt) {
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age < 90 * 1000) return "active";
  if (age < STALE_MS) return "recently";
  return "idle";
}
