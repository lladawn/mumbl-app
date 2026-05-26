export function serializeDump(dump) {
  return {
    id: dump.id,
    content: dump.content,
    visibility: dump.visibility,
    teamRoomId: dump.team_room_id || "",
    aiReflection: dump.ai_reflection || "",
    supermemoryId: dump.supermemory_id || "",
    supermemoryStatus: dump.supermemory_status || "",
    publishedAt: dump.published_at ? new Date(dump.published_at).getTime() : null,
    createdAt: new Date(dump.created_at).getTime(),
    updatedAt: new Date(dump.updated_at).getTime(),
  };
}

export function serializeFieldNote(note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    sourceDumpIds: note.source_dump_ids || [],
    teamRoomId: note.team_room_id || "",
    isPublished: note.is_published || false,
    publishedPostId: note.published_post_id || "",
    isPublic: note.is_public || false,
    publicProfileId: note.public_profile_id || "",
    createdAt: new Date(note.created_at).getTime(),
    publishedAt: note.published_at ? new Date(note.published_at).getTime() : null,
    publicPublishedAt: note.public_published_at ? new Date(note.public_published_at).getTime() : null,
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
