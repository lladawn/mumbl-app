"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
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
  const [productsOpen, setProductsOpen] = useState(false);
  const productsRef = useRef(null);
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
  const officeActive = pathname?.startsWith("/office");
  const productsActive = slackActive || officeActive;
  // The room surfaces (/dump, /create, /explore, /r/*) stay live so existing
  // rooms and Slack installs keep working — they are just out of the top nav
  // while the landing tells the agent-collaborator story.
  const isPublicFront = homeActive || visionActive || slackActive || officeActive;

  // Close products dropdown on outside click or Escape
  useEffect(() => {
    if (!productsOpen) return;
    function handleClick(e) {
      if (productsRef.current && !productsRef.current.contains(e.target)) {
        setProductsOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setProductsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [productsOpen]);

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
          {/* Products dropdown */}
          <div className="topbar-products" ref={productsRef}>
            <button
              className={`topbar-link topbar-products-toggle ${productsActive ? "active" : ""}`}
              type="button"
              aria-haspopup="true"
              aria-expanded={productsOpen}
              onClick={() => setProductsOpen((v) => !v)}
            >
              products<span className="topbar-label-extra">&nbsp;▾</span>
            </button>
            {productsOpen && (
              <div className="topbar-dropdown" role="menu">
                <Link
                  className={`topbar-dropdown-item ${officeActive ? "active" : ""}`}
                  href="/office"
                  role="menuitem"
                  aria-current={officeActive ? "page" : undefined}
                  onClick={() => { setProductsOpen(false); trackPublicCta("office_landing", { source: "topbar" }); }}
                >
                  <span className="topbar-dropdown-label">office</span>
                  <span className="topbar-dropdown-hint">your day, drawn live</span>
                </Link>
                <Link
                  className={`topbar-dropdown-item ${slackActive ? "active" : ""}`}
                  href="/slack"
                  role="menuitem"
                  aria-current={slackActive ? "page" : undefined}
                  onClick={() => { setProductsOpen(false); trackPublicCta("slack_landing", { source: "topbar" }); }}
                >
                  <span className="topbar-dropdown-label">slack</span>
                  <span className="topbar-dropdown-hint">save the why behind your work</span>
                </Link>
              </div>
            )}
          </div>
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
