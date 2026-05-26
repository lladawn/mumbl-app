export const SESSION_KEY = "mumbl:session";
export const RECENT_SPACE_KEY = "mumbl:recent-space";
export const CREATOR_TOKEN_PREFIX = "mumbl:creator-token:";
export const DUMP_MEMORY_OPT_IN_KEY = "mumbl:dump-memory-opt-in";

export function loadSession() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = createSessionToken();
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

export function getDumpMemoryOptIn() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DUMP_MEMORY_OPT_IN_KEY) === "true";
}

export function setDumpMemoryOptIn(isEnabled) {
  window.localStorage.setItem(DUMP_MEMORY_OPT_IN_KEY, isEnabled ? "true" : "false");
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

function createSessionToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();

  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
