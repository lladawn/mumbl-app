"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dispatchAuthChanged, getAuthSession, getBrowserSupabase, signInWithGoogle, signOutOfDump } from "../lib/auth";

export default function AccountControl() {
  const [authState, setAuthState] = useState({ status: "checking", email: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [loginStatus, setLoginStatus] = useState("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setMounted(true);

    async function syncSession() {
      try {
        const session = await withTimeout(getAuthSession(), 3500);
        if (!isMounted) return;
        setAuthState(stateFromSession(session));
      } catch {
        if (isMounted) setAuthState({ status: "anonymous", email: "" });
      }
    }

    let subscription;
    syncSession();
    getBrowserSupabase()
      .then((supabase) => {
        if (!isMounted) return;
        const result = supabase.auth.onAuthStateChange((event, session) => {
          setAuthState(stateFromSession(session));
          if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
            dispatchAuthChanged({ status: session?.user ? "authenticated" : "anonymous" });
          }
        });
        subscription = result.data?.subscription;
      })
      .catch(() => {
        if (isMounted) setAuthState({ status: "anonymous", email: "" });
      });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    if (loginStatus === "sending") return;
    setLoginStatus("sending");
    const next = `${window.location.pathname}${window.location.search}`;
    try {
      await signInWithGoogle(next || "/dump");
    } catch {
      setLoginStatus("idle");
    }
  }

  async function handleLogout() {
    if (loginStatus === "sending") return;
    setLoginStatus("sending");
    try {
      await signOutOfDump();
      setAuthState({ status: "anonymous", email: "" });
      setModalOpen(false);
      dispatchAuthChanged({ status: "anonymous" });
    } finally {
      setLoginStatus("idle");
    }
  }

  function openModal() {
    setLoginStatus("idle");
    setModalOpen(true);
  }

  function closeModal() {
    if (loginStatus === "sending") return;
    setModalOpen(false);
    setLoginStatus("idle");
  }

  if (authState.status === "checking") {
    return (
      <span className="account-control is-loading" aria-label="checking login">
        account
      </span>
    );
  }

  if (authState.status === "authenticated") {
    return (
      <>
        <button className="account-control is-authenticated" type="button" onClick={openModal}>
          <span title={authState.email}>{authState.email || "logged in"}</span>
        </button>
        {mounted && modalOpen
          ? createPortal(
              <AccountModal
                authState={authState}
                close={closeModal}
                loginStatus={loginStatus}
                loginWithGoogle={handleLogin}
                logout={handleLogout}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <>
      <button className="account-control" type="button" onClick={openModal}>
        log in
      </button>
      {mounted && modalOpen
        ? createPortal(
            <AccountModal
              authState={authState}
              close={closeModal}
              loginStatus={loginStatus}
              loginWithGoogle={handleLogin}
              logout={handleLogout}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function stateFromSession(session) {
  return session?.user
    ? { status: "authenticated", email: session.user.email || "" }
    : { status: "anonymous", email: "" };
}

async function withTimeout(promise, timeoutMs) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("login check timed out")), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function AccountModal({ authState, close, loginStatus, loginWithGoogle, logout }) {
  const isSending = loginStatus === "sending";
  const isAuthenticated = authState.status === "authenticated";

  return (
    <div className="modal-backdrop account-modal-backdrop" onClick={close}>
      <div className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={(event) => event.stopPropagation()}>
        <div className="account-modal-head">
          <p className="eyebrow">account</p>
          <h2 id="account-title">{isAuthenticated ? "you're logged in" : "keep your dump"}</h2>
          <p>
            {isAuthenticated
              ? "Your private dump, Slack drafts, creator rooms, and editable room posts follow this login. Rooms still stay anonymous."
              : "Use Google to keep your private dump, Slack drafts, creator rooms, and editable room posts across browsers. Rooms stay anonymous."}
          </p>
        </div>
        {isAuthenticated && (
          <div className="account-modal-signed-in">
            {authState.email && <small>{authState.email}</small>}
            <div className="account-modal-actions">
              <button className="ghost-button" type="button" onClick={logout} disabled={isSending}>
                {isSending ? "logging out..." : "log out"}
              </button>
              <button className="solid-button" type="button" onClick={close} disabled={isSending}>
                done
              </button>
            </div>
          </div>
        )}
        {!isAuthenticated && (
          <div className="account-modal-actions stacked">
            <button className="solid-button button-with-loader" type="button" onClick={loginWithGoogle} disabled={isSending}>
              {isSending && <span className="mini-loader" aria-hidden="true" />}
              {isSending ? "opening Google..." : "continue with Google"}
            </button>
            <button className="ghost-button" type="button" onClick={close} disabled={isSending}>
              not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
