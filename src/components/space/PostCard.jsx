"use client";

import { useEffect, useState } from "react";
import ExpandableText from "../ExpandableText";
import { EditIcon, TrashIcon } from "../ActionIcons";
import { getReactionLabels } from "../../lib/heartbeat";
import { timeAgo } from "../../lib/storage";

const authorEditableTypes = new Set(["find", "thought", "rant", "win", "lol"]);

export default function PostCard({
  space,
  post,
  toggleReaction,
  updatePost,
  deletePost,
  showReactions = true,
  canManage = false,
  canAuthorEdit = false,
}) {
  const author = post.isAnonymous ? "anonymous" : post.displayName || "someone brave";
  const initials = post.isAnonymous ? "?" : (post.displayName || "m").trim().charAt(0).toLowerCase();
  const reactionLabels = getReactionLabels(space, post);
  const [pendingLabel, setPendingLabel] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isMutating, setIsMutating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canEdit = canAuthorEdit && authorEditableTypes.has(post.type) && Boolean(updatePost);
  const canDelete = (canAuthorEdit || canManage) && Boolean(deletePost);

  useEffect(() => {
    setEditContent(post.content);
    setConfirmDelete(false);
  }, [post.content]);

  async function handleReaction(label) {
    if (pendingLabel) return;

    setPendingLabel(label);
    try {
      await toggleReaction({ postId: post.id, label });
    } finally {
      setPendingLabel("");
    }
  }

  async function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed || isMutating || !canEdit) return;
    setIsMutating(true);
    try {
      await updatePost({ postId: post.id, content: trimmed });
      setIsEditing(false);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsMutating(true);
    try {
      await deletePost({ postId: post.id });
    } finally {
      setIsMutating(false);
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
        {isEditing ? (
          <div className="post-edit-box">
            <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={420} disabled={isMutating} />
            <span>{editContent.trim().length} / 420</span>
          </div>
        ) : (
          <ExpandableText className="post-text" text={post.content} limit={post.type === "field_note" ? 520 : 720} />
        )}
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
        {(canEdit || canDelete) && (
          <div className="post-actions">
            {isEditing ? (
              <>
                <button className="solid-button button-with-loader" type="button" onClick={handleSaveEdit} disabled={isMutating}>
                  {isMutating && <span className="mini-loader" aria-hidden="true" />}
                  save
                </button>
                <button className="ghost-button" type="button" onClick={() => setIsEditing(false)} disabled={isMutating}>
                  cancel
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button
                    className="ghost-button icon-action-button"
                    type="button"
                    onClick={() => setIsEditing(true)}
                    disabled={isMutating}
                    aria-label="edit post"
                    title="edit post"
                  >
                    <EditIcon />
                  </button>
                )}
                {canDelete && (
                  <button
                    className={`ghost-button danger ${confirmDelete ? "" : "icon-action-button"}`}
                    type="button"
                    onClick={handleDelete}
                    disabled={isMutating}
                    aria-label={canManage && !canAuthorEdit ? "delete post as creator" : "delete post"}
                    title={canManage && !canAuthorEdit ? "delete post as creator" : "delete post"}
                  >
                    {confirmDelete ? "delete forever" : <TrashIcon />}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
