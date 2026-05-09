"use client";

import { useState } from "react";
import { getReactionLabels } from "../../lib/heartbeat";
import { timeAgo } from "../../lib/storage";

export default function PostCard({ space, post, toggleReaction }) {
  const author = post.isAnonymous ? "anonymous" : post.displayName || "someone brave";
  const initials = post.isAnonymous ? "?" : (post.displayName || "m").trim().charAt(0).toLowerCase();
  const reactionLabels = getReactionLabels(space, post);
  const [pendingLabel, setPendingLabel] = useState("");

  async function handleReaction(label) {
    if (pendingLabel) return;

    setPendingLabel(label);
    try {
      await toggleReaction({ postId: post.id, label });
    } finally {
      setPendingLabel("");
    }
  }

  return (
    <article className="post-card">
      <span className="avatar">{initials}</span>
      <div>
        <div className="post-meta">
          <strong>{author}</strong>
          <span>{timeAgo(post.createdAt)}</span>
          <span className={`badge ${post.type}`}>{post.type}</span>
        </div>
        <p className="post-text">{post.content}</p>
        <div className="post-footer">
          {reactionLabels.map((label) => {
            const reactionValue = post.reactions?.[label] || 0;
            const count = Array.isArray(reactionValue) ? reactionValue.length : reactionValue;
            const active = post.activeReactions?.includes(label) || false;
            const isPending = pendingLabel === label;
            return (
              <button
                className={`reaction-button ${active ? "active" : ""} ${isPending ? "pending" : ""}`}
                type="button"
                key={label}
                onClick={() => handleReaction(label)}
                disabled={Boolean(pendingLabel)}
                aria-busy={isPending}
              >
                {isPending && <span className="mini-loader" aria-hidden="true" />}
                {label} · {count}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
