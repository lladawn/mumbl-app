"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeader, getAuthSession, signInWithGoogle } from "../lib/auth";

export default function SlackConnectClient() {
  const searchParams = useSearchParams();
  const pendingId = searchParams.get("pending") || "";
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("checking your mumbl login...");
  const [webUrl, setWebUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    async function completeConnect() {
      try {
        if (!pendingId) throw new Error("that Slack save link is missing its pending dump.");
        const session = await getAuthSession();
        if (!mounted) return;
        if (!session?.user?.id) {
          setStatus("needs-login");
          setMessage("log in once so Slack knows which private dump is yours.");
          return;
        }

        setStatus("saving");
        setMessage("saving the thought you sent from Slack...");
        const headers = await authHeader();
        const response = await fetch("/api/slack/connect/complete", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ pendingId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "couldn't connect Slack yet.");
        if (!mounted) return;
        setStatus("done");
        setWebUrl(result.webUrl || "/dump");
        setMessage("saved. only you can see this.");
      } catch (error) {
        if (!mounted) return;
        setStatus("error");
        setMessage(error.message || "couldn't connect Slack yet.");
      }
    }

    completeConnect();
    return () => {
      mounted = false;
    };
  }, [pendingId]);

  async function handleLogin() {
    setStatus("logging-in");
    setMessage("sending you to login...");
    await signInWithGoogle(`/slack/connect?pending=${encodeURIComponent(pendingId)}`);
  }

  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">slack beta</p>
        <h1>{status === "done" ? "slack is connected" : "connect slack"}</h1>
        <p>{message}</p>
        {status === "needs-login" && (
          <button className="solid-button" type="button" onClick={handleLogin}>
            log in with google
          </button>
        )}
        {status === "done" && (
          <Link className="solid-button button-link" href={webUrl || "/dump"}>
            open in mumbl
          </Link>
        )}
        {status === "error" && (
          <Link className="ghost-button button-link" href="/dump">
            open your dump
          </Link>
        )}
      </div>
    </section>
  );
}
