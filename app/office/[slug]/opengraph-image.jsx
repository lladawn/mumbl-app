import { ImageResponse } from "next/og";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { readSpaceState, redactForPublic } from "../../../src/server/agentPresence";
import { demoSpaceState } from "../../../src/server/officeDemo";
import { cleanString } from "../../../src/server/validation";

export const alt = "A live pixel office of AI agents at work.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The postable "here's my office right now" card. It reads the redacted,
// SHAPE-ONLY state (redactForPublic) — statuses and counts, never a task string
// or event detail — and lays out however many stations are currently lit, with
// a headline built from those counts. Nothing here is ever decrypted for the
// public path, so the card is safe to post: no repo name, no client, no words
// anyone actually typed can leak into it.

// Palette + geometry match app/opengraph-image.jsx and /demo so the card looks
// like the thing people land on. Satori has no reliable <svg> rects, so the
// pixel art is positioned divs — which is what pixel art is anyway.
const C = {
  paper: "#FBF4E8", panel: "#FFFAF2", edge: "#E3D5BD", ink: "#3E4E4A", muted: "#7E8C86",
  gold: "#F6D9A8", goldInk: "#6B5334", wall: "#C7E9E5", wallTrim: "#FFF8EC", sky: "#BEE7F7",
  skyTop: "#DCF3FC", leaf: "#B6E4C0", floor: "#DDBA88", carpet: "#D2DAF0", carpetEdge: "#AEB9DE",
  deskTop: "#F0D5A8", desk: "#E3C094", monitor: "#9FB3BE", line: "#59696E", shoe: "#8A7358",
  workingInk: "#9A6516", workingRing: "#EFB472",
  blockedInk: "#B0554C", blockedRing: "#F09B90",
  doneInk: "#2E7F5C", doneRing: "#86CFA6",
  idleInk: "#6E7E79", idleRing: "#C7D2CE",
};

// A stable, varied look per station keyed on its index — same cast the office
// and app/opengraph-image.jsx draw.
const LOOKS = [
  { hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96", glow: "#C6F5EC",
    hairStyle: "curly", outfit: "stripes", accessory: "glasses", accent: "#FFF8EC", build: "slim", screen: "#BBDCF0" },
  { hair: "#3A322C", skin: "#C89370", shirt: "#F29C8D", pants: "#7A7189", glow: "#FFD2CA",
    hairStyle: "beanie", outfit: "vest", accessory: "lanyard", accent: "#CFBBF0", build: "broad", screen: "#9BD8B4" },
  { hair: "#332C26", skin: "#A0714B", shirt: "#94CDEE", pants: "#6E7E96", glow: "#D8EEFF",
    hairStyle: "cap", outfit: "hoodie", accessory: "headphones", accent: "#6E9FD8", screen: "#CFBBF0" },
  { hair: "#6B4426", skin: "#F0D2AC", shirt: "#F3CE79", pants: "#8A7358", glow: "#FFF1CC",
    hairStyle: "bun", outfit: "collar", accessory: "earrings", accent: "#C7913F", screen: "#F8DFA0" },
];

const STATUS_STYLE = {
  working: { ink: C.workingInk, ring: C.workingRing },
  blocked: { ink: C.blockedInk, ring: C.blockedRing },
  done: { ink: C.doneInk, ring: C.doneRing },
  idle: { ink: C.idleInk, ring: C.idleRing },
};

