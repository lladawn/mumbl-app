import { encryptContentFields } from "./encryption";
import { hashToken } from "./hash";
import { cleanString } from "./validation";

export const AGENT_STATUSES = ["idle", "working", "blocked", "done"];

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

export async function recordAgentState(supabase, { spaceId, agent, status, task, kind, detail, occurredAt }) {
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
        encrypted_payload: encryptContentFields("agents", { current_task: cleanTask }),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "space_id,external_id" }
    )
    .select("id, external_id, name, role, status, last_seen_at")
    .single();

  if (upsertError) throw upsertError;

  const { error: eventError } = await supabase.from("agent_events").insert({
    space_id: spaceId,
    agent_id: agentRow.id,
    kind: cleanString(kind, 60) || "status",
    status,
    occurred_at: resolveOccurredAt(occurredAt),
    encrypted_payload: encryptContentFields("agent_events", { detail: cleanDetail || cleanTask }),
  });

  if (eventError) throw eventError;

  return agentRow;
}
