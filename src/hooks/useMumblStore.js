"use client";

import { useEffect, useState } from "react";
import { makeHeartbeat } from "../lib/heartbeat";
import {
  loadInitialState,
  randomMemberCount,
  slugify,
  STORAGE_KEY,
  uniqueSlug,
} from "../lib/storage";

export function useMumblStore() {
  const [state, setState] = useState(loadInitialState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function updateSpaces(updater) {
    setState((current) => {
      const next = structuredClone(current);
      updater(next);
      return next;
    });
  }

  function createSpace(name, vibe) {
    const slug = uniqueSlug(slugify(name), state.spaces);
    const space = {
      id: crypto.randomUUID(),
      slug,
      name: name.toLowerCase(),
      vibe,
      memberCount: randomMemberCount(),
      firstPostDone: false,
      posts: [],
      heartbeats: [makeHeartbeat({ name, vibe, posts: [] })],
      creatorToken: crypto.randomUUID(),
    };

    setState((current) => ({
      spaces: { ...current.spaces, [slug]: space },
      recentSlug: slug,
    }));

    return slug;
  }

  function submitPost({ slug, type, content, isAnonymous, displayName }) {
    updateSpaces((draft) => {
      const space = draft.spaces[slug];
      space.posts.unshift({
        id: crypto.randomUUID(),
        type,
        content,
        isAnonymous,
        displayName: isAnonymous ? "" : displayName || "someone brave",
        createdAt: Date.now(),
        reactions: {},
      });
      space.firstPostDone = true;
      space.memberCount = Math.max(
        space.memberCount,
        Math.min(99, space.memberCount + Math.round(Math.random())),
      );
      space.heartbeats = [makeHeartbeat(space)];
      draft.recentSlug = slug;
    });
  }

  function toggleReaction({ slug, postId, label, sessionToken }) {
    updateSpaces((draft) => {
      const space = draft.spaces[slug];
      const post = space?.posts.find((item) => item.id === postId);
      if (!post) return;

      post.reactions[label] = post.reactions[label] || [];
      if (post.reactions[label].includes(sessionToken)) {
        post.reactions[label] = post.reactions[label].filter(
          (token) => token !== sessionToken,
        );
      } else {
        post.reactions[label].push(sessionToken);
      }
      space.heartbeats = [makeHeartbeat(space)];
    });
  }

  function dismissFirstPost(slug) {
    updateSpaces((draft) => {
      draft.spaces[slug].firstPostDone = true;
    });
  }

  return {
    state,
    createSpace,
    submitPost,
    toggleReaction,
    dismissFirstPost,
  };
}
