"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SlotPicker, { type Slot, type SlotPickerEventType, type SlotPickerHost } from "./SlotPicker";

type SceneController = {
  say: (text: string) => void;
  walkToDesk: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    MumblCalOffice?: { boot: (options: Record<string, unknown>) => SceneController };
    Phaser?: unknown;
  }
}

const PHASER_SRC = "/demo/phaser.min.js";
const SCENE_SRC = "/cal/office-scene.js";

/**
 * The pixel reception, with the booking flow living on top of it as HTML.
 *
 * The dialogue is deliberately *not* drawn into the canvas: it is real text
 * that can be focused, read by a screen reader and completed with a keyboard.
 * The room is the character; the overlay is the utility.
 *
 * The room is also optional. Phaser is 1.18 MB vendored in public/, so it loads
 * after paint and never gates the booking flow — `classic`, reduced motion, a
 * failed script load and a canvas-less browser all land on the same plain list,
 * which is the thing someone actually came here to use.
 */
export default function OfficeScene({
  host,
  eventType,
  initialSlots,
  initialWindowEndIso,
  seed,
  classic = false,
  receptionistLook,
}: {
  host: SlotPickerHost;
  eventType: SlotPickerEventType;
  initialSlots: Slot[];
  initialWindowEndIso: string;
  seed: number;
  classic?: boolean;
  receptionistLook?: Record<string, string>;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const pendingLineRef = useRef<string>("");
  const [sceneOn, setSceneOn] = useState(false);
  const [wanted, setWanted] = useState(!classic);

  // read through refs so a fresh object literal from the server component
  // cannot retrigger the effect and tear the whole room down mid-visit
  const lookRef = useRef(receptionistLook);
  const nameRef = useRef(host.receptionistName);
  lookRef.current = receptionistLook;
  nameRef.current = host.receptionistName;

  useEffect(() => {
    if (!wanted) return undefined;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reducedMotion) {
      setWanted(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadScript(PHASER_SRC);
        await loadScript(SCENE_SRC);
        if (cancelled || !stageRef.current || !window.MumblCalOffice) return;

        const portrait = window.matchMedia?.("(max-width: 767px)")?.matches ?? false;
        const controller = window.MumblCalOffice.boot({
          parent: stageRef.current,
          portrait,
          receptionistName: nameRef.current,
          receptionistLook: lookRef.current,
          // via the ref, not the local const: these fire long after boot, and
          // the ref is also what a later step's line writes into
          onArrive: () => controllerRef.current?.say(pendingLineRef.current),
          onLeave: () => controllerRef.current?.say(""),
        });

        controllerRef.current = controller;
        setSceneOn(true);
      } catch {
        // the room is a bonus; losing it must not cost anyone their booking
        if (!cancelled) setWanted(false);
      }
    })();

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [wanted]);

  // written into the speech bubble rather than React state: the line changes on
  // every step and re-rendering the canvas host for it would be wasteful
  const handleLine = useCallback((line: string) => {
    pendingLineRef.current = line;
    controllerRef.current?.say(line);
  }, []);

  return (
    <div className={`cal-stage-wrap${sceneOn ? " has-scene" : ""}`}>
      {wanted ? (
        <div className="cal-stage" ref={stageRef} aria-hidden="true">
          {!sceneOn ? <p className="cal-stage-loading">opening the office…</p> : null}
        </div>
      ) : null}

      <div className="cal-overlay">
        <SlotPicker
          host={host}
          eventType={eventType}
          initialSlots={initialSlots}
          initialWindowEndIso={initialWindowEndIso}
          seed={seed}
          onLine={handleLine}
        />
      </div>

      {sceneOn ? (
        <div className="cal-stage-hints">
          <span>tap the floor to walk · WASD works too</span>
          <button type="button" className="text-link" onClick={() => setWanted(false)}>
            skip to available times
          </button>
        </div>
      ) : null}
    </div>
  );
}

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
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
