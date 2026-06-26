"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { fetchSavedRooms } from "../lib/api";
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
  const dumpActive = pathname?.startsWith("/dump") || pathname?.startsWith("/patterns");
  const missionActive = pathname?.startsWith("/mission");
  const isHome = pathname === "/";

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="go to mumbl home">
          <span className="brand-mark" aria-hidden="true">
            m
          </span>
          <span>mumbl</span>
        </Link>
        <nav className="topbar-nav" aria-label="mumbl navigation">
          <Link className={`topbar-link ${missionActive ? "active" : ""}`} href="/mission" aria-current={missionActive ? "page" : undefined}>
            mission
          </Link>
          {isHome ? (
            <a className="topbar-link" href="#team-reads">
              examples
            </a>
          ) : (
            <>
              <Link className={`topbar-link ${dumpActive ? "active" : ""}`} href="/dump" aria-current={dumpActive ? "page" : undefined}>
                dump
              </Link>
              <button className="topbar-link" type="button" onClick={openJoin}>
                join<span className="topbar-label-extra"> a space</span>
              </button>
            </>
          )}
        </nav>
        <div className="topbar-actions">
          {isHome ? (
            <a className="topbar-create button-link" href="/api/slack/install" target="_blank" rel="noreferrer">
              add to slack
            </a>
          ) : (
            <>
              <AccountControl />
              <Link className="topbar-create button-link" href="/create">
                create<span className="topbar-label-extra"> space</span>
              </Link>
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
