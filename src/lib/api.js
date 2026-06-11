import {
  clearCreatorToken,
  deletePostEditToken,
  forgetRecentSlug,
  getCreatorToken,
  getPostEditToken,
  loadSession,
  rememberRecentSlug,
  saveCreatorToken,
  savePostEditToken,
} from "./storage";
import { authRequestContext } from "./auth";

export async function joinWaitlist({ email }) {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseJson(response);
}

export async function fetchSpace(slug, { limit, before, type } = {}) {
  const sessionToken = loadSession();
  const auth = await authRequestContext();
  const params = new URLSearchParams({ sessionToken });
  if (limit) params.set("limit", String(limit));
  if (before) params.set("before", before);
  if (type) params.set("type", type);

  const response = await fetch(`/api/spaces/${slug}?${params.toString()}`, {
    headers: auth.headers,
    cache: "no-store",
  });
  const data = await parseJson(response);
  rememberRecentSlug(slug);
  return data.space;
}

export async function createRemoteSpace({ name, vibe }) {
  const auth = await authRequestContext();
  const response = await fetch("/api/spaces", {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ name, vibe, sessionToken: loadSession() }),
  });
  const data = await parseJson(response);
  saveCreatorToken(data.slug, data.creatorToken);
  rememberRecentSlug(data.slug);
  return data;
}

export async function createRemotePost({ slug, type, content, isAnonymous, displayName, promptId }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}/posts`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({
      type,
      content,
      isAnonymous,
      displayName,
      promptId,
      sessionToken: loadSession(),
    }),
  });
  const data = await parseJson(response);
  if (data.post?.id && data.editToken) savePostEditToken(data.post.id, data.editToken);
  return data;
}

export async function fetchDumps() {
  const sessionToken = loadSession();
  const auth = await authRequestContext();
  const params = privateSessionParams(sessionToken, auth);
  const response = await fetch(`/api/dumps?${params.toString()}`, {
    headers: auth.headers,
    cache: "no-store",
  });
  return parseJson(response);
}

export async function fetchDumpMap({ includePrivateDumps = false } = {}) {
  const sessionToken = loadSession();
  const auth = await authRequestContext();
  const params = privateSessionParams(sessionToken, auth);
  if (includePrivateDumps) params.set("includePrivateDumps", "true");
  const response = await fetch(`/api/dumps/map?${params.toString()}`, {
    headers: auth.headers,
    cache: "no-store",
  });
  return parseJson(response);
}

export async function createDump({ content, wantsReflection = false }) {
  const auth = await authRequestContext();
  const response = await fetch("/api/dumps", {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ content, wantsReflection, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function updateDump({ dumpId, content, wantsReflection = false }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/${dumpId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ content, wantsReflection, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function deleteDump(dumpId) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/${dumpId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function deleteDumps({ dumpIds }) {
  const auth = await authRequestContext();
  const response = await fetch("/api/dumps", {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ dumpIds, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function shareDumpToRoom({ dumpId, slug, isAnonymous = true, displayName = "" }) {
  const response = await fetch(`/api/dumps/${dumpId}/team`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, isAnonymous, displayName, sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function draftFieldNote({ dumpIds }) {
  const auth = await authRequestContext();
  const response = await fetch("/api/dumps/field-notes/draft", {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ dumpIds, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function publishFieldNote({ fieldNoteId, slug, title, content, isAnonymous = true, displayName = "" }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/field-notes/${fieldNoteId}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ slug, title, content, isAnonymous, displayName, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  const data = await parseJson(response);
  rememberRecentSlug(slug);
  return data;
}

export async function updateFieldNote({ fieldNoteId, title, content }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/field-notes/${fieldNoteId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ title, content, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function deleteFieldNote(fieldNoteId) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/field-notes/${fieldNoteId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function updateRemoteSpaceVisibility({ slug, isPublic, publicName }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({
      creatorToken: getCreatorToken(slug),
      isPublic,
      publicName,
    }),
  });
  return parseJson(response);
}

export async function updateRemoteSpaceDescription({ slug, description }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({
      creatorToken: getCreatorToken(slug),
      description,
    }),
  });
  return parseJson(response);
}

export async function deleteRemoteSpace({ slug }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ creatorToken: getCreatorToken(slug) }),
  });
  const data = await parseJson(response);
  clearCreatorToken(slug);
  forgetRecentSlug(slug);
  return data;
}

export async function updateRemotePost({ postId, content }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/posts/${postId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ content, editToken: getPostEditToken(postId), sessionToken: loadSession() }),
  });
  return parseJson(response);
}

export async function deleteRemotePost({ postId, slug }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/posts/${postId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({
      editToken: getPostEditToken(postId),
      creatorToken: getCreatorToken(slug),
      sessionToken: loadSession(),
    }),
  });
  const data = await parseJson(response);
  deletePostEditToken(postId);
  return data;
}

export async function startSlackTeamReadsSetup({ slug }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}/slack/team-reads/setup`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ creatorToken: getCreatorToken(slug) }),
  });
  return parseJson(response);
}

export async function updateSlackTeamReadsPosting({ slug, postingEnabled }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}/slack/team-reads`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ creatorToken: getCreatorToken(slug), postingEnabled }),
  });
  return parseJson(response);
}

export async function pinSlackSpaceForPublishing({ slug }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}/slack/pin`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
  });
  return parseJson(response);
}

export async function dismissRemoteFirstPost(slug) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/spaces/${slug}/first-post-dismissed`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ creatorToken: getCreatorToken(slug) }),
  });
  return parseJson(response);
}

export async function toggleRemoteReaction({ postId, label }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/posts/${postId}/reactions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
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

export async function fetchPublicProfileForSession() {
  const auth = await authRequestContext();
  const params = privateSessionParams(loadSession(), auth);
  const response = await fetch(`/api/public-profiles?${params.toString()}`, {
    headers: auth.headers,
    cache: "no-store",
  });
  return parseJson(response);
}

export async function savePublicProfile({ handle, displayName = "", bio = "" }) {
  const auth = await authRequestContext();
  const response = await fetch("/api/public-profiles", {
    method: "POST",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ handle, displayName, bio, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

export async function setFieldNotePublic({ fieldNoteId, isPublic, handle }) {
  const auth = await authRequestContext();
  const response = await fetch(`/api/dumps/field-notes/${fieldNoteId}/public`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth.headers },
    body: JSON.stringify({ isPublic, handle, sessionToken: loadSession(), expectsAuthenticatedOwner: auth.expectsAuthenticatedOwner }),
  });
  return parseJson(response);
}

function privateSessionParams(sessionToken, auth) {
  const params = new URLSearchParams({ sessionToken });
  if (auth.expectsAuthenticatedOwner) params.set("expectsAuthenticatedOwner", "true");
  return params;
}

async function parseJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!isJson) {
    const text = await response.text().catch(() => "");
    const fallback = response.ok ? "mumbl expected JSON but got a non-JSON response" : "mumbl api request returned a non-JSON error";
    throw new Error(`${fallback} (${response.status} ${response.url})${text.includes("<!DOCTYPE") ? "" : `: ${text.slice(0, 160)}`}`);
  }

  if (!response.ok) {
    throw new Error(data.error || "mumbl api request failed");
  }
  return data;
}
