"use client";

import { useState } from "react";

export default function JoinModal({ recentSlug, navigate, close }) {
  const [joinValue, setJoinValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const slug = joinValue.match(/\/r\/([^/\s]+)/)?.[1] || joinValue.replace(/^#?\/?r\//, "");
    if (slug) navigate(`/r/${slug}`);
    close();
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="join-title">join a space</h2>
        <p className="panel-copy">paste a mumbl link or jump into the latest local room.</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            invite link or slug
            <input value={joinValue} onChange={(event) => setJoinValue(event.target.value)} autoComplete="off" placeholder="backend-gremlins" />
          </label>
          <div className="join-actions">
            <button className="solid-button" type="submit">
              join
            </button>
            <button className="ghost-button" type="button" onClick={close}>
              cancel
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                navigate(`/r/${recentSlug}`);
                close();
              }}
            >
              open {recentSlug}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
