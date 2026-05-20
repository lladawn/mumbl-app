import { getCreatorToken, loadSession, rememberRecentSlug, saveCreatorToken } from "./storage";

export async function fetchSpace(slug) {
  const sessionToken = loadSession();
  const response = await fetch(`/api/spaces/${slug}?sessionToken=${encodeURIComponent(sessionToken)}`, {
    cache: "no-store",
  });
  const data = await parseJson(response);
  rememberRecentSlug(slug);
  return data.space;
}

export async function createRemoteSpace({ name, vibe }) {
  const response = await fetch("/api/spaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, vibe }),
  });
  const data = await parseJson(response);
  saveCreatorToken(data.slug, data.creatorToken);
  rememberRecentSlug(data.slug);
  return data;
}

export async function createRemotePost({ slug, type, content, isAnonymous, displayName, promptId }) {
  const response = await fetch(`/api/spaces/${slug}/posts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type,
      content,
      isAnonymous,
      displayName,
      promptId,
      sessionToken: loadSession(),
    }),
  });
  return parseJson(response);
}

export async function updateRemoteSpaceVisibility({ slug, isPublic, publicName }) {
  const response = await fetch(`/api/spaces/${slug}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      creatorToken: getCreatorToken(slug),
      isPublic,
      publicName,
    }),
  });
  return parseJson(response);
}

export async function updateRemoteSpaceDescription({ slug, description }) {
  const response = await fetch(`/api/spaces/${slug}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      creatorToken: getCreatorToken(slug),
      description,
    }),
  });
  return parseJson(response);
}

export async function dismissRemoteFirstPost(slug) {
  const response = await fetch(`/api/spaces/${slug}/first-post-dismissed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creatorToken: getCreatorToken(slug) }),
  });
  return parseJson(response);
}

export async function toggleRemoteReaction({ postId, label }) {
  const response = await fetch(`/api/posts/${postId}/reactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label, sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function fetchSideQuests(slug) {
  const sessionToken = loadSession();
  const response = await fetch(`/api/spaces/${slug}/side-quests?sessionToken=${encodeURIComponent(sessionToken)}`, {
    cache: "no-store",
  });
  return parseJson(response);
}

export async function createSideQuest({ slug, kind, context }) {
  const response = await fetch(`/api/spaces/${slug}/side-quests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, context, sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function heartbeatSideQuest({ slug, cardId }) {
  const response = await fetch(`/api/spaces/${slug}/side-quests/${cardId}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function pickSideQuest({ slug, cardId }) {
  const response = await fetch(`/api/spaces/${slug}/side-quests/${cardId}/pick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function acceptSideQuest({ slug, cardId }) {
  const response = await fetch(`/api/spaces/${slug}/side-quests/${cardId}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function cancelSideQuest({ slug, cardId }) {
  const response = await fetch(`/api/spaces/${slug}/side-quests/${cardId}/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function fetchSideQuestRoom(roomId) {
  const sessionToken = loadSession();
  const response = await fetch(`/api/side-quest-rooms/${roomId}?sessionToken=${encodeURIComponent(sessionToken)}`, {
    cache: "no-store",
  });
  return parseJson(response);
}

export async function sendSideQuestMessage({ roomId, message }) {
  const response = await fetch(`/api/side-quest-rooms/${roomId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function leaveSideQuestRoom(roomId) {
  const response = await fetch(`/api/side-quest-rooms/${roomId}/leave`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function reportSideQuestRoom(roomId) {
  const response = await fetch(`/api/side-quest-rooms/${roomId}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  return parseJson(response);
}

async function parseJson(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "mumbl api request failed");
  }
  return data;
}
