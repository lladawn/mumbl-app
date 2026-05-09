"use client";

import { useCallback, useEffect, useState } from "react";
import { createRemotePost, dismissRemoteFirstPost, fetchSpace, toggleRemoteReaction, updateRemoteSpaceVisibility } from "../lib/api";

export function useRemoteSpace(slug) {
  const [space, setSpace] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!slug) return;
    setStatus("loading");
    setError("");
    try {
      setSpace(await fetchSpace(slug));
      setStatus("ready");
    } catch (fetchError) {
      setSpace(null);
      setError(fetchError.message || "couldn't load this mumbl");
      setStatus(fetchError.message === "space not found" ? "not-found" : "error");
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitPost(input) {
    await createRemotePost({ slug, ...input });
    await refresh();
  }

  async function toggleReaction(input) {
    await toggleRemoteReaction(input);
    await refresh();
  }

  async function dismissFirstPost() {
    await dismissRemoteFirstPost(slug);
    await refresh();
  }

  async function updateVisibility(input) {
    await updateRemoteSpaceVisibility({ slug, ...input });
    await refresh();
  }

  return {
    space,
    status,
    error,
    refresh,
    submitPost,
    toggleReaction,
    dismissFirstPost,
    updateVisibility,
  };
}
