import { hashToken } from "./hash";
import { getServerEnv } from "./env";

const LIMITS = {
  post: { limit: 5, windowSeconds: 10 * 60 },
  reaction: { limit: 80, windowSeconds: 60 },
  side_quest_create: { limit: 6, windowSeconds: 10 * 60 },
  side_quest_pick: { limit: 20, windowSeconds: 10 * 60 },
  side_quest_message: { limit: 60, windowSeconds: 5 * 60 },
  field_note: { limit: 20, windowSeconds: 24 * 60 * 60 },
  // hooks fire per tool call, so this is per space and much higher than the
  // human-facing actions above
  agent_ingest: { limit: 300, windowSeconds: 60 },
  // keyed on the booking host, not a visitor session: a public booking link is
  // an unauthenticated way to make the app send mail, so the ceiling has to be
  // per link. Generous for a real calendar, useless as a spam relay.
  booking_create: { limit: 20, windowSeconds: 60 * 60 },
  // Device pairing claims, keyed on client IP because the endpoint is
  // deliberately unauthenticated (see app/api/agents/pair/claim). The helper
  // polls every 2s for up to 3 minutes — 30 requests/minute for ONE pairing —
  // and a shared office NAT can have several people pairing at once, so the
  // ceiling has to clear that comfortably or the limiter breaks the feature it
  // is protecting. 240/min still caps guessing at ~350k/day against a ~1.5e9
  // code space (8 chars, 14-symbol alphabet) that also expires in 10 minutes.
  agent_pair_claim: { limit: 240, windowSeconds: 60 },
};

export async function enforceRateLimit({ supabase, action, sessionToken }) {
  const config = getLimitConfig(action);
  if (!config || !sessionToken) return;

  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
    p_session_token_hash: hashToken(sessionToken),
    p_window_start: windowStartIso(config.windowSeconds),
    p_limit: config.limit,
  });
  if (error) throw error;

  if (!allowed) {
    const rateLimitError = new Error("rate limit exceeded for " + action);
    rateLimitError.status = 429;
    throw rateLimitError;
  }
}

function getLimitConfig(action) {
  if (action === "field_note") {
    return {
      ...LIMITS.field_note,
      limit: getServerEnv().openAiMaxDailyDrafts,
    };
  }

  return LIMITS[action];
}

function windowStartIso(windowSeconds) {
  const now = Date.now();
  return new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
}
