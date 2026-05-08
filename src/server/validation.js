import { postTypes, vibes } from "../lib/constants";

export function cleanString(value, maxLength = 420) {
  return String(value || "").trim().slice(0, maxLength);
}

export function isValidVibe(value) {
  return Object.hasOwn(vibes, value);
}

export function isValidPostType(value) {
  return Object.hasOwn(postTypes, value);
}

export function slugify(text) {
  return cleanString(text, 64)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
}
