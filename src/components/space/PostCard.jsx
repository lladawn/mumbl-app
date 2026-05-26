"use client";

import { useState } from "react";
import ExpandableText from "../ExpandableText";
import { getReactionLabels } from "../../lib/heartbeat";
import { timeAgo } from "../../lib/storage";

export default function PostCard({ space, post, toggleReaction, showReactions = true }) {
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
    <article className={`post-card ${post.type === "dump" ? "dump-post" : ""}`}>
      <span className="avatar">{initials}</span>
      <div>
        <div className="post-meta">
          <strong>{author}</strong>
          <span>{timeAgo(post.createdAt)}</span>
          <span className={`badge ${post.type}`}>{post.type}</span>
        </div>
        {post.title && <h3 className="post-title">{post.title}</h3>}
        <ExpandableText className="post-text" text={post.content} limit={post.type === "field_note" ? 520 : 720} />
        {showReactions && (
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
        )}
      </div>
    </article>
  );
}
