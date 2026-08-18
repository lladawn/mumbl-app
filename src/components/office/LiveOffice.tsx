"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SceneController = {
  applyState: (state: unknown) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    MumblOffice?: { boot: (options: Record<string, unknown>) => SceneController };
    Phaser?: unknown;
  }
}

const PHASER_SRC = "/demo/phaser.min.js";
const SCENE_SRC = "/office/office-scene.js";
const POLL_MS = 4000;

type OfficeActor = {
  externalId: string;
  name: string;
  role: string;
  status: string;
  currentTask?: string;
  events?: { detail?: string }[];
};

type OfficeState = {
  space?: { slug: string; name: string };
  actors: OfficeActor[];
  offline?: boolean;
  demo?: boolean;
};

/**
 * The live office at /office/[slug].
 *
 * Mirrors src/components/cal/OfficeScene.tsx: Phaser is vendored in public/ so it
 * loads after paint via loadScript, reduced-motion and a failed load both fall
 * back to a plain terminal list, and the scene is destroyed on unmount. The one
 * addition over the cal embed is the ~4s poll of the read endpoint driving
 * applyState() — the data comes from the DB (or the demo fallback), not a SEED.
 *
 * The terminal list rendered here is the control group: it is real, focusable
 * text that works with no canvas at all, and is what someone reads if the room
 * never opens.
 */
