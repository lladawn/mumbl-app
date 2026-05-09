"use client";

import { useState } from "react";

export default function PublicSpacePanel({ space, updateVisibility, onToast }) {
  const [isPublic, setIsPublic] = useState(space.isPublic);
  const [publicName, setPublicName] = useState(space.publicName || space.name);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateVisibility({ isPublic, publicName });
      onToast(isPublic ? "this space now contributes anonymised themes." : "this space is private again.");
    } catch (error) {
      onToast(error.message || "couldn't update explore settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel public-panel" onSubmit={handleSubmit}>
      <h3>mumbl explore</h3>
      <p className="panel-copy">
        optional. only aggregate themes later, never individual posts. space names stay hidden unless you set one here.
      </p>
      <button
        className={`anon-toggle public-toggle ${isPublic ? "" : "off"}`}
        type="button"
        onClick={() => setIsPublic((value) => !value)}
      >
        {isPublic ? "contributing" : "private"}
      </button>
      <label className={isPublic ? "" : "hidden"}>
        public display name
        <input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder={space.name} />
      </label>
      <button className="share-button primary" type="submit" disabled={isSaving}>
        {isSaving ? "saving..." : "save"}
      </button>
    </form>
  );
}
