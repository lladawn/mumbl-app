import { badRequest, ok, serverError } from "../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { enforceRateLimit } from "../../../../src/server/rateLimit";
import { cleanString } from "../../../../src/server/validation";
import {
  AGENT_STATUSES,
  isValidAgentStatus,
  recordAgentState,
  resolveSpaceByIngestToken,
} from "../../../../src/server/agentPresence";

/**
 * The one write path for agent state.
 *
 * Claude Code hooks and the MCP server are both adapters onto this — keeping a
 * single endpoint means a new runtime is a new adapter, not a new pipeline.
 *
 *   POST /api/agents/ingest
 *   Authorization: Bearer <space ingest token>
 *   { "agent": { "id", "name", "role", "source" },
 *     "status": "working" | "blocked" | "done" | "idle",
 *     "task": "...", "kind": "PreToolUse", "detail": "..." }
 */
export async function POST(request) {
  try {
    const token = bearerToken(request);
    if (!token) return unauthorized("missing bearer token");

    const supabase = getSupabaseAdmin();
    const space = await resolveSpaceByIngestToken(supabase, token);
    if (!space) return unauthorized("unknown ingest token");

    const body = await request.json().catch(() => null);
    if (!body) return badRequest("body must be json");

    const status = cleanString(body.status, 20).toLowerCase();
    if (!isValidAgentStatus(status)) {
      return badRequest(`status must be one of ${AGENT_STATUSES.join(", ")}`);
    }

    const agent = body.agent || {};
    if (!cleanString(agent.id, 200)) return badRequest("agent.id is required");

    // keyed on the space, so one noisy agent cannot starve the others' quota
    // any faster than the space as a whole
    await enforceRateLimit({ supabase, action: "agent_ingest", sessionToken: token });

    const row = await recordAgentState(supabase, {
      spaceId: space.id,
      agent: {
        externalId: agent.id,
        name: agent.name,
        role: agent.role,
        source: agent.source,
      },
      status,
      task: body.task,
      kind: body.kind,
      detail: body.detail,
      occurredAt: body.occurredAt,
      // SHAPE fields (plaintext, safe to render/share). Absent from a Claude
      // Code hook, which is fine: recordAgentState defaults category to 'agent'.
      tool: body.tool,
      category: body.category,
      object: body.object,
    });

    return ok({ ok: true, space: space.slug, agent: { id: row.id, name: row.name, status: row.status } });
  } catch (error) {
    if (error?.status === 429) {
      return Response.json({ error: "too many updates" }, { status: 429 });
    }
    return serverError(error);
  }
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function unauthorized(message) {
  return Response.json({ error: message }, { status: 401 });
}
