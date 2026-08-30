"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TRAVERSAL — the document is the floor.
 *
 * The avatar is fixed near the middle of the viewport and the floor moves past
 * them, so scrolling IS walking. Nothing is intercepted and nothing is ever
 * preventDefault'd: "not scrollable but traversable" is the feeling, and it is
 * reached by making traversal what scrolling already is rather than by taking
 * scroll away. That one decision answers the two hard requirements without a
 * special case for either — keyboard already scrolls, so keyboard-only already
 * traverses; Tab still walks the real focus order; and because the objects are
 * real DOM elements, screen readers get the page unchanged.
 *
 * PROXIMITY: whichever registered object is nearest the avatar's anchor line
 * lights up and offers one prompt. Same grammar as /office/demo (walk up, press
 * E), so someone who later opens the real office already knows the controls.
 *
 * SCROLL DISCIPLINE, because this area has produced three bugs in a week:
 * the listener is passive, the work happens in one rAF, and inside it we only
 * READ layout and write classes — never a scroll-linked layout write. React
 * state is set only when the nearest object actually CHANGES, not per frame.
 */

const ANCHOR = 0.6;      // avatar's line, as a fraction of viewport height
// How close counts as "within reach". Proportional to the viewport rather than
// fixed, so a laptop and a phone feel the same rather than the phone feeling
// like everything is miles apart. Bounded so it never becomes "always near",
// which would make the highlight meaningless.
const reach = () => Math.min(400, Math.max(200, window.innerHeight * 0.32));
const STOP_MS = 170;     // quiet time before the walk cycle stops

export default function useTraversal({ enabled, reduced }) {
  const [near, setNear] = useState(null); // { label, kind } of the object in reach
  const avatarRef = useRef(null);
  const nearElRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let raf = null;
    let stopTimer = null;
    let lastY = window.scrollY;

    const setNearEl = (el) => {
      if (nearElRef.current === el) return;
      if (nearElRef.current) nearElRef.current.removeAttribute("data-near");
      nearElRef.current = el;
      if (el) {
        el.setAttribute("data-near", "true");
        setNear({ label: el.getAttribute("data-world-object") || "", kind: el.dataset.worldKind || "thing" });
      } else {
        setNear(null);
      }
    };

    const measure = () => {
      raf = null;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      const avatar = avatarRef.current;

      if (avatar && !reduced && Math.abs(dy) > 0.4) {
        avatar.dataset.walking = "true";
        avatar.dataset.facing = dy > 0 ? "down" : "up";
        clearTimeout(stopTimer);
        stopTimer = setTimeout(() => { if (avatar) avatar.dataset.walking = "false"; }, STOP_MS);
      }

      const line = window.innerHeight * ANCHOR;
      let best = null;
      let bestDistance = Infinity;
      for (const el of document.querySelectorAll("[data-world-object]")) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - line);
        if (distance < bestDistance) { bestDistance = distance; best = el; }
        // "the room remembers": anything the avatar has walked past stays lit
        if (rect.top < line) el.setAttribute("data-visited", "true");
      }
      setNearEl(bestDistance <= reach() ? best : null);
    };

    const onScroll = () => { if (raf === null) raf = requestAnimationFrame(measure); };

    /* Tab and walking are the same system, not two.
       Tab is the guaranteed keyboard route and it is untouched by world mode —
       measured at identical action counts in both modes. But without this, a
       visitor tabbing to the reception desk got no spatial feedback at all,
       which made the room feel like decoration sitting on top of a form. Now
       focus IS presence: whatever you tab to is what you are standing at. */
    const onFocusIn = (event) => {
      const owner = event.target?.closest?.("[data-world-object]");
      if (owner) setNearEl(owner);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    measure();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      if (raf !== null) cancelAnimationFrame(raf);
      clearTimeout(stopTimer);
      if (nearElRef.current) nearElRef.current.removeAttribute("data-near");
      nearElRef.current = null;
      for (const el of document.querySelectorAll("[data-visited]")) el.removeAttribute("data-visited");
    };
  }, [enabled, reduced]);

  // E interacts with whatever is in reach, matching the office's own grammar.
  // Enter is accepted too, but ONLY when nothing is focused — otherwise Enter
  // belongs to the button or field the visitor is actually on.
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const el = nearElRef.current;
      if (!el) return;
      const target = event.target;
      const typing =
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing) return;
      const isE = event.key.toLowerCase() === "e";
      const isEnter = event.key === "Enter" && document.activeElement === document.body;
      if (!isE && !isEnter) return;
      event.preventDefault();
      interact(el);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return { avatarRef, near };
}

/**
 * Interacting is deliberately thin: the objects ARE the page's real elements, so
 * "walk through the door" resolves to clicking the link that was always there,
 * and "use the clipboard" resolves to focusing the form that was always there.
 * Nothing here is a parallel implementation that could drift from the page.
 */
function interact(el) {
  const focusable = el.matches("a, button") ? el : el.querySelector("a, button, input, select, textarea");
  if (!focusable) return;
  if (focusable.tagName === "INPUT" || focusable.tagName === "TEXTAREA" || focusable.tagName === "SELECT") {
    focusable.focus();
    return;
  }
  focusable.click();
}
