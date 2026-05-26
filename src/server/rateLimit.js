import { hashToken } from "./hash";
import { getServerEnv } from "./env";

const LIMITS = {
  post: { limit: 5, windowSeconds: 10 * 60 },
  reaction: { limit: 80, windowSeconds: 60 },
  side_quest_create: { limit: 6, windowSeconds: 10 * 60 },
  side_quest_pick: { limit: 20, windowSeconds: 10 * 60 },
  side_quest_message: { limit: 60, windowSeconds: 5 * 60 },
  field_note: { limit: 20, windowSeconds: 24 * 60 * 60 },
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
