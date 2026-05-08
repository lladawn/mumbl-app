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

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    submitPost({ content: trimmed, displayName: displayName.trim() });
    setContent("");
    setDisplayName("");
  }

  return (
    <form className={`compose ${space.firstPostDone ? "" : "you-first"}`} onSubmit={handleSubmit}>
      <div className="compose-header">
        <p className="compose-title">
          {space.firstPostDone ? "what's mumbl saying?" : "you first - what's actually on your mind this week?"}
        </p>
        <button className={`anon-toggle ${composeAnonymous ? "" : "off"}`} type="button" onClick={() => setComposeAnonymous(!composeAnonymous)}>
          {composeAnonymous ? "anonymous on" : "posting with handle"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={420}
        placeholder={postTypes[selectedType].placeholder || vibes[space.vibe].placeholder}
        required
      />
      <label className={`display-name-row ${composeAnonymous ? "hidden" : ""}`}>
        display handle
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="off" placeholder="e.g. sam from infra" />
      </label>
      <div className="type-grid">
        {Object.entries(postTypes).map(([key, type]) => (
          <button className={`type-button ${selectedType === key ? "active" : ""}`} type="button" key={key} onClick={() => setSelectedType(key)}>
            <strong>{type.label}</strong>
            <span>{type.hint}</span>
          </button>
        ))}
      </div>
      <div className="feed-actions" style={{ marginTop: 14 }}>
        <button className="solid-button" type="submit">
          drop it on mumbl
        </button>
        {!space.firstPostDone && (
          <button className="ghost-button" type="button" onClick={() => dismissFirstPost(space.slug)}>
            show the share link anyway
          </button>
        )}
      </div>
    </form>
  );
}
