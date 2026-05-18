"use client";

import { useState } from "react";
import { trackEvent } from "../../lib/analytics";

export default function PublicSpacePanel({ space, updateVisibility, onToast }) {
  const [isPublic, setIsPublic] = useState(space.isPublic);
  const [publicName, setPublicName] = useState(space.publicName || space.name);
  const [savedSettings, setSavedSettings] = useState({
    isPublic: space.isPublic,
    publicName: space.publicName || space.name,
  });
  const [isSaving, setIsSaving] = useState(false);
  const cleanPublicName = publicName.trim();
  const hasChanges =
    isPublic !== savedSettings.isPublic ||
    (isPublic && cleanPublicName !== savedSettings.publicName);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      await updateVisibility({ isPublic, publicName: cleanPublicName });
      setSavedSettings({ isPublic, publicName: cleanPublicName });
      trackEvent("public_space_saved", { enabled: isPublic });
      onToast(isPublic ? "this space now contributes anonymised themes." : "this space is private again.");
    } catch (error) {
      trackEvent("public_space_save_failed", { enabled: isPublic });
      onToast(error.message || "couldn't update explore settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel public-panel" onSubmit={handleSubmit} aria-busy={isSaving}>
      <h3>mumbl explore</h3>
      <p className="panel-copy">
        optional. only aggregate themes later, never individual posts. space names stay hidden unless you set one here.
      </p>
      <button
        className={`anon-toggle public-toggle ${isPublic ? "" : "off"}`}
        type="button"
        onClick={() => setIsPublic((value) => !value)}
        disabled={isSaving}
      >
        {isPublic ? "contributing" : "private"}
      </button>
      <label className={isPublic ? "" : "hidden"}>
        public display name
        <input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder={space.name} disabled={isSaving} />
      </label>
      <button className={`share-button primary button-with-loader ${hasChanges ? "" : "saved"}`} type="submit" disabled={isSaving || !hasChanges}>
        {isSaving && <span className="mini-loader" aria-hidden="true" />}
        {isSaving ? "saving..." : hasChanges ? "save changes" : "saved"}
      </button>
    </form>
  );
}
