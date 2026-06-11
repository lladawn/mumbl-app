"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import AccountControl from "./AccountControl";
import JoinModal from "./JoinModal";

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [joinOpen, setJoinOpen] = useState(false);
  const recentSlug = useRecentSlug();
  const dumpActive = pathname?.startsWith("/dump");
  const missionActive = pathname?.startsWith("/mission");

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
          <Link className={`topbar-link ${dumpActive ? "active" : ""}`} href="/dump" aria-current={dumpActive ? "page" : undefined}>
            dump
          </Link>
          <button className="topbar-link" type="button" onClick={() => setJoinOpen(true)}>
            join<span className="topbar-label-extra"> a space</span>
          </button>
        </nav>
        <div className="topbar-actions">
          <AccountControl />
          <Link className="topbar-create button-link" href="/create">
            create<span className="topbar-label-extra"> space</span>
          </Link>
        </div>
      </header>

      <main aria-live="polite">{children}</main>

      {joinOpen && (
        <JoinModal
          recentSlug={recentSlug}
          close={() => setJoinOpen(false)}
          navigate={(path) => router.push(path)}
        />
      )}
    </div>
  );
}
