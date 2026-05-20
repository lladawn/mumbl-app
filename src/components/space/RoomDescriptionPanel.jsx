"use client";

import { useState } from "react";
import { trackEvent } from "../../lib/analytics";

export default function RoomDescriptionPanel({ space, updateDescription, onToast }) {
  const [description, setDescription] = useState(space.description || "");
  const [savedDescription, setSavedDescription] = useState(space.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const cleanDescription = description.trim();
  const hasChanges = cleanDescription !== savedDescription;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      await updateDescription({ description: cleanDescription });
      setSavedDescription(cleanDescription);
      trackEvent("room_description_saved", { hasDescription: Boolean(cleanDescription) });
      onToast(cleanDescription ? "room note saved." : "room note cleared.");
    } catch (error) {
      trackEvent("room_description_save_failed");
      onToast(error.message || "couldn't save the room note.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel room-note-panel" onSubmit={handleSubmit} aria-busy={isSaving}>
      <div>
        <h3>room note</h3>
        <p className="panel-copy">optional context for people opening the link. short is better.</p>
      </div>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={180}
        placeholder="e.g. messy thoughts from the platform team. no polished takes required."
        disabled={isSaving}
      />
      <div className="room-note-actions">
        <span>{180 - description.length} left</span>
        <button className={`share-button primary button-with-loader ${hasChanges ? "" : "saved"}`} type="submit" disabled={isSaving || !hasChanges}>
          {isSaving && <span className="mini-loader" aria-hidden="true" />}
          {isSaving ? "saving..." : hasChanges ? "save note" : "saved"}
        </button>
      </div>
    </form>
  );
}
