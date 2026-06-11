import { feedbackRoom, publicDemoRoom } from "../lib/constants";

export function serializeSpace(space, posts = [], heartbeats = [], reactionRows = [], activeReactionRows = [], extras = {}) {
  const activeReactionKeys = new Set(activeReactionRows.map((row) => `${row.post_id}:${row.label}`));
  const accountEditablePostIds = extras.accountEditablePostIds || new Set();
  const knownRoomDescription = getKnownRoomDescription(space.slug);

  return {
    id: space.id,
    slug: space.slug,
    name: space.name,
    description: space.description || knownRoomDescription || "",
    vibe: space.vibe,
    firstPostDone: space.first_post_done,
    isPublic: space.is_public || false,
    publicName: space.public_name || "",
    createdAt: new Date(space.created_at).getTime(),
    dailyPrompt: extras.dailyPrompt ? serializePrompt(extras.dailyPrompt) : null,
    slackTeamReads: extras.slackTeamReads ? serializeSlackTeamReads(extras.slackTeamReads) : null,
    canManage: extras.canManage === true,
    roomVibe: extras.roomVibe || [],
    postsPage: extras.postsPage || {
      limit: posts.length,
      count: posts.length,
      hasMore: false,
      nextCursor: "",
      type: "",
    },
    posts: posts.map((post) => serializePost(post, reactionRows, activeReactionKeys, { canAuthorEdit: accountEditablePostIds.has(post.id) })),
    heartbeats: heartbeats.map(serializeHeartbeat),
  };
}

function serializeSlackTeamReads(row) {
  return {
    channelId: row.slack_channel_id || "",
    channelName: row.slack_channel_name || "",
    postingEnabled: row.posting_enabled === true,
    isPrivate: row.is_private !== false,
    lastPostedAt: row.last_posted_at ? new Date(row.last_posted_at).getTime() : null,
    lastPostError: row.last_post_error || "",
    lastPostErrorAt: row.last_post_error_at ? new Date(row.last_post_error_at).getTime() : null,
  };
}

function getKnownRoomDescription(slug) {
  if (slug === publicDemoRoom.slug) return publicDemoRoom.description;
  if (slug === feedbackRoom.slug) return feedbackRoom.description;
  return "";
}

function serializePrompt(prompt) {
  return {
    id: prompt.id,
    persistedId: prompt.id,
    date: prompt.prompt_date,
    text: prompt.prompt_text,
    tone: prompt.tone,
    isShuffled: false,
  };
}

export function serializePost(post, reactionRows = [], activeReactionKeys = new Set(), extras = {}) {
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
    title: post.field_note_title || "",
    isAnonymous: post.is_anonymous,
    displayName: post.display_name || "",
    promptId: post.prompt_id || "",
    dumpId: post.dump_id || "",
    createdAt: new Date(post.created_at).getTime(),
    reactions,
    activeReactions,
    canAuthorEdit: extras.canAuthorEdit === true,
  };
}

export function serializeHeartbeat(heartbeat) {
  return {
    id: heartbeat.id,
    weekOf: heartbeat.week_of,
    vibeRead: heartbeat.vibe_read,
    digest: heartbeat.digest,
    uplift: heartbeat.uplift,
    vibeWord: heartbeat.vibe_word || "alive",
    topTheme: heartbeat.top_theme || "general work weather",
    energyLevel: heartbeat.energy_level ?? 50,
    cardLine: heartbeat.card_line || heartbeat.vibe_read,
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
