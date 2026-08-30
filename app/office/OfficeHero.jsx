"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero IS the office.
 *
 * The brief was "the page should BE the game, not describe it", and we are the
 * only landing page that can literally do that: /office/[slug] already boots a
 * walkable Phaser room from public/office/office-scene.js. This mounts the same
 * scene, with the same seeded demo cast, as the first thing on the page.
 *
 * WHY IT IS LAYERED OVER A SCREENSHOT RATHER THAN BOOTED COLD.
 * Phaser is 1.18MB and office-scene.js another 160KB. Waiting on 1.35MB of JS
 * before anything appears loses the five seconds the hero exists to win. So the
 * base layer is a REAL capture of this exact room (public/office-screens), which
 * paints with the document, and the live scene fades in on top once it is ready.
 * Every state of this component shows the same room; the only thing that changes
 * is whether it moves. Nothing here is a mockup or a placeholder frame.
 *
 * The scene is NOT booted when: the viewport is narrow (a 960x600 camera scaled
 * to a phone is mush — the still is more legible), prefers-reduced-motion is
 * set, the hero has never been scrolled into view, or either script fails. All
 * four land on the screenshot, which is a finished state, not a fallback.
 */

const PHASER_SRC = "/demo/phaser.min.js";
const SCENE_SRC = "/office/office-scene.js";
const MIN_WIDTH = 900;

export default function OfficeHero({ initialState, still, stillNarrow, alt }) {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const controllerRef = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return undefined;
    if (window.innerWidth < MIN_WIDTH) return undefined;

    let cancelled = false;
    let idle = null;
    const cleanups = [];

    const start = () => {
      const run = async () => {
        try {
          await loadScript(PHASER_SRC);
          await loadScript(SCENE_SRC);
          if (cancelled || !stageRef.current || !window.MumblOffice) return;
          const controller = window.MumblOffice.boot({ parent: stageRef.current });
          controllerRef.current = controller;
          cleanups.push(seatCast(controller, initialState), releaseKeys(), keepPageScrollable());
          setLive(true);
        } catch {
          // the still is already on screen and is the same room; nothing to do
        }
      };
      // after paint, and only when the browser is otherwise idle: the hero must
      // never be the reason the page is slow to become interactive.
      idle = window.requestIdleCallback
        ? window.requestIdleCallback(run, { timeout: 2500 })
        : window.setTimeout(run, 400);
    };

    // Only pay the 1.35MB if the hero is actually looked at.
    let observer = null;
    if (window.IntersectionObserver) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          observer = null;
          start();
        }
      }, { rootMargin: "200px" });
      observer.observe(host);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (idle != null) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
      cleanups.forEach((fn) => fn?.());
      cleanups.length = 0;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setLive(false);
    };
  }, [initialState]);

  return (
    <div className={`sw-stage${live ? " is-live" : ""}`} ref={hostRef}>
      <div className="sw-stage-lights" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ "--i": i }} />
        ))}
      </div>

      <div className="sw-stage-screen">
        {/* base layer: the real room, painted with the document. The wide crop
            is exactly the live camera's 16:10, so the fade is a swap and not a
            reflow; the narrow crop is a tighter framing of the same capture,
            because on a phone the scene never boots and this IS the hero. */}
        <picture>
          <source media="(max-width: 700px)" srcSet={stillNarrow} width={650} height={565} />
          <img className="sw-stage-still" src={still} alt={alt} width={1560} height={975} fetchPriority="high" />
        </picture>
        {/* live layer: the same room, running */}
        <div className="sw-stage-canvas" ref={stageRef} aria-hidden="true" />
      </div>

      <div className="sw-stage-bar">
        <span className="sw-pill">demo office</span>
        {live ? <span className="sw-hint">WASD or click the floor to walk</span> : null}
      </div>
    </div>
  );
}

const loaded = new Map();

function loadScript(src) {
  const existing = loaded.get(src);
  if (existing) return existing;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
  loaded.set(src, promise);
  return promise;
}

