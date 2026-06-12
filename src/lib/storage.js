export const SESSION_KEY = "mumbl:session";
export const RECENT_SPACE_KEY = "mumbl:recent-space";
export const CREATOR_TOKEN_PREFIX = "mumbl:creator-token:";
export const POST_EDIT_TOKEN_PREFIX = "mumbl:post-edit-token:";

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

export function forgetRecentSlug(slug) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(RECENT_SPACE_KEY) === slug) {
    window.localStorage.removeItem(RECENT_SPACE_KEY);
  }
}

export function saveCreatorToken(slug, token) {
  window.localStorage.setItem(`${CREATOR_TOKEN_PREFIX}${slug}`, token);
}

export function getCreatorToken(slug) {
  return window.localStorage.getItem(`${CREATOR_TOKEN_PREFIX}${slug}`) || "";
}

export function clearCreatorToken(slug) {
  window.localStorage.removeItem(`${CREATOR_TOKEN_PREFIX}${slug}`);
}

export function savePostEditToken(postId, token) {
  if (!postId || !token) return;
  window.localStorage.setItem(`${POST_EDIT_TOKEN_PREFIX}${postId}`, token);
}

export function getPostEditToken(postId) {
  return window.localStorage.getItem(`${POST_EDIT_TOKEN_PREFIX}${postId}`) || "";
}

export function deletePostEditToken(postId) {
  window.localStorage.removeItem(`${POST_EDIT_TOKEN_PREFIX}${postId}`);
}

export function listCreatorTokens() {
  if (typeof window === "undefined") return [];
  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(CREATOR_TOKEN_PREFIX))
    .map((key) => ({
      slug: key.slice(CREATOR_TOKEN_PREFIX.length),
      token: window.localStorage.getItem(key) || "",
    }))
    .filter((item) => item.slug && item.token);
}

export function listPostEditTokens() {
  if (typeof window === "undefined") return [];
  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(POST_EDIT_TOKEN_PREFIX))
    .map((key) => ({
      postId: key.slice(POST_EDIT_TOKEN_PREFIX.length),
      token: window.localStorage.getItem(key) || "",
    }))
    .filter((item) => item.postId && item.token)
    .slice(0, 200);
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