// category → the card's SHAPE vocabulary: monitor screen tint + a short label
// for the stack headline. Mirrors CATEGORY_LOOK / STATION_DRAW in
// public/office/office-scene.js so the card reads like the live office. Static
// only — the shape carries the read (docs/office-visual-design.md §3).
const CATEGORY_CARD = {
  coding:   { screen: "#1E262B", accent: "#9BD8B4", label: "coding" },
  review:   { screen: "#241E2E", accent: "#CFBBF0", label: "reviewing" },
  design:   { screen: "#F6BCD1", accent: "#F6BCD1", label: "designing" },
  call:     { screen: "#BEE7F7", accent: "#BEE7F7", label: "on a call" },
  writing:  { screen: "#F3E4B8", accent: "#F8DFA0", label: "writing" },
  browsing: { screen: "#F4B3A6", accent: "#F4B3A6", label: "browsing" },
  music:    { screen: "#2E4A3A", accent: "#9BD8B4", label: "records spinning" },
  focus:    { screen: "#9FB3BE", accent: "#C7D2CE", label: "heads-down" },
  other:    { screen: "#9FB3BE", accent: "#C7D2CE", label: "heads-down" },
  agent:    { screen: "#9BD8B4", accent: "#9BD8B4", label: "agents at work" },
};

// Specific-app vocabulary (mirrors TOOL_LOOK / TOOL_SCREEN in the live engine).
// `screen` names a painter in TOOL_SCREEN_RECTS; `category` is the station/zone
// fallback; `label` is the human name shown in the stack headline. Tool wins
// over category so the card reads "VS Code · Figma · Zoom", not "coding · …".
const TOOL_CARD = {
  vscode: { accent: "#4FA5E0", category: "coding", screen: "vscode", label: "VS Code" },
  cursor: { accent: "#C7D2CE", category: "coding", screen: "vscode", label: "Cursor" },
  xcode: { accent: "#4FA5E0", category: "coding", screen: "vscode", label: "Xcode" },
  intellij: { accent: "#F0A79E", category: "coding", screen: "vscode", label: "IntelliJ" },
  pycharm: { accent: "#9BD8B4", category: "coding", screen: "vscode", label: "PyCharm" },
  zed: { accent: "#6E9FD8", category: "coding", screen: "vscode", label: "Zed" },
  sublime: { accent: "#EFC08A", category: "coding", screen: "vscode", label: "Sublime" },
  terminal: { accent: "#9BD8B4", category: "coding", screen: "terminal", label: "Terminal" },
  iterm: { accent: "#9BD8B4", category: "coding", screen: "terminal", label: "iTerm" },
  ghostty: { accent: "#CFBBF0", category: "coding", screen: "terminal", label: "Ghostty" },
  warp: { accent: "#6E9FD8", category: "coding", screen: "terminal", label: "Warp" },
  figma: { accent: "#F0A79E", category: "design", screen: "figma", label: "Figma" },
  sketch: { accent: "#EFC08A", category: "design", screen: "figma", label: "Sketch" },
  photoshop: { accent: "#6E9FD8", category: "design", screen: "figma", label: "Photoshop" },
  illustrator: { accent: "#EFB472", category: "design", screen: "figma", label: "Illustrator" },
  zoom: { accent: "#6E9FD8", category: "call", screen: "zoom", label: "Zoom" },
  teams: { accent: "#9E86C8", category: "call", screen: "zoom", label: "Teams" },
  discord: { accent: "#9E86C8", category: "call", screen: "zoom", label: "Discord" },
  meet: { accent: "#86CFA6", category: "call", screen: "zoom", label: "Meet" },
  spotify: { accent: "#86CFA6", category: "music", screen: null, label: "Spotify" },
  "apple-music": { accent: "#F0A79E", category: "music", screen: null, label: "Apple Music" },
  notion: { accent: "#59696E", category: "writing", screen: "notion", label: "Notion" },
  obsidian: { accent: "#9E86C8", category: "writing", screen: "notion", label: "Obsidian" },
  notes: { accent: "#F8DFA0", category: "writing", screen: "notion", label: "Notes" },
  word: { accent: "#6E9FD8", category: "writing", screen: "notion", label: "Word" },
  chrome: { accent: "#6E9FD8", category: "browsing", screen: "chrome", label: "Chrome" },
  safari: { accent: "#6E9FD8", category: "browsing", screen: "chrome", label: "Safari" },
  arc: { accent: "#F6BCD1", category: "browsing", screen: "chrome", label: "Arc" },
  firefox: { accent: "#EFB472", category: "browsing", screen: "chrome", label: "Firefox" },
  slack: { accent: "#9E86C8", category: "browsing", screen: "slack", label: "Slack" },
};