/**
 * Phaser's keyboard plugin attaches to the window and preventDefaults every key
 * it was asked for. office-scene calls createCursorKeys(), so booting it takes
 * the ARROW KEYS and SPACE away from the document — on a full-screen office that
 * is correct, on a landing page it silently breaks scrolling for anyone who does
 * not use a mouse wheel. Measured, not theorised: ArrowDown moved the page 0px
 * with the scene up and 40px with it down.
 *
 * Clearing once after boot() is NOT enough and the first version of this was
 * wrong that way. The captures are registered inside the scene's create(), which
 * Phaser runs on its own clock — under a cold compile that landed later than the
 * one-shot clear, so the fix passed on a warm server and failed on a cold one.
 *
 * So it is cleared from a capture-phase keydown listener instead. Phaser listens
 * on window in the bubble phase; a capture-phase listener on window runs first,
 * so the captures are gone before Phaser's own handler looks for one — which
 * means even the very first key press scrolls. Returns its own teardown.
 */
function releaseKeys() {
  const clear = () => {
    try {
      window.MumblOffice?.__room?.()?.input?.keyboard?.clearCaptures?.();
    } catch {
      // never worth breaking the hero over
    }
  };
  clear();
  window.addEventListener("keydown", clear, true);
  return () => window.removeEventListener("keydown", clear, true);
}

/**
 * Phaser's ScaleManager boots with expandParent:true, and that writes
 * `height: 100%` INLINE onto <html> AND <body>. On a page that is nothing but
 * the game that is the correct thing to do. Here it is a page-breaking bug:
 * the document collapses from 4097px to exactly the viewport height, the scroll
 * container moves from the document to <body>, window.scrollY freezes at 0, and
 * with it go keyboard scrolling, scroll restoration and every "/#waitlist"
 * anchor jump on the page. Measured before and after: docH 4097 -> 900 the
 * instant the scene came up, back to 4097 the instant these two lines are
 * cleared.
 *
 * It is undone here rather than in office-scene.js because that scene is shared
 * with the live office at /office/[slug], where a full-height body is what you
 * want. A MutationObserver rather than a one-shot reset because the scene's own
 * ResizeObserver calls scale.refresh() on every container resize, and the
 * expand runs again from there.
 */
function keepPageScrollable() {
  const targets = [document.documentElement, document.body];
  const strip = () => {
    for (const node of targets) {
      if (node.style.height === "100%") node.style.height = "";
    }
  };
  strip();
  const observer = new MutationObserver(strip);
  for (const node of targets) {
    observer.observe(node, { attributes: true, attributeFilter: ["style"] });
  }
  return () => observer.disconnect();
}

/**
 * Seat the cast, and keep trying until it takes.
 *
 * boot() returns before Phaser has constructed the scene, and the controller's
 * applyState() is a no-op when game.scene.getScene("room") is still null — it
 * drops the state on the floor with no error. LiveOffice never notices because
 * it re-applies every 4s from its poll; a hero that applies once inherits the
 * bug and renders an EMPTY OFFICE, which is a worse hero than the screenshot it
 * just faded out. Measured: byId 0, freeDesks 9, nine empty desk mats.
 *
 * So retry until the room reports actors seated. No polling of the read endpoint
 * here on purpose: the cast is the seeded demo state, handed down from the
 * server, and a landing page has no business opening a 4s request loop.
 */
function seatCast(controller, state) {
  let timer = null;
  const deadline = Date.now() + 15000;
  const tick = () => {
    controller.applyState(state);
    let seated = 0;
    try {
      seated = window.MumblOffice?.__room?.()?.byId?.size || 0;
    } catch {
      seated = 0;
    }
    if (seated > 0) { frameTheRoom(); return; }
    if (Date.now() > deadline) return;
    timer = window.setTimeout(tick, 150);
  };
  tick();
  return () => { if (timer) window.clearTimeout(timer); };
}

/**
 * The camera follows the player, who spawns at reception with a +120 offset —
 * which frames the bottom third of the world, half of it empty floor, and clips
 * the back row of desks off the top. Fine when you are walking around; poor as
 * the first thing anyone sees. Nudging the follow offset re-centres the view on
 * the band the room is actually drawn in (roughly y 170-700) without moving the
 * player, so walking still behaves exactly as it does in the live office.
 */
function frameTheRoom() {
  try {
    const cam = window.MumblOffice?.__room?.()?.cameras?.main;
    if (!cam) return;
    cam.setFollowOffset(0, 185);
    // setFollowOffset alone does nothing here: the camera has a 220x130 deadzone,
    // so it only re-scrolls once the player leaves it. Centre it once by hand for
    // the opening frame; the deadzone then holds this position until someone
    // actually walks, at which point following takes over unchanged.
    cam.centerOn(720, 435);
  } catch {
    // framing is a nicety; never break the hero for it
  }
}
