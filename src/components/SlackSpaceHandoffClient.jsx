"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeader } from "../lib/auth";
import { rememberRecentSlug, saveCreatorToken, saveRoomAccessToken } from "../lib/storage";

export default function SlackSpaceHandoffClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("bringing the creator key into this browser...");

  useEffect(() => {
    let mounted = true;

    async function consumeHandoff() {
      try {
        const handoffId = searchParams.get("id") || "";
        const handoffToken = searchParams.get("token") || "";
        if (!handoffId || !handoffToken) throw new Error("that Slack room link is missing its handoff token.");

        const headers = await authHeader();
        const response = await fetch("/api/slack/spaces/handoff", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ handoffId, handoffToken }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "couldn't open that Slack-created room.");
        if (!mounted) return;

        saveCreatorToken(result.slug, result.creatorToken);
        saveRoomAccessToken(result.slug, result.accessToken);
        rememberRecentSlug(result.slug);
        setStatus(result.creatorLinked ? "creator access linked. opening team reads..." : "creator access saved. opening team reads...");
        router.replace(`/r/${result.slug}/reads${result.accessToken ? `?key=${encodeURIComponent(result.accessToken)}` : ""}`);
      } catch (handoffError) {
        if (!mounted) return;
        setError(handoffError.message || "couldn't open that Slack-created room.");
      }
    }

    consumeHandoff();
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">slack</p>
        <h1>{error ? "that room link expired" : "opening team reads"}</h1>
        <p>{error || status}</p>
        {error && (
          <Link className="solid-button button-link" href="/create">
            create a fresh room
          </Link>
        )}
      </div>
    </section>
  );
}
