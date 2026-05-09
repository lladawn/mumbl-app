"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRemoteSpace } from "../lib/api";
import { vibes } from "../lib/constants";
import Toast from "./Toast";

export default function CreatePageClient() {
  const router = useRouter();
  const [spaceName, setSpaceName] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("chill");
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const name = spaceName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    setToast("");
    try {
      const { slug } = await createRemoteSpace({ name, vibe: selectedVibe });
      router.push(`/r/${slug}`);
    } catch (error) {
      setToast(error.message || "couldn't create that mumbl yet.");
      setIsCreating(false);
    }
  }

  return (
    <section className="create-view">
      <div className="create-grid">
        <div className="panel">
          <p className="eyebrow">create a room in 30 seconds</p>
          <h2>let's mumbl together.</h2>
          <p className="panel-copy">
            name the space, pick the room temperature, then drop the first honest thing before you invite everyone else
            in.
          </p>
          <form className="form-stack" onSubmit={handleSubmit} aria-busy={isCreating}>
            <label>
              space name
              <input
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                autoComplete="off"
                placeholder="backend team"
                required
                disabled={isCreating}
              />
            </label>
            <label>
              vibe
              <div className="vibe-grid">
                {Object.entries(vibes).map(([key, vibe]) => (
                  <button
                    className={`pill-button ${selectedVibe === key ? "active" : ""}`}
                    type="button"
                    key={key}
                    onClick={() => setSelectedVibe(key)}
                    disabled={isCreating}
                  >
                    <strong>{vibe.label}</strong>
                    <span>{vibe.hint}</span>
                  </button>
                ))}
              </div>
            </label>
            <div className="form-actions">
              <button className="solid-button button-with-loader" type="submit" disabled={isCreating}>
                {isCreating && <span className="mini-loader" aria-hidden="true" />}
                {isCreating ? "creating..." : "create space"}
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <h3>what happens next</h3>
          <p className="panel-copy">
            mumbl opens the room with the compose box first. the share link is there, but the best spaces start with the
            creator saying something real.
          </p>
          <div className="note-card">
            <h3>anonymous-first</h3>
            <p>posts default to anonymous. people can add a handle when they want the credit, not because the form made them.</p>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </section>
  );
}
