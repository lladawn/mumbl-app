import { hashToken } from "./hash";

const LIMITS = {
  post: { limit: 5, windowSeconds: 10 * 60 },
  reaction: { limit: 80, windowSeconds: 60 },
};

export async function enforceRateLimit({ supabase, action, sessionToken }) {
  const config = LIMITS[action];
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

function windowStartIso(windowSeconds) {
  const now = Date.now();
  return new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
}
