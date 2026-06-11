"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { completeMagicLinkSession } from "../lib/auth";
import LoadingMark from "./LoadingMark";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("linking");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function finishLogin() {
      try {
        const providerError = searchParams.get("error_description") || searchParams.get("error");
        if (providerError) throw new Error(decodeAuthError(providerError));
        const code = searchParams.get("code") || "";
        const next = safeNextPath(searchParams.get("next"));
        setStatus("linking");
        await completeMagicLinkSession(code);
        if (!mounted) return;
        setStatus("returning");
        router.replace(next);
      } catch (authError) {
        if (!mounted) return;
        setError(authError.message || "couldn't finish that login.");
      }
    }

    finishLogin();
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <section className="auth-callback-view">
      <div className="modal auth-callback-card">
        <p className="eyebrow">login</p>
        <h1>{error ? "that link didn't land" : "restoring your mumbl session"}</h1>
        {error ? <p>{error}</p> : <AuthCallbackStatus status={status} />}
        {error && (
          <Link className="solid-button button-link" href="/dump">
            back to dump
          </Link>
        )}
      </div>
    </section>
  );
}

function AuthCallbackStatus({ status }) {
  const steps = [
    { id: "dump", label: "private dump" },
    { id: "rooms", label: "room controls" },
    { id: "return", label: "back to where you were" },
  ];
  const activeIndex = status === "returning" ? 2 : 1;

  return (
    <div className="auth-callback-status" aria-live="polite" aria-busy="true">
      <LoadingMark compact />
      <p>{status === "returning" ? "done. taking you back..." : "connecting this browser to your account..."}</p>
      <div className="auth-callback-steps" aria-label="login progress">
        {steps.map((step, index) => (
          <span className={index <= activeIndex ? "active" : ""} key={step.id}>
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function safeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dump";
  return value;
}

function decodeAuthError(value) {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return value;
  }
}
