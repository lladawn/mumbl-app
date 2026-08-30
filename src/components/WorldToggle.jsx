"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The toggle that turns this page into the office.
 *
 * WHAT IT IS NOT: a browser theme. mumbl does not skin other websites or web
 * apps and nothing here may imply that it does. This is a demonstration of the
 * idea on our own page, and the copy is kept to "this page" for that reason.
 *
 * WHY IT IS A DOM TRANSFORM AND NOT A SCENE SWAP. The pitch is that your
 * ordinary working day becomes a world, so the transition has to be the SAME
 * ELEMENTS becoming their pixel equivalents — the nav becomes the back wall,
 * the beat cards become desks, the button becomes an object in the room, all in
 * their existing positions. Cutting to a canvas throws that away: without the
 * before, there is no transformation, and the transformation is the whole
 * feeling. So world mode is one attribute on <html> and every visual is a CSS
 * transition on the real nodes (see "world mode" in styles.css). It costs no
 * download, which is why the normal page stays fast.
 *
 * The attribute lives on documentElement rather than in React state alone so it
 * can reach the topbar, which is rendered by AppShell above this component.
 *
 * Deliberately NOT a history entry: the back button should leave the site, the
 * way a visitor expects. Getting out is Esc, the same button, or the same key.
 */

const KEY = "w";
const ATTR = "data-world";

export default function WorldToggle() {
  const [on, setOn] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    setReduced(query.matches);
    const listen = (e) => setReduced(e.matches);
    query.addEventListener?.("change", listen);
    return () => query.removeEventListener?.("change", listen);
  }, []);

  // Reflect state onto <html>, and never leave the attribute behind on unmount —
  // it would follow the visitor to /office or /slack, which do not style for it.
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.setAttribute(ATTR, reduced ? "instant" : "on");
    else root.removeAttribute(ATTR);
    return () => root.removeAttribute(ATTR);
  }, [on, reduced]);

  const toggle = useCallback(() => setOn((v) => !v), []);

  useEffect(() => {
    const onKey = (event) => {
      // Esc always leaves, and only leaves.
      if (event.key === "Escape") { setOn(false); return; }
      // A bare letter is a shortcut; the same letter with a modifier belongs to
      // the browser, and inside a field it is someone typing their email.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (event.key.toLowerCase() !== KEY) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <button
      type="button"
      className="world-toggle"
      onClick={toggle}
      aria-pressed={on}
      data-on={on ? "true" : "false"}
    >
      <span className="world-toggle-label">
        {on ? "back to the normal page" : "turn this page into the office"}
      </span>
      <kbd className="world-toggle-key" aria-hidden="true">{on ? "esc" : "W"}</kbd>
    </button>
  );
}

function isTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
