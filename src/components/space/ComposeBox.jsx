"use client";

import { useState } from "react";
import { vibes } from "../../lib/constants";

export default function ComposeBox({
  space,
  postTypes,
  selectedType,
  setSelectedType,
  composeAnonymous,
  setComposeAnonymous,
  submitPost,
  dismissFirstPost,
}) {
  const [content, setContent] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitPost({ content: trimmed, displayName: displayName.trim() });
      setContent("");
      setDisplayName("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDismiss() {
    if (isDismissing) return;

    setIsDismissing(true);
    try {
      await dismissFirstPost(space.slug);
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <form className={`compose ${space.firstPostDone ? "" : "you-first"}`} onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="compose-header">
        <p className="compose-title">
          {space.firstPostDone ? "what's mumbl saying?" : "you first - what's actually on your mind this week?"}
        </p>
        <button
          className={`anon-toggle ${composeAnonymous ? "" : "off"}`}
          type="button"
          onClick={() => setComposeAnonymous(!composeAnonymous)}
          disabled={isSubmitting}
        >
          {composeAnonymous ? "anonymous on" : "posting with handle"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={420}
        placeholder={postTypes[selectedType].placeholder || vibes[space.vibe].placeholder}
        required
        disabled={isSubmitting}
      />
      <label className={`display-name-row ${composeAnonymous ? "hidden" : ""}`}>
        display handle
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="off"
          placeholder="e.g. sam from infra"
          disabled={isSubmitting}
        />
      </label>
      <div className="type-grid">
        {Object.entries(postTypes)
          .filter(([key]) => key !== "dump")
          .map(([key, type]) => (
          <button
            className={`type-button ${selectedType === key ? "active" : ""}`}
            type="button"
            key={key}
            onClick={() => setSelectedType(key)}
            disabled={isSubmitting}
          >
            <strong>{type.label}</strong>
            <span>{type.hint}</span>
          </button>
        ))}
      </div>
      <div className="feed-actions" style={{ marginTop: 14 }}>
        <button className="solid-button button-with-loader" type="submit" disabled={isSubmitting}>
          {isSubmitting && <span className="mini-loader" aria-hidden="true" />}
          {isSubmitting ? "dropping..." : "drop it on mumbl"}
        </button>
        {!space.firstPostDone && (
          <button className="ghost-button button-with-loader" type="button" onClick={handleDismiss} disabled={isDismissing || isSubmitting}>
            {isDismissing && <span className="mini-loader" aria-hidden="true" />}
            {isDismissing ? "unlocking..." : "show the share link anyway"}
          </button>
        )}
      </div>
    </form>
  );
}
