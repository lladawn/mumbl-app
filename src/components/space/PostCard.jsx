"use client";

import { getReactionLabels } from "../../lib/heartbeat";
import { timeAgo } from "../../lib/storage";

export default function PostCard({ space, post, toggleReaction }) {
  const author = post.isAnonymous ? "anonymous" : post.displayName || "someone brave";
  const initials = post.isAnonymous ? "?" : (post.displayName || "m").trim().charAt(0).toLowerCase();
  const reactionLabels = getReactionLabels(space, post);

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
            return (
              <button
                className={`reaction-button ${active ? "active" : ""}`}
                type="button"
                key={label}
                onClick={() => toggleReaction({ postId: post.id, label })}
              >
                {label} · {count}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
