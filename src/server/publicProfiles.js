import { cleanString } from "./validation";
import { decryptContentFields, decryptContentRows } from "./encryption";

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
  const readableProfile = decryptContentFields("public_profiles", profile, ["display_name", "bio"]);
  const readableFieldNotes = decryptContentRows("field_notes", fieldNotes, ["title", "content"]);
  return {
    id: readableProfile.id,
    handle: readableProfile.handle,
    displayName: readableProfile.display_name || readableProfile.handle,
    bio: readableProfile.bio || "",
    createdAt: new Date(readableProfile.created_at).getTime(),
    posts: readableFieldNotes.map(serializePublicFieldNote),
  };
}

export function serializePublicFieldNote(note) {
  const readableNote = decryptContentFields("field_notes", note, ["title", "content"]);
  return {
    id: readableNote.id,
    title: readableNote.title,
    content: readableNote.content,
    publishedAt: readableNote.public_published_at ? new Date(readableNote.public_published_at).getTime() : null,
    createdAt: new Date(readableNote.created_at).getTime(),
  };
}
