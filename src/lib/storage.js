import { sampleSpace } from "./demoData";

export const STORAGE_KEY = "mumbl:v1";
export const SESSION_KEY = "mumbl:session";

export function loadInitialState() {
  if (typeof window === "undefined") {
    return { spaces: { [sampleSpace.slug]: sampleSpace }, recentSlug: sampleSpace.slug };
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return { spaces: { [sampleSpace.slug]: sampleSpace }, recentSlug: sampleSpace.slug };
}

export function loadSession() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function uniqueSlug(base, spaces) {
  let slug = base || "team-mumbl";
  let suffix = 2;
  while (spaces[slug]) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
}

export function randomMemberCount() {
  return Math.floor(Math.random() * 8) + 3;
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
