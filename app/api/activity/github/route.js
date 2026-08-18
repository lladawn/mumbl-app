import { badRequest, ok, serverError } from "../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { getServerEnv } from "../../../../src/server/env";
import { enforceRateLimit } from "../../../../src/server/rateLimit";
import {
  recordAgentState,
  resolveSpaceByIngestToken,
} from "../../../../src/server/agentPresence";
import {
  mapGithubEvent,
  verifyGithubSignature,
} from "../../../../src/server/githubAdapter";

/**
 * GitHub webhook feed — the third v1 source (office-sim spike §7).
 *
 * A GitHub repo webhook POSTs here on push / pull_request / issues /
 * pull_request_review. We:
 *   1. verify GitHub's X-Hub-Signature-256 HMAC against GITHUB_WEBHOOK_SECRET
 *      over the RAW body (reject on mismatch — an unverifiable webhook is
 *      dropped, never trusted),
 *   2. normalize the event to the canonical shape via the pure `mapGithubEvent`
 *      adapter,
 *   3. write it through the SAME recordAgentState path every other source uses,
 *      so shape stays plaintext, content (repo/branch/PR title) is encrypted,
 *      and posture #2's TTL/purge applies unchanged.
 *
 * Which space this lands in: GitHub can't send a Bearer token, so the space
 * ingest token is passed as the `?space=<token>` query param when you register
 * the webhook URL (it still authorizes via the exact same hashToken lookup —
 * `resolveSpaceByIngestToken` — as the Bearer path; no new auth mechanism).
 *
 *   POST /api/activity/github?space=<space ingest token>
 *   X-Hub-Signature-256: sha256=<hmac of raw body, GITHUB_WEBHOOK_SECRET>
 *   X-GitHub-Event: push | pull_request | issues | pull_request_review
 */
export async function POST(request) {
  try {
    const { githubWebhookSecret: secret } = getServerEnv();
    if (!secret) {
      return serverError({ status: 503, message: "Missing backend environment variables: GITHUB_WEBHOOK_SECRET" });
    }

    // The signature is computed over the exact bytes, so read the raw body once
    // and verify BEFORE parsing. Never trust an unverified payload.
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";
    if (!verifyGithubSignature(rawBody, signature, secret)) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }

    const token = spaceToken(request);
    if (!token) return unauthorized("missing space ingest token");

    const supabase = getSupabaseAdmin();
    const space = await resolveSpaceByIngestToken(supabase, token);
    if (!space) return unauthorized("unknown ingest token");

    const eventName = request.headers.get("x-github-event") || "";
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return badRequest("body must be json");
    }

    const norm = mapGithubEvent(eventName, payload);
    // A verified event we don't render (ping, star, unknown action). ACK 200 so
    // GitHub marks it delivered and doesn't retry.
    if (!norm) {
      return ok({ ok: true, ignored: true, event: eventName });
    }

    // keyed on the space, matching the Bearer ingest path's quota
    await enforceRateLimit({ supabase, action: "agent_ingest", sessionToken: token });

    const row = await recordAgentState(supabase, {
      spaceId: space.id,
      agent: {
        externalId: norm.actor.id,
        name: norm.actor.name,
        role: norm.actor.role,
        source: norm.actor.source,
      },
      status: norm.status,
      // repo/branch/PR title ride here and are encrypted at rest; NEVER a shape field
      task: norm.detail,
      kind: norm.kind,
      detail: norm.detail,
      occurredAt: norm.occurredAt,
      // SHAPE — plaintext, safe to render/share
      tool: norm.tool,
      category: norm.category,
      object: norm.object,
    });

    return ok({ ok: true, space: space.slug, agent: { id: row.id, name: row.name, status: row.status } });
  } catch (error) {
    if (error?.status === 429) {
      return Response.json({ error: "too many updates" }, { status: 429 });
    }
    return serverError(error);
  }
}

// The space ingest token comes on the query string (?space= or ?token=) because
// GitHub webhooks can't set an Authorization header. It is still the same token
// the Bearer path uses and is resolved by the same hashToken lookup.
function spaceToken(request) {
  const url = new URL(request.url);
  const value = url.searchParams.get("space") || url.searchParams.get("token") || "";
  return value.trim();
}

function unauthorized(message) {
  return Response.json({ error: message }, { status: 401 });
}
