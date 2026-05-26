import { cleanString } from "./validation";

export function normalizeHandle(value) {
  return cleanString(value, 32)
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);
}

export function isValidHandle(handle) {
  return /^[a-z0-9][a-z0-9_-]{1,29}$/.test(handle);
}

export function serializePublicProfile(profile, fieldNotes = []) {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.display_name || profile.handle,
    bio: profile.bio || "",
    createdAt: new Date(profile.created_at).getTime(),
    posts: fieldNotes.map(serializePublicFieldNote),
  };
}

export function serializePublicFieldNote(note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    publishedAt: note.public_published_at ? new Date(note.public_published_at).getTime() : null,
    createdAt: new Date(note.created_at).getTime(),
  };
}
