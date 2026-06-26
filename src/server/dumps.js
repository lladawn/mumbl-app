import { decryptContentFields } from "./encryption";

export function serializeDump(dump) {
  const readableDump = decryptContentFields("dumps", dump, ["content", "ai_reflection", "source_meta"]);
  return {
    id: readableDump.id,
    content: readableDump.content,
    visibility: readableDump.visibility,
    teamRoomId: readableDump.team_room_id || "",
    aiReflection: readableDump.ai_reflection || "",
    source: readableDump.source || "web",
    sourceMeta: readableDump.source_meta || {},
    publishedAt: readableDump.published_at ? new Date(readableDump.published_at).getTime() : null,
    createdAt: new Date(readableDump.created_at).getTime(),
    updatedAt: new Date(readableDump.updated_at).getTime(),
  };
}

export function serializeFieldNote(note) {
  const readableNote = decryptContentFields("field_notes", note, ["title", "content"]);
  return {
    id: readableNote.id,
    title: readableNote.title,
    content: readableNote.content,
    sourceDumpIds: readableNote.source_dump_ids || [],
    teamRoomId: readableNote.team_room_id || "",
    isPublished: readableNote.is_published || false,
    publishedPostId: readableNote.published_post_id || "",
    isPublic: readableNote.is_public || false,
    publicProfileId: readableNote.public_profile_id || "",
    createdAt: new Date(readableNote.created_at).getTime(),
    publishedAt: readableNote.published_at ? new Date(readableNote.published_at).getTime() : null,
    publicPublishedAt: readableNote.public_published_at ? new Date(readableNote.public_published_at).getTime() : null,
  };
}

export function makeLocalReflection(content) {
  const text = content.toLowerCase();
  if (text.includes("stuck") || text.includes("blocked")) {
    return "ai heard this: there is a stuck thread here. what part feels blocked by the work, and what part feels blocked by the room around it?";
  }
  if (text.includes("tired") || text.includes("burn") || text.includes("exhaust")) {
    return "ai heard this: this sounds less like laziness and more like load. what would make tomorrow ten percent lighter?";
  }
  if (text.includes("win") || text.includes("shipped") || text.includes("fixed")) {
    return "ai heard this: there is a small win in here. what made it possible, and who else should know it mattered?";
  }
  if (text.includes("meeting") || text.includes("standup") || text.includes("process")) {
    return "ai heard this: the process is taking up emotional space. what is the smallest part you wish someone would just name out loud?";
  }
  return "ai heard this: there is a real thread here. what are you trying to understand by putting it down?";
}