// Resolve an actor to its card look: app (tool) first, then category, then agent.
function cardLook(a) {
  const t = a && a.tool ? TOOL_CARD[a.tool] : null;
  const cat = (t && t.category) || (a && a.category) || "agent";
  const base = CATEGORY_CARD[cat] || CATEGORY_CARD.agent;
  return {
    accent: (t && t.accent) || base.accent,
    screen: base.screen,
    screenKind: t && t.screen ? t.screen : null,
    label: (t && t.label) || base.label,
    category: cat,
  };
}
// back-compat helper used by the headline
const cardCat = (c) => CATEGORY_CARD[c] || CATEGORY_CARD.agent;

async function loadPublicState(rawSlug) {
  const slug = cleanString(rawSlug, 64).toLowerCase();
  try {
    const supabase = getSupabaseAdmin();
    const state = await readSpaceState(supabase, slug);
    if (state && state.actors.length) return redactForPublic(state);
    return redactForPublic(demoSpaceState(slug));
  } catch {
    return redactForPublic(demoSpaceState(slug));
  }
}

// Stack-shaped headline: the DISTINCT tools/categories currently lit, in order —
// "this is my stack" instead of a bare status count. Shape-only, never a task.
function headline(actors) {
  if (!actors.length) return "a quiet office right now";
  const seen = new Set();
  const stack = [];
  for (const a of actors) {
    const lbl = cardLook(a).label; // specific app name when known
    if (seen.has(lbl)) continue;
    seen.add(lbl);
    stack.push(lbl);
  }
  return stack.slice(0, 4).join(" · ");
}

export default async function Image({ params }) {
  const { slug } = await params;
  const state = await loadPublicState(slug);
  const all = state.actors || [];
  // shape-only: at most 4 stations, chosen for BREADTH (one per distinct
  // category first, then fill) so the card shows the range of the stack, not
  // four of the same desk. Statuses/categories only — never a task string.
  const byCat = [];
  const seen = new Set();
  for (const a of all) { const c = a.category || "agent"; if (!seen.has(c)) { seen.add(c); byCat.push(a); } }
  for (const a of all) { if (byCat.length >= 4) break; if (!byCat.includes(a)) byCat.push(a); }
  const actors = byCat.slice(0, 4);
  const title = cleanString(slug, 40);

  return new ImageResponse(<ShareImage actors={actors} title={title} offline={Boolean(state.offline)} />, size);
}

