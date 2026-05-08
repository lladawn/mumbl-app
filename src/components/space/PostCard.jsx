"use client";

import { getReactionLabels } from "../../lib/heartbeat";
import { timeAgo } from "../../lib/storage";

export default function PostCard({ space, post, sessionToken, toggleReaction }) {
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
            const reactors = post.reactions?.[label] || [];
            const active = reactors.includes(sessionToken);
            return (
              <button
                className={`reaction-button ${active ? "active" : ""}`}
                type="button"
                key={label}
                onClick={() => toggleReaction({ slug: space.slug, postId: post.id, label, sessionToken })}
              >
                {label} · {reactors.length}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
