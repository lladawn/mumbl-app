"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import JoinModal from "./JoinModal";

export default function AppShell({ children }) {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const recentSlug = useRecentSlug();

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="go to mumbl home">
          <span className="brand-mark" aria-hidden="true">
            m
          </span>
          <span>mumbl</span>
        </Link>
        <div className="topbar-actions">
          <Link className="ghost-button button-link" href="/mission">
            mission
          </Link>
          <button className="ghost-button" type="button" onClick={() => setJoinOpen(true)}>
            join a space
          </button>
          <Link className="solid-button button-link" href="/create">
            create space
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
