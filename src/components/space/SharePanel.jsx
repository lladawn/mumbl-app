"use client";

import { getRoomAccessToken } from "../../lib/storage";

export default function SharePanel({ space, copyText }) {
  const accessToken = getRoomAccessToken(space.slug);
  const path = `/r/${space.slug}/reads${accessToken ? `?key=${encodeURIComponent(accessToken)}` : ""}`;
  const url = typeof window === "undefined" ? path : `${location.origin}${path}`;

  return (
    <div className={`panel share-panel ${space.firstPostDone ? "ready" : ""}`}>
      <h3>invite link</h3>
      <p className="panel-copy">
        {space.firstPostDone ? "send people to the reads when something is ready." : "invite teammates when the first team read is ready."}
      </p>
      <div className="share-link-row">
        <div className="share-link" title={url}>
          {url}
        </div>
        <button className="share-button primary" type="button" onClick={() => copyText(url, "link copied. go cause a small amount of honesty.", "link")}>
          copy
        </button>
      </div>
      <div className="share-actions">
        <button className="share-button" type="button" onClick={() => copyText(`made a mumbl for us: ${url}\n\nprivate dumps can become team reads when they are ready.`, "slack note copied.", "slack")}>
          slack
        </button>
        <button className="share-button" type="button" onClick={() => copyText(`just set up a mumbl for the team - private work thoughts, published as team reads by choice.\n\nread with us: ${url}`, "x post copied.", "x")}>
          x post
        </button>
        <button className="share-button" type="button" onClick={() => copyText(`made us a mumbl: ${url}\n\nteam reads and heartbeat, without turning Slack into a diary.`, "whatsapp note copied.", "whatsapp")}>
          whatsapp
        </button>
      </div>
    </div>
  );
}