function personRects(look) {
  const hairStyle = look.hairStyle || "short";
  const outfit = look.outfit || "plain";
  const accessory = look.accessory || "none";
  const accent = look.accent || "#FFF8EC";
  const tx = look.build === "slim" ? 4 : 3;
  const tw = look.build === "slim" ? 6 : look.build === "broad" ? 9 : 8;
  const legL = tx + 1;
  const legR = tx + tw - (tw >= 8 ? 3 : 2);
  const r = [];
  const put = (x, y, w, h, fill) => r.push([x, y, w, h, fill]);

  if (hairStyle === "curly") {
    put(3, 0, 8, 5, look.hair); put(2, 2, 1, 4, look.hair); put(11, 2, 1, 4, look.hair);
  } else if (hairStyle === "bun") {
    put(5, 0, 4, 2, look.hair); put(4, 1, 6, 3, look.hair); put(3, 2, 8, 4, look.hair);
  } else if (hairStyle === "cap") {
    put(4, 1, 6, 3, look.hair); put(3, 2, 8, 4, look.hair);
    put(3, 1, 8, 2, accent); put(2, 3, 5, 1, accent); put(3, 3, 8, 1, C.line);
  } else if (hairStyle === "beanie") {
    put(3, 2, 8, 4, look.hair); put(3, 1, 8, 3, accent); put(3, 3, 8, 1, C.line); put(6, 0, 2, 1, accent);
  } else if (hairStyle === "long") {
    put(4, 1, 6, 3, look.hair); put(3, 2, 8, 4, look.hair); put(2, 3, 1, 9, look.hair); put(11, 3, 1, 9, look.hair);
  } else {
    put(4, 1, 6, 3, look.hair); put(3, 2, 8, 4, look.hair);
  }

  put(4, 4, 6, 4, look.skin);
  if (hairStyle === "short" || hairStyle === "long" || hairStyle === "bun") put(4, 3, 6, 1, look.hair);
  put(5, 6, 1, 1, C.line); put(8, 6, 1, 1, C.line);

  put(tx, 8, tw, 7, look.shirt);
  put(tx - 1, 9, 1, 5, look.shirt); put(tx + tw, 9, 1, 5, look.shirt);
  put(tx - 1, 13, 1, 2, look.skin); put(tx + tw, 13, 1, 2, look.skin);

  if (outfit === "hoodie") {
    put(tx, 8, tw, 2, accent); put(6, 10, 1, 2, accent); put(8, 10, 1, 2, accent); put(tx + 1, 12, tw - 2, 2, C.line);
  } else if (outfit === "collar") {
    put(tx, 8, 2, 7, accent); put(tx + tw - 2, 8, 2, 7, accent); put(6, 8, 2, 1, "#FFF8EC"); put(6, 9, 2, 4, look.pants);
  } else if (outfit === "stripes") {
    [9, 11, 13].forEach((y) => put(tx, y, tw, 1, accent));
  } else if (outfit === "vest") {
    put(tx, 8, 2, 7, accent); put(tx + tw - 2, 8, 2, 7, accent); put(tx + 2, 8, tw - 4, 1, "#FFF8EC");
  }

  put(legL, 15, 2, 4, look.pants); put(legR, 15, 2, 4, look.pants);
  put(legL - 1, 19, 3, 1, C.shoe); put(legR, 19, 3, 1, C.shoe);

  if (accessory === "glasses") {
    put(4, 5, 6, 1, C.line); put(3, 5, 1, 2, C.line); put(10, 5, 1, 2, C.line);
  } else if (accessory === "headphones") {
    put(3, 0, 8, 1, C.line); put(2, 3, 2, 3, C.line); put(10, 3, 2, 3, C.line);
  } else if (accessory === "lanyard") {
    put(6, 8, 1, 4, C.line); put(8, 8, 1, 4, C.line); put(6, 11, 3, 3, accent);
  }
  return r;
}

function Person({ look, s }) {
  return (
    <div style={{ display: "flex", position: "relative", width: 14 * s, height: 20 * s }}>
      {look.glow ? (
        <div style={{ position: "absolute", left: 1 * s, top: 0, width: 12 * s, height: 20 * s, background: look.glow, opacity: 0.22 }} />
      ) : null}
      {personRects(look).map(([x, y, w, h, fill], i) => (
        <div key={i} style={{ position: "absolute", left: x * s, top: y * s, width: w * s, height: h * s, background: fill }} />
      ))}
    </div>
  );
}

