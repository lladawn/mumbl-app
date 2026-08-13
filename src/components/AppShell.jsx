"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { fetchSavedRooms } from "../lib/api";
import { trackPublicCta } from "../lib/analytics";
import AccountControl from "./AccountControl";
import JoinModal from "./JoinModal";

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [joinOpen, setJoinOpen] = useState(false);
  const [savedRooms, setSavedRooms] = useState(null);
  const recentSlug = useRecentSlug();

  const openJoin = useCallback(async () => {
    setJoinOpen(true);
    if (savedRooms !== null) return;
    try {
      const data = await fetchSavedRooms();
      setSavedRooms(data.savedRooms || []);
    } catch {
      setSavedRooms([]);
    }
  }, [savedRooms]);
  const homeActive = pathname === "/";
  const visionActive = pathname?.startsWith("/slack/vision");
  const slackActive = pathname === "/slack" || visionActive;
  // The room surfaces (/dump, /create, /explore, /r/*) stay live so existing
  // rooms and Slack installs keep working — they are just out of the top nav
  // while the landing tells the agent-collaborator story.
  const isPublicFront = homeActive || visionActive || slackActive;

  return (
    <div className={`shell ${homeActive ? "shell-soft" : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="go to mumbl home">
          <span className="brand-mark" aria-hidden="true">
            m
          </span>
          <span>mumbl</span>
        </Link>
        <nav className="topbar-nav" aria-label="mumbl navigation">
          <a className="topbar-link" href="/demo" onClick={() => trackPublicCta("demo", { source: "topbar" })}>
            demo
          </a>
          <Link className={`topbar-link ${slackActive ? "active" : ""}`} href="/slack" aria-current={slackActive ? "page" : undefined} onClick={() => trackPublicCta("slack_landing", { source: "topbar" })}>
            for<span className="topbar-label-extra">&nbsp;slack</span>
          </Link>
          {!isPublicFront && (
            <button className="topbar-link" type="button" onClick={openJoin}>
              join{" "}<span className="topbar-label-extra">a&nbsp;space</span>
            </button>
          )}
        </nav>
        <div className="topbar-actions">
          {isPublicFront ? (
            <Link className="topbar-create button-link" href="/#waitlist">
              join<span className="topbar-label-extra">&nbsp;waitlist</span>
            </Link>
          ) : (
            <>
              <AccountControl />
              <Link className="topbar-create button-link" href="/create">create{" "}<span className="topbar-label-extra">space</span></Link>
            </>
          )}
        </div>
      </header>

      <main aria-live="polite">{children}</main>

      {joinOpen && (
        <JoinModal
          recentSlug={recentSlug}
          savedRooms={savedRooms}
          close={() => setJoinOpen(false)}
          navigate={(path) => router.push(path)}
        />
      )}
    </div>
  );
}
