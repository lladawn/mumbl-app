"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authHeader, getAuthSession } from "../../src/lib/auth";

/**
 * "Connect <device> to <space>?" — the one human moment in device pairing.
 *
 * The desktop helper opened this URL (pairing.rs::authorize_url) and is already
 * polling /api/agents/pair/claim. Everything this page does is on behalf of a
 * SIGNED-IN user: the server decides which space the account may connect a
 * machine to, mints a device-scoped token, and binds it to the code. The token
 * itself never touches this page — it goes straight to the app that is polling.
 *
 * The screen has to answer three questions before anyone clicks: what is asking
 * (device name, from the helper), what it will be able to do (post activity to
 * one office, nothing else), and how to undo it (revoke that one Mac).
 */

const WRAP = {
  maxWidth: "34rem",
  margin: "0 auto",
  padding: "4.5rem 1.5rem 6rem",
};
const CARD = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "14px",
  padding: "1.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};
const ROW = { display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.95rem" };
const MUTED = { opacity: 0.68 };
const NOTE = { fontSize: "0.85rem", lineHeight: 1.6, ...MUTED };

export default function PairClient() {
  const params = useSearchParams();
  const code = (params.get("code") || "").trim();
  const nameParam = (params.get("name") || "").trim();

  const [phase, setPhase] = useState("loading"); // loading | signin | ready | done | error
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!code) {
      setPhase("error");
      setError("This link is missing its pairing code. Click “Connect my office” in the helper again.");
      return;
    }
    const session = await getAuthSession();
    if (!session?.user?.id) {
      setPhase("signin");
      return;
    }
    try {
      const headers = await authHeader();
      const query = new URLSearchParams({ code, name: nameParam });
      const res = await fetch(`/api/agents/pair/authorize?${query.toString()}`, {
        headers,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { setPhase("signin"); return; }
      if (!res.ok) throw new Error(data.error || `could not load pairing (${res.status})`);
      if (data.alreadyClaimed) {
        setPhase("error");
        setError("This code has already been used. Click “Connect my office” in the helper for a fresh one.");
        return;
      }
      setInfo(data);
      setPhase(data.alreadyAuthorized ? "done" : data.space ? "ready" : "error");
      if (!data.space) {
        setError(
          "This account has no office yet. Create one first, then click “Connect my office” again."
        );
      }
    } catch (e) {
      setPhase("error");
      setError(e.message || "could not load this pairing request");
    }
  }, [code, nameParam]);

  useEffect(() => { load(); }, [load]);

  async function authorize() {
    setBusy(true);
    setError("");
    try {
      const headers = await authHeader();
      const res = await fetch("/api/agents/pair/authorize", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ code, name: info?.deviceName || nameParam }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `could not authorize (${res.status})`);
      setInfo((prev) => ({ ...prev, ...data }));
      setPhase("done");
    } catch (e) {
      setError(e.message || "could not authorize this device");
    } finally {
      setBusy(false);
    }
  }

  const device = info?.deviceName || nameParam || "this device";
  const space = info?.space;

  return (
    <section style={WRAP}>
      <p className="eyebrow">office · connect a device</p>

      {phase === "loading" && <p style={MUTED}>Checking this pairing request…</p>}

      {phase === "signin" && (
        <div style={CARD}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Sign in to connect {device}</h1>
          <p style={NOTE}>
            Pairing hands a machine a token that can post to your office, so it has to be
            you doing it. Sign in and come back to this page — the helper is still waiting.
          </p>
          <a className="solid-button button-link" href={`/dump?next=${encodeURIComponent(currentPath())}`}>
            sign in
          </a>
          <button className="ghost-button" type="button" onClick={load}>
            I&rsquo;ve signed in — check again
          </button>
        </div>
      )}

      {phase === "ready" && space && (
        <div style={CARD}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            Connect {device} to {space.name || space.slug}?
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={ROW}><span style={MUTED}>device</span><strong>{device}</strong></div>
            <div style={ROW}><span style={MUTED}>office</span><strong>/office/{space.slug}</strong></div>
            <div style={ROW}><span style={MUTED}>code</span><code>{code}</code></div>
          </div>
          <p style={NOTE}>
            This creates a token for <strong>this Mac only</strong>. It can post activity to
            this one office and nothing else — it cannot read your office, list who is in it,
            or touch your account. You can disconnect this Mac on its own at any time, which
            leaves your other machines alone.
          </p>
          {error && <p style={{ color: "#b3261e", fontSize: "0.9rem" }}>{error}</p>}
          <button className="solid-button" type="button" onClick={authorize} disabled={busy}>
            {busy ? "connecting…" : "Authorize"}
          </button>
          <p style={{ ...NOTE, marginTop: 0 }}>
            Didn&rsquo;t start this? Close this tab and nothing happens — the code expires on
            its own.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div style={CARD}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{device} is connected</h1>
          <p style={NOTE}>
            You can close this tab. The helper picks the connection up within a few seconds
            and your office starts filling in as you work.
          </p>
          {space && (
            <a className="ghost-button button-link" href={`/office/${space.slug}`}>
              open /office/{space.slug}
            </a>
          )}
        </div>
      )}

      {phase === "error" && (
        <div style={CARD}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Can&rsquo;t connect this device</h1>
          <p style={NOTE}>{error}</p>
          <button className="ghost-button" type="button" onClick={load}>
            try again
          </button>
        </div>
      )}
    </section>
  );
}

function currentPath() {
  if (typeof window === "undefined") return "/pair";
  return window.location.pathname + window.location.search;
}
