"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createRemotePost,
  deleteRemotePost,
  deleteRemoteSpace,
  dismissRemoteFirstPost,
  fetchSpace,
  pinSlackSpaceForPublishing,
  startSlackTeamReadsSetup,
  toggleRemoteReaction,
  updateRemotePost,
  updateSlackTeamReadsPosting,
  updateRemoteSpaceDescription,
  updateRemoteSpaceVisibility,
} from "../lib/api";

const POST_PAGE_SIZE = 20;

export function useRemoteSpace(slug, postType = "") {
  const [space, setSpace] = useState(null);
  const [status, setStatus] = useState("loading");
  const [pageStatus, setPageStatus] = useState("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!slug) return;
    setStatus("loading");
    setError("");
    try {
      setSpace(await fetchSpace(slug, { limit: POST_PAGE_SIZE, type: postType }));
      setStatus("ready");
    } catch (fetchError) {
      setSpace(null);
      setError(fetchError.message || "couldn't load this mumbl");
      setStatus(fetchError.message === "space not found" ? "not-found" : "error");
    }
  }, [slug, postType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitPost(input) {
    await createRemotePost({ slug, ...input });
    await refresh();
  }

  async function toggleReaction(input) {
    const result = await toggleRemoteReaction(input);
    setSpace((currentSpace) => updatePostReaction(currentSpace, input, result.active));
  }

  async function updatePost(input) {
    await updateRemotePost(input);
    await refresh();
  }

  async function deletePost(input) {
    await deleteRemotePost({ slug, ...input });
    await refresh();
  }

  async function loadOlderPosts() {
    if (!slug || !space?.postsPage?.hasMore || pageStatus === "loading") return;

    setPageStatus("loading");
    setError("");
    try {
      const nextSpace = await fetchSpace(slug, {
        limit: POST_PAGE_SIZE,
        before: space.postsPage.nextCursor,
        type: postType,
      });
      setSpace((currentSpace) => mergePostPage(currentSpace, nextSpace));
      setPageStatus("idle");
    } catch (fetchError) {
      setError(fetchError.message || "couldn't load older mumbls");
      setPageStatus("error");
      throw fetchError;
    }
  }

  async function dismissFirstPost() {
    await dismissRemoteFirstPost(slug);
    await refresh();
  }

  async function updateVisibility(input) {
    await updateRemoteSpaceVisibility({ slug, ...input });
    await refresh();
  }

  async function updateDescription(input) {
    await updateRemoteSpaceDescription({ slug, ...input });
    await refresh();
  }

  async function startTeamReadsSlackSetup() {
    return startSlackTeamReadsSetup({ slug });
  }

  async function updateTeamReadsSlackPosting(input) {
    await updateSlackTeamReadsPosting({ slug, ...input });
    await refresh();
  }

  async function pinTeamReadsSlackSpace() {
    return pinSlackSpaceForPublishing({ slug });
  }

  async function deleteSpace() {
    return deleteRemoteSpace({ slug });
  }

  return {
    space,
    status,
    error,
    refresh,
    pageStatus,
    submitPost,
    toggleReaction,
    updatePost,
    deletePost,
    loadOlderPosts,
    dismissFirstPost,
    updateVisibility,
    updateDescription,
    startTeamReadsSlackSetup,
    pinTeamReadsSlackSpace,
    updateTeamReadsSlackPosting,
    deleteSpace,
  };
}

function mergePostPage(currentSpace, nextSpace) {
  if (!currentSpace) return nextSpace;

  const knownPostIds = new Set(currentSpace.posts.map((post) => post.id));
  const olderPosts = nextSpace.posts.filter((post) => !knownPostIds.has(post.id));
  const mergedPosts = [...currentSpace.posts, ...olderPosts];
  const currentCount = currentSpace.postsPage?.count || 0;
  const nextCount = nextSpace.postsPage?.count || 0;

  return {
    ...currentSpace,
    roomVibe: nextSpace.roomVibe,
    heartbeats: nextSpace.heartbeats,
    postsPage: {
      ...nextSpace.postsPage,
      count: Math.max(currentCount, nextCount, mergedPosts.length),
    },
    posts: mergedPosts,
  };
}

function updatePostReaction(space, input, active) {
  if (!space) return space;

  return {
    ...space,
    posts: space.posts.map((post) => {
      if (post.id !== input.postId) return post;

      const currentCount = post.reactions?.[input.label] || 0;
      const activeReactions = new Set(post.activeReactions || []);
      if (active) {
        activeReactions.add(input.label);
      } else {
        activeReactions.delete(input.label);
      }

      return {
        ...post,
        reactions: {
          ...post.reactions,
          [input.label]: Math.max(0, currentCount + (active ? 1 : -1)),
        },
        activeReactions: [...activeReactions],
      };
    }),
  };
}
