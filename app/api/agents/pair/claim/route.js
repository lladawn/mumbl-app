import { badRequest, serverError } from "../../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { getServerEnv } from "../../../../../src/server/env";
import { claimPairingCode, normalizePairingCode } from "../../../../../src/server/devicePairing";

/**
 * The desktop helper collecting its device token.
 *
 *   POST /api/agents/pair/claim   { "code": "ABCD-EFGH" }
 *     200 { token, slug, endpoint }  authorized — stop polling, store it
 *     202 {}                         valid code, human hasn't clicked yet
 *     404 { error }                  unknown / expired / already used
 *
 * The contract is desktop/src-tauri/src/pairing.rs::claim, which distinguishes
 * these three by STATUS CODE, so the codes matter more than the bodies.
 *
 * DELIBERATELY UNAUTHENTICATED. The app has no credential yet — obtaining one
 * is the point — so possession of a fresh code is the proof. That holds because
 * a code is single-use, expires in ten minutes, and does nothing at all until a
 * signed-in human has bound a space to it.
 *
 * Note for anyone extending this: do NOT add a 401/403 branch. pairing.rs reads
 * any other 4xx as "the code is spent" and stops polling, so an auth failure
 * would surface to the user as "expired" and send them round the loop forever.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest("body must be json");

    const code = normalizePairingCode(body.code);
    if (!code) return badRequest("code is required");

    const supabase = getSupabaseAdmin();

    // Keyed on client IP, because there is no session here to key on. The
    // limiter is generous enough for the helper's 2-second poll (see the
    // agent_pair_claim note in rateLimit.js); it exists so that an
    // unauthenticated endpoint taking a guessable code is not the one place we
    // skip the rate limiter we already own.
    await enforceRateLimit({ supabase, action: "agent_pair_claim", sessionToken: clientIp(request) });

    const result = await claimPairingCode(supabase, { code });

    if (result.state === "pending") {
      // 202 is the "keep polling" signal. An empty body is what the client
      // expects; it only reads the body on a 2xx-with-token.
      return new Response(null, { status: 202 });
    }
    if (result.state === "invalid") {
      return Response.json({ error: result.reason || "unknown code" }, { status: 404 });
    }

    return Response.json({
      token: result.token,
      slug: result.slug,
      // ALWAYS returned, never conditional. Re-pairing is an explicit "connect
      // this Mac to that office", so it has to correct the ADDRESS as well as
      // the credential — a helper holding a stale endpoint looks connected and
      // posts into the void, which is the exact silent failure this flow exists
      // to remove. The helper overwrites on Some(value) and leaves the existing
      // value alone on None, so omitting this is what strands a bad address.
      //
      // Derived from NEXT_PUBLIC_APP_URL, NOT from request.url. This app is
      // behind Vercel's proxy, so request.url is whatever reached the lambda
      // and is not a reliable statement of where the deployment publicly lives;
      // in local dev it is not even the address the helper uses (NEXT_PUBLIC_APP_URL
      // is an ngrok tunnel there). appUrl is the repo's existing answer to
      // exactly this question — src/server/slack.js builds every OAuth callback
      // from it, which has the same "must be the public origin" requirement. If
      // it is ever wrong the breakage is loud and shared rather than silent and
      // pairing-specific.
      endpoint: new URL("/api/agents/ingest", getServerEnv().appUrl).toString(),
    });
  } catch (error) {
    if (error?.status === 429) {
      // NOT a 4xx the client should read as "code spent" — pairing.rs treats
      // any client error other than 404/405/501 as Expired and stops polling.
      // 429 is in that bucket, so we send Retry-After and let the helper's own
      // 3-minute deadline decide, rather than killing a legitimate pairing.
      return Response.json({ error: "too many pairing attempts" }, { status: 429, headers: { "retry-after": "60" } });
    }
    return serverError(error);
  }
}

// Vercel sets x-forwarded-for; the first entry is the client. Falls back to a
// constant so a missing header degrades to one shared bucket rather than to no
// limiting at all.
function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  return ip || "unknown-client";
}

// If migration 0010 has not run, the query throws and serverError returns 500.
// That is the right failure: pairing.rs reads any 5xx as `Unavailable` and stops
// polling with a "can't pair right now" message, rather than as `Expired`, so
// the user can retry once the migration lands without minting a new code.
export const dynamic = "force-dynamic";