function Pill({ label, ink, ring, left }) {
  return (
    <div style={{ position: "absolute", left, top: 84, display: "flex", padding: "5px 11px", borderRadius: 8, background: "#FFF6E4", border: `3px solid ${ring}`, color: ink, fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
      {label}
    </div>
  );
}

// Static signature prop per category, mirroring STATION_DRAW in the live engine.
// Positioned divs only (Satori-safe). Coordinates are relative to the Station's
// origin, roughly over the desk top. The screen tint + this prop carry the
// "which tool" read with no animation — which is exactly what the card needs.
const STATION_PROP_RECTS = {
  // [left, top, width, height, background, extra?] — relative to the Station.
  coding: [[-8, 16, 34, 4, "#9BD8B4", { opacity: 0.9 }], [-8, 24, 22, 4, "#4E7D66", { opacity: 0.9 }], [-8, 32, 40, 4, "#9BD8B4", { opacity: 0.9 }]],
  review: [[-8, 16, 34, 4, "#86CFA6"], [-8, 24, 24, 4, "#F09B90"], [48, 62, 22, 16, "#FFFBF0"], [48, 62, 22, 4, "#CFBBF0"]],
  design: [
    [-56, -2, 26, 30, "#F3E9DA"],
    [-54, 2, 10, 8, "#F4B3A6"], [-42, 2, 10, 8, "#F8DFA0"], [-30, 2, 10, 8, "#9BD8B4"],
    [-54, 12, 10, 8, "#BEE7F7"], [-42, 12, 10, 8, "#CFBBF0"], [-30, 12, 10, 8, "#F6BCD1"],
  ],
  call: [[6, -14, 40, 22, "#FFFBF0"], [12, -8, 26, 4, "#BEE7F7"], [12, -1, 16, 4, "#BEE7F7"], [52, -12, 8, 8, "#86CFA6", { borderRadius: 8 }]],
  music: [[-40, 52, 60, 30, "#CBA87C"], [-30, 56, 40, 22, "#2A2622", { borderRadius: 20 }], [-14, 64, 8, 6, "#F4B3A6", { borderRadius: 6 }], [14, 52, 4, 16, "#B7C9CB"]],
  writing: [[44, 40, 4, 16, "#B7C9CB"], [34, 28, 20, 8, "#F8DFA0"], [-36, 60, 30, 20, "#FFFBF0"], [-30, 66, 18, 2, "#59696E", { opacity: 0.7 }], [-30, 72, 22, 2, "#59696E", { opacity: 0.7 }]],
  browsing: [[-24, 40, 40, 28, "#3A4348"], [-20, 44, 32, 6, "#F4B3A6"], [-20, 52, 32, 12, "#EFE7DA"]],
  focus: [[46, 62, 12, 10, "#FFFBF0"], [58, 64, 4, 5, "#F4B3A6"]],
};

// Static signature prop per category, mirroring STATION_DRAW in the live engine.
// Positioned divs only (Satori-safe); the screen tint + this prop carry the
// "which tool" read with no animation — exactly what the card needs.
//
// NOTE: this is deliberately a plain function returning an ARRAY OF ELEMENTS
// that the caller spreads into its children — NOT a <StationProp /> component.
// Satori walks the element tree itself and destructures `props` off every node
// it visits; a function component that returns a bare array hands it an Array
// as a node, whose `props` is undefined, and the render dies with
// "Cannot destructure property 'children' of 'p' as it is undefined" — which
// kills the ImageResponse stream ("failed to pipe response") rather than
// surfacing as a normal 500. An array in the CHILDREN position is fine, which
// is how personRects/TOOL_SCREEN_RECTS are already drawn.
function stationPropRects(category) {
  const rects = STATION_PROP_RECTS[category] || STATION_PROP_RECTS.focus;
  return rects.map(([left, top, width, height, background, extra], i) => (
    <div key={`prop${i}`} style={{ position: "absolute", left, top, width, height, background, ...(extra || {}) }} />
  ));
}

// App-recognizable monitor content, mirroring TOOL_SCREEN in the live engine.
// Rects are relative to the 76x32 screen box (its top-left is 0,0 here). When a
// tool paints its own screen we skip the generic white glare so the app art
// reads cleanly.
const SCREEN_W = 76, SCREEN_H = 32;
const TOOL_SCREEN_RECTS = {
  vscode: [[0, 0, 8, SCREEN_H, "#2C6F9E"], [14, 5, 34, 4, "#4FA5E0"], [14, 12, 22, 4, "#86CFA6"], [22, 19, 30, 4, "#EFC08A"], [14, 26, 38, 4, "#6E7E79"]],
  terminal: [[0, 0, SCREEN_W, SCREEN_H, "#11161A"], [6, 5, 6, 4, "#9BD8B4"], [16, 5, 24, 4, "#9BD8B4"], [6, 13, 34, 4, "#86CFA6"], [6, 21, 20, 4, "#86CFA6"], [30, 21, 8, 4, "#9BD8B4"]],
  figma: [[0, 0, SCREEN_W, SCREEN_H, "#F3ECE4"], [10, 5, 14, 14, "#F0A79E"], [28, 5, 14, 14, "#EFB472"], [10, 21, 14, 8, "#86CFA6"], [28, 21, 14, 8, "#6E9FD8"], [46, 10, 16, 16, "#9E86C8"]],
  zoom: [[0, 0, SCREEN_W, SCREEN_H, "#2C4A6E"], [6, 4, 30, 11, "#8FB8E0"], [40, 4, 30, 11, "#8FB8E0"], [6, 17, 30, 11, "#BEE7F7"], [40, 17, 30, 11, "#BEE7F7"]],
  chrome: [[0, 0, SCREEN_W, SCREEN_H, "#FFFFFF"], [0, 0, SCREEN_W, 8, "#EDEDED"], [30, 14, 16, 8, "#6E9FD8"], [28, 12, 8, 5, "#F0A79E"], [24, 18, 7, 8, "#86CFA6"], [40, 18, 7, 8, "#EFC08A"]],
  slack: [[0, 0, SCREEN_W, SCREEN_H, "#3F2A3F"], [6, 5, 8, 8, "#F0A79E"], [16, 5, 8, 8, "#86CFA6"], [6, 15, 8, 8, "#EFC08A"], [16, 15, 8, 8, "#6E9FD8"], [30, 6, 34, 3, "#EADFC7"], [30, 13, 26, 3, "#EADFC7"], [30, 20, 34, 3, "#EADFC7"]],
  notion: [[0, 0, SCREEN_W, SCREEN_H, "#F7F5F1"], [6, 5, 3, 12, "#2A2622"], [15, 5, 3, 12, "#2A2622"], [8, 6, 8, 3, "#2A2622"], [24, 7, 40, 3, "#9AA3A0"], [6, 17, 58, 3, "#9AA3A0"], [6, 24, 44, 3, "#9AA3A0"]],
};

function Station({ left, look, s, category, screenKind }) {
  const screen = cardCat(category).screen;
  const kindRects = screenKind ? TOOL_SCREEN_RECTS[screenKind] : null;
  return (
    <div style={{ position: "absolute", left, top: 40, display: "flex", width: 14 * s, height: 200 }}>
      <div style={{ position: "absolute", left: -28, top: 0, width: 100, height: 52, background: C.monitor }} />
      <div style={{ position: "absolute", left: -16, top: 10, width: 76, height: 32, background: kindRects ? "#000000" : screen }} />
      {kindRects
        ? kindRects.map(([x, y, w, h, bg], i) => (
            <div key={`sc${i}`} style={{ position: "absolute", left: -16 + x, top: 10 + y, width: w, height: h, background: bg }} />
          ))
        : [
            <div key="g1" style={{ position: "absolute", left: -8, top: 18, width: 44, height: 5, background: "#FFFFFF", opacity: 0.35 }} />,
            <div key="g2" style={{ position: "absolute", left: -8, top: 29, width: 26, height: 5, background: "#FFFFFF", opacity: 0.25 }} />,
          ]}
      {stationPropRects(category)}
      <div style={{ position: "absolute", left: -52, top: 58, width: 152, height: 12, background: C.deskTop }} />
      <div style={{ position: "absolute", left: -52, top: 70, width: 152, height: 24, background: C.desk }} />
      <div style={{ position: "absolute", left: -46, top: 94, width: 140, height: 8, borderRadius: 6, background: "#C9AE86", opacity: 0.35 }} />
      <div style={{ position: "absolute", left: 0, top: 96, display: "flex" }}>
        <Person look={look} s={s} />
      </div>
    </div>
  );
}

function ShareImage({ actors, title, offline }) {
  const s = 5;
  // spread up to 4 stations across the room band
  const slots = [150, 460, 770, 1000];
  // offline: no cast — we do not paint an absent user's last-known shape as if
  // it were live. The room shows an empty, lights-low office instead.
  const stations = offline
    ? []
    : actors.map((a, i) => {
        // core identity stays stable (LOOKS[i]); the specific APP only recolours
        // the sprite accent so the body reads on-tool without a costume swap. The
        // app screen + prop carry the "which app" read.
        const cl = cardLook(a);
        const look = { ...LOOKS[i % LOOKS.length], accent: cl.accent };
        const style = STATUS_STYLE[a.status] || STATUS_STYLE.idle;
        return { look, category: cl.category, screenKind: cl.screenKind, status: a.status || "idle", ...style, left: slots[i] || slots[slots.length - 1] };
      });
  const subhead = offline ? "away · nobody's in right now" : headline(actors);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.paper, color: C.ink, fontFamily: "Arial, Helvetica, sans-serif", padding: "44px 60px 0", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 900 }}>
          <div style={{ width: 68, height: 68, background: C.gold, border: `3px solid ${C.edge}`, borderRadius: 14, color: C.goldInk, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `5px 5px 0 #EFE4CE` }}>
            m
          </div>
          mumbl
        </div>
        <div style={{ display: "flex", padding: "12px 18px", border: `3px solid ${C.gold}`, borderRadius: 12, background: C.panel, color: C.goldInk, fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          mumbl.wtf/office/{title}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", position: "relative", marginTop: 44 }}>
        <div style={{ display: "flex", fontSize: 52, lineHeight: 1.08, fontWeight: 900, maxWidth: 1020 }}>
          {title}&apos;s office, right now.
        </div>
        <div style={{ marginTop: 16, fontSize: 25, lineHeight: 1.35, color: C.muted, maxWidth: 900 }}>
          {subhead}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", left: 60, bottom: 0, width: 1080, height: 300, border: `3px solid ${C.edge}`, borderBottom: "none", borderRadius: "18px 18px 0 0", background: C.floor, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 62, background: C.wall }} />
        <div style={{ position: "absolute", left: 0, top: 58, width: 1080, height: 4, background: "#A6D8D4" }} />
        {[210, 620].map((x) => (
          <div key={x} style={{ display: "flex", position: "absolute", left: x, top: 10, width: 190, height: 42 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 190, height: 42, background: C.wallTrim }} />
            <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 32, background: C.sky }} />
            <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 11, background: C.skyTop }} />
            <div style={{ position: "absolute", left: 5, top: 30, width: 180, height: 7, background: C.leaf }} />
            <div style={{ position: "absolute", left: 92, top: 0, width: 6, height: 42, background: C.wallTrim }} />
          </div>
        ))}

        <div style={{ position: "absolute", left: 40, top: 92, width: 1000, height: 208, background: C.carpet }} />
        <div style={{ position: "absolute", left: 40, top: 92, width: 1000, height: 4, background: C.carpetEdge }} />

        {stations.map((st, i) => (
          <Station key={i} left={st.left} look={st.look} s={s} category={st.category} screenKind={st.screenKind} />
        ))}
        {stations.map((st, i) => (
          <Pill key={`p${i}`} label={st.status.toUpperCase()} ink={st.ink} ring={st.ring} left={st.left - 38} />
        ))}
        {stations.length === 0 ? (
          <div style={{ display: "flex", position: "absolute", left: 60, top: 150, fontSize: 26, color: C.muted }}>
            {offline ? "the lights are off — this office is away." : "nobody at their desk right now."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
