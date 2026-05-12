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

async function parseJson(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "mumbl api request failed");
  }
  return data;
}
