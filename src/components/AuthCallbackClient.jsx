"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { completeMagicLinkSession } from "../lib/auth";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("finishing login...");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function finishLogin() {
      try {
        const providerError = searchParams.get("error_description") || searchParams.get("error");
        if (providerError) throw new Error(decodeAuthError(providerError));
        const code = searchParams.get("code") || "";
        const next = safeNextPath(searchParams.get("next"));
        await completeMagicLinkSession(code);
        if (!mounted) return;
        setStatus("dump restored. taking you back...");
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
        <h1>{error ? "that link didn't land" : "keeping your dump"}</h1>
        <p>{error || status}</p>
        {error && (
          <Link className="solid-button button-link" href="/dump">
            back to dump
          </Link>
        )}
      </div>
    </section>
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
