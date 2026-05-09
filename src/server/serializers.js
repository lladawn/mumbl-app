export function serializeSpace(space, posts = [], heartbeats = [], reactionRows = [], activeReactionRows = []) {
  const activeReactionKeys = new Set(activeReactionRows.map((row) => `${row.post_id}:${row.label}`));

  return {
    id: space.id,
    slug: space.slug,
    name: space.name,
    vibe: space.vibe,
    memberCount: space.member_count,
    firstPostDone: space.first_post_done,
    isPublic: space.is_public || false,
    publicName: space.public_name || "",
    createdAt: new Date(space.created_at).getTime(),
    posts: posts.map((post) => serializePost(post, reactionRows, activeReactionKeys)),
    heartbeats: heartbeats.map(serializeHeartbeat),
  };
}

export function serializePost(post, reactionRows = [], activeReactionKeys = new Set()) {
  const reactions = {};
  const activeReactions = [];

  for (const row of reactionRows) {
    if (row.post_id !== post.id) continue;
    reactions[row.label] = row.count;
    if (activeReactionKeys.has(`${post.id}:${row.label}`)) {
      activeReactions.push(row.label);
    }
  }

  return {
    id: post.id,
    type: post.type,
    content: post.content,
    isAnonymous: post.is_anonymous,
    displayName: post.display_name || "",
    createdAt: new Date(post.created_at).getTime(),
    reactions,
    activeReactions,
  };
}

export function serializeHeartbeat(heartbeat) {
  return {
    id: heartbeat.id,
    weekOf: heartbeat.week_of,
    vibeRead: heartbeat.vibe_read,
    digest: heartbeat.digest,
    uplift: heartbeat.uplift,
    createdAt: new Date(heartbeat.created_at).getTime(),
  };
}

export function summariseReactions(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.post_id}:${row.label}`;
    counts.set(key, {
      post_id: row.post_id,
      label: row.label,
      count: (counts.get(key)?.count || 0) + 1,
    });
  }
  return [...counts.values()];
}