export default function LiveOffice({ slug, initialState }: { slug: string; initialState: OfficeState }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [sceneOn, setSceneOn] = useState(false);
  const [wanted, setWanted] = useState(true);
  const [state, setState] = useState<OfficeState>(initialState);

  // read through a ref so a new poll result never retears the scene down
  const latestRef = useRef<OfficeState>(initialState);
  latestRef.current = state;

  // ---- the poll: fetch the read endpoint, feed the scene + the fallback list
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/agents/spaces/${encodeURIComponent(slug)}/state`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as OfficeState;
        if (cancelled) return;
        setState(next);
        controllerRef.current?.applyState(next);
      } catch {
        // a dropped poll is not fatal; the last good state stays on screen
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [slug]);

  // ---- boot the Phaser scene (identical posture to OfficeScene.tsx)
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
        if (cancelled || !stageRef.current || !window.MumblOffice) return;

        const controller = window.MumblOffice.boot({ parent: stageRef.current });
        controllerRef.current = controller;
        setSceneOn(true);
        // seat whatever we already have before the first poll lands
        controller.applyState(latestRef.current);
      } catch {
        if (!cancelled) setWanted(false);
      }
    })();

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setSceneOn(false);
    };
  }, [wanted]);

  const actors = useMemo(() => state.actors || [], [state]);
  const offline = Boolean(state.offline) && !state.demo;

  return (
    <div className={`office-stage-wrap${sceneOn ? " has-scene" : ""}`}>
      <StyleTag />

      {offline ? (
        <div className="office-offline" role="status">
          away · this office has been quiet for a while. showing last-known state, not live.
        </div>
      ) : null}

      {wanted ? (
        <div className="office-stage" ref={stageRef} aria-hidden="true">
          {!sceneOn ? <p className="office-stage-loading">opening the office…</p> : null}
        </div>
      ) : null}

      {/* Control group: the same work as plain text, always present. Screen
          readers and no-canvas browsers land here; so does anyone who skips. */}
      <div className={`office-terminal-fallback${sceneOn ? " is-behind" : ""}`}>
        <h2>who&apos;s in{state.space?.name ? ` · ${state.space.name}` : ""}</h2>
        {actors.length === 0 ? <p className="office-empty">nobody reporting yet.</p> : null}
        <ul>
          {actors.map((a) => (
            <li key={a.externalId} className={`office-actor status-${a.status}`}>
              <span className="office-actor-pill">{a.status}</span>
              <span className="office-actor-name">{a.name}</span>
              <span className="office-actor-role">{a.role}</span>
              <span className="office-actor-task">{a.currentTask || "—"}</span>
            </li>
          ))}
        </ul>
      </div>

      {sceneOn ? (
        <div className="office-hints">
          <span>WASD / click the floor to walk · walk up + E, or click an agent</span>
          <button type="button" className="office-skip" onClick={() => setWanted(false)}>
            skip to the list
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

// Scoped inline styles for the canvas host and the overlays the scene injects.
// Kept out of the global stylesheet so this feature carries its own chrome and
// stays self-contained, the same way the scene owns its own panel DOM.
function StyleTag() {
  return (
    <style>{`
      .office-stage-wrap { position: relative; width: 100%; max-width: 960px; margin: 0 auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
      .office-offline { margin: 0 0 12px; padding: 8px 14px; border: 2px solid #E3D5BD; border-radius: 8px; background: #FBF4E8; color: #7E8C86; font-size: 12px; letter-spacing: .02em; }
      .office-stage {
        position: relative; width: 100%; aspect-ratio: 960 / 600;
        background: #C7E9E5; border: 3px solid #E2D4BC; border-radius: 10px;
        overflow: hidden; box-shadow: 0 10px 30px rgba(140,120,95,.18);
      }
      .office-stage canvas { display: block; }
      .office-stage-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #7E8C86; font-size: 12px; }

      .office-terminal-fallback { margin-top: 16px; color: #4A5A56; }
      .office-terminal-fallback.is-behind { margin-top: 14px; opacity: .9; }
      .office-terminal-fallback h2 { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #B4791F; margin: 0 0 10px; }
      .office-terminal-fallback ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .office-empty { color: #A8B5B0; font-size: 12px; }
      .office-actor { display: grid; grid-template-columns: 84px 120px 90px 1fr; gap: 10px; align-items: baseline; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #EDE4D2; }
      .office-actor-pill { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; text-align: center; background: #EAEFEC; color: #6E7E79; }
      .status-working .office-actor-pill { background: #FBEBD2; color: #9A6516; }
      .status-blocked .office-actor-pill { background: #FBE0DC; color: #B0554C; }
      .status-done .office-actor-pill { background: #DFF2E7; color: #2E7F5C; }
      .office-actor-name { font-weight: 600; color: #3E4E4A; }
      .office-actor-role { color: #9AA8A3; }
      .office-actor-task { color: #4A5A56; }

      .office-hints { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-size: 11px; color: #7E8C86; }
      .office-skip { background: none; border: 0; color: #B4791F; cursor: pointer; font: inherit; text-decoration: underline; }

      /* overlays injected into the stage by public/office/office-scene.js */
      .office-panel {
        position: absolute; top: 0; right: 0; bottom: 0; width: 300px; max-width: 62%;
        background: rgba(255,250,242,.97); border-left: 3px solid #EFC08A; padding: 20px;
        transform: translateX(102%); transition: transform .26s cubic-bezier(.4,0,.2,1);
        z-index: 30; display: flex; flex-direction: column; color: #4A5A56;
      }
      .office-panel.on { transform: translateX(0); }
      .office-panel-close { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #A8B5B0; font-size: 22px; line-height: 1; cursor: pointer; font-family: inherit; }
      .office-panel-close:hover { color: #5A6B66; }
      .office-panel-role { color: #B4791F; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; }
      .office-panel-name { margin: 4px 0 10px; font-size: 19px; font-weight: 600; color: #3E4E4A; }
      .office-panel-status { display: inline-block; align-self: flex-start; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; padding: 3px 9px; border-radius: 2px; }
      .office-panel-label { margin-top: 18px; color: #9AA8A3; font-size: 9px; letter-spacing: .18em; }
      .office-panel-task { margin-top: 6px; font-size: 13px; line-height: 1.5; color: #3E4E4A; }
      .office-panel-log { margin: 6px 0 0; flex: 1; overflow-y: auto; font-family: inherit; font-size: 11px; line-height: 1.7; color: #6E7E79; white-space: pre-wrap; }

      .office-terminal {
        position: absolute; inset: 0; background: #070B0B; opacity: 0; pointer-events: none;
        transition: opacity .32s ease; z-index: 40; display: flex; flex-direction: column; justify-content: flex-end; padding: 22px 24px 16px;
      }
      .office-terminal.on { opacity: 1; pointer-events: auto; }
      .office-term-inner { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
      .office-term-lines { color: #7E8C82; font-size: 12px; line-height: 1.75; white-space: pre-wrap; }
      .office-term-lines .dim { color: #38443E; }
      .office-term-lines .amb { color: #D9A05A; }
      .office-term-hint { margin-top: 14px; padding-top: 12px; border-top: 1px solid #1B2422; color: #4C5A53; font-size: 11px; letter-spacing: .04em; cursor: pointer; }
      .office-term-hint b { color: #EFC08A; }

      .office-view-toggle {
        position: absolute; top: 10px; right: 12px; z-index: 45; background: rgba(255,248,236,.92);
        border: 2px solid #EFC08A; color: #6B5334; font-family: inherit; font-size: 10px; letter-spacing: .1em;
        text-transform: uppercase; padding: 7px 12px; border-radius: 2px; cursor: pointer;
      }
      .office-view-toggle:hover { background: #EFC08A; color: #4A3A22; }
      .office-view-toggle b { color: #B4791F; }

      .office-toast {
        position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(8px);
        background: rgba(255,250,242,.97); border: 2px solid #EFC08A; color: #4A5A56; font-size: 12px;
        padding: 8px 16px; border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity .25s, transform .25s; z-index: 25;
      }
      .office-toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }

      @media (max-width: 620px) {
        .office-panel { width: 82%; }
        .office-actor { grid-template-columns: 70px 1fr; }
        .office-actor-role, .office-actor-task { grid-column: 2; }
      }
    `}</style>
  );
}
