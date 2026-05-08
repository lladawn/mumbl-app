"use client";

export default function SharePanel({ space, copyText }) {
  const url = typeof window === "undefined" ? `/r/${space.slug}` : `${location.origin}/r/${space.slug}`;

  return (
    <div className={`panel share-panel ${space.firstPostDone ? "ready" : ""}`}>
      <h3>invite link</h3>
      <p className="panel-copy">{space.firstPostDone ? "send it where work thoughts already leak." : "it exists. the first post matters more."}</p>
      <div className="share-link-row">
        <div className="share-link" title={url}>
          {url}
        </div>
        <button className="share-button primary" type="button" onClick={() => copyText(url, "link copied. go cause a small amount of honesty.")}>
          copy
        </button>
      </div>
      <div className="share-actions">
        <button className="share-button" type="button" onClick={() => copyText(`made a mumbl for us: ${url}\n\nanonymous-first. say the thing before it becomes a meeting.`, "slack note copied.")}>
          slack
        </button>
        <button className="share-button" type="button" onClick={() => copyText(`just set up a mumbl for the team - where we can actually be honest at work, anonymously.\n\njoin us: ${url}`, "x post copied.")}>
          x post
        </button>
        <button className="share-button" type="button" onClick={() => copyText(`made us a mumbl: ${url}\n\nanonymous, quick, and hopefully less awkward than another retro.`, "whatsapp note copied.")}>
          whatsapp
        </button>
      </div>
    </div>
  );
}
