"use client";

import { useState } from "react";
import { publicDemoRoom } from "../lib/constants";

export default function JoinModal({ recentSlug, savedRooms, navigate, close }) {
  const [joinValue, setJoinValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const slug = joinValue.match(/\/r\/([^/\s]+)/)?.[1] || joinValue.replace(/^#?\/?r\//, "");
    if (slug) navigate(`/r/${slug}`);
    close();
  }

  const rooms = savedRooms || [];
  const loadingRooms = savedRooms === null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="join-title">join a space</h2>
        <p className="panel-copy">paste a mumbl link or slug. no signup, no ceremony.</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            invite link or slug
            <input value={joinValue} onChange={(event) => setJoinValue(event.target.value)} autoComplete="off" placeholder="tiny-fires" />
          </label>
          <div className="join-actions">
            <button className="solid-button" type="submit">
              join
            </button>
            <button className="ghost-button" type="button" onClick={close}>
              cancel
            </button>
          </div>
        </form>

        {(loadingRooms || rooms.length > 0) && (
          <div className="join-saved-rooms">
            <span className="join-saved-rooms-label">your rooms</span>
            {loadingRooms ? (
              <p className="join-saved-rooms-empty">loading…</p>
            ) : (
              <ul className="join-saved-rooms-list">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <button
                      className="join-saved-room-item"
                      type="button"
                      onClick={() => { navigate(`/r/${room.slug}/reads`); close(); }}
                    >
                      <span className="join-saved-room-name">{room.name}</span>
                      <span className="join-saved-room-slug">{room.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="join-open-room">
          <span>no invite yet?</span>
          <strong>{publicDemoRoom.slug}</strong>
          <p>open a public sample read. real team rooms stay private by default.</p>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              navigate(publicDemoRoom.href);
              close();
            }}
          >
            open sample reads
          </button>
        </div>
      </div>
    </div>
  );
}
