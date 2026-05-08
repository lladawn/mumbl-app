export const SESSION_KEY = "mumbl:session";
export const RECENT_SPACE_KEY = "mumbl:recent-space";
export const CREATOR_TOKEN_PREFIX = "mumbl:creator-token:";

export function loadSession() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function getRecentSlug(fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(RECENT_SPACE_KEY) || fallback;
}

export function rememberRecentSlug(slug) {
  window.localStorage.setItem(RECENT_SPACE_KEY, slug);
}

export function saveCreatorToken(slug, token) {
  window.localStorage.setItem(`${CREATOR_TOKEN_PREFIX}${slug}`, token);
}

export function getCreatorToken(slug) {
  return window.localStorage.getItem(`${CREATOR_TOKEN_PREFIX}${slug}`) || "";
}

export function timeAgo(timestamp) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
