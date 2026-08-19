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
  terminal: { accent: "#9BD8B4", category: "coding", screen: "terminal", station: "terminal", label: "Terminal" },
  iterm: { accent: "#9BD8B4", category: "coding", screen: "terminal", station: "terminal", label: "iTerm" },
  ghostty: { accent: "#CFBBF0", category: "coding", screen: "terminal", station: "terminal", label: "Ghostty" },
  warp: { accent: "#6E9FD8", category: "coding", screen: "terminal", station: "terminal", label: "Warp" },
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
    // a tool may override which STATION PROP is drawn (terminal → ops rack) while
    // keeping its category for zone/screen; falls back to the category otherwise.
    station: (t && t.station) || cat,
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
  // Mirrors the upgraded 16×22 makePerson in public/office/office-scene.js.
  // Same geometry: wider canvas, shoulder flare, shaped head, proper shading
  // expressed as extra tinted rects (no globalAlpha in satori — use hex with
  // baked-in opacity approximation).
  const hairStyle = look.hairStyle || "short";
  const outfit = look.outfit || "plain";
  const accessory = look.accessory || "none";
  const accent = look.accent || "#FFF8EC";
  // Body geometry — mirrors makePerson
  const tx = look.build === "slim" ? 4 : look.build === "broad" ? 2 : 3;
  const tw = look.build === "slim" ? 8 : look.build === "broad" ? 12 : 10;
  const shoulderX = tx - 1;
  const shoulderW = tw + 2;
  const legL = tx + 1;
  const legR = tx + tw - 3;
  const r = [];
  const put = (x, y, w, h, fill, extra) => r.push([x, y, w, h, fill, extra]);

  // ---- HAIR ----
  if (hairStyle === "curly") {
    put(4, 0, 8, 6, look.hair); put(3, 1, 1, 4, look.hair); put(12, 1, 1, 4, look.hair);
    put(5, 0, 6, 1, look.hair);
  } else if (hairStyle === "bun") {
    put(6, 0, 4, 2, look.hair); // bun knot
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
  } else if (hairStyle === "cap") {
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
    put(4, 1, 8, 2, accent); put(3, 3, 5, 1, accent); put(4, 3, 8, 1, C.line);
  } else if (hairStyle === "beanie") {
    put(4, 2, 8, 4, look.hair);
    put(4, 1, 8, 3, accent); put(4, 3, 8, 1, C.line); put(7, 0, 2, 1, accent);
  } else if (hairStyle === "long") {
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
    put(3, 3, 1, 10, look.hair); put(12, 3, 1, 10, look.hair); // side curtains
    put(4, 12, 1, 4, look.hair); put(11, 12, 1, 4, look.hair); // tapered ends
  } else {
    // short default
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
  }

  // ---- FACE ----
  put(5, 3, 6, 1, look.hair); // hairline connector
  put(5, 4, 6, 4, look.skin); // main face block (6 wide, slightly indented → rounder feel)
  // Eyes
  put(6, 6, 1, 1, C.line); put(9, 6, 1, 1, C.line);
  // Neck
  put(7, 8, 2, 1, look.skin);

  // ---- TORSO ----
  put(shoulderX, 9, shoulderW, 1, look.shirt); // shoulder row (wider = shoulder flare)
  put(tx, 10, tw, 5, look.shirt);              // main torso
  put(tx - 1, 10, 1, 5, look.shirt); put(tx + tw, 10, 1, 5, look.shirt); // arms
  put(tx - 1, 14, 1, 2, look.skin); put(tx + tw, 14, 1, 2, look.skin);  // hands

  // ---- OUTFIT ----
  if (outfit === "hoodie") {
    put(tx, 10, tw, 2, accent);
    put(7, 12, 1, 2, accent); put(9, 12, 1, 2, accent); // drawstrings
    put(tx + 1, 13, tw - 2, 2, C.line); // pocket seam
  } else if (outfit === "collar") {
    put(tx, 10, 2, 5, accent); put(tx + tw - 2, 10, 2, 5, accent);
    put(7, 10, 2, 1, "#FFF8EC"); put(7, 11, 2, 4, look.pants);
  } else if (outfit === "stripes") {
    [11, 13].forEach((y) => put(tx, y, tw, 1, accent));
  } else if (outfit === "vest") {
    put(tx, 10, 2, 5, accent); put(tx + tw - 2, 10, 2, 5, accent);
    put(tx + 2, 10, tw - 4, 1, "#FFF8EC");
  } else if (outfit === "overalls") {
    put(tx + 1, 10, 1, 4, look.pants); put(tx + tw - 2, 10, 1, 4, look.pants);
    put(tx + 1, 12, tw - 2, 3, look.pants);
    put(tx + 3, 13, 2, 2, accent);
  } else if (outfit === "apron") {
    put(tx + 1, 11, tw - 2, 4, accent);
    put(tx + 2, 10, 1, 2, accent); put(tx + tw - 3, 10, 1, 2, accent);
  }

  // ---- LEGS ----
  put(legL, 16, 2, 4, look.pants); put(legR, 16, 2, 4, look.pants);
  put(legL - 1, 20, 3, 1, C.shoe); put(legR, 20, 3, 1, C.shoe);

  // ---- ACCESSORIES ----
  if (accessory === "glasses") {
    // Two lens blocks + bridge + temples
    put(5, 5, 3, 2, C.line); put(8, 5, 3, 2, C.line);
    put(7, 5, 2, 1, C.line); // bridge
    put(4, 5, 1, 2, C.line); put(11, 5, 1, 2, C.line); // temples
  } else if (accessory === "headphones") {
    put(4, 1, 8, 1, C.line); // headband arc over top
    put(3, 3, 2, 4, C.line); put(11, 3, 2, 4, C.line); // ear cups
  } else if (accessory === "scarf") {
    put(tx + 1, 8, tw - 2, 2, accent);
    put(tx + tw - 2, 10, 2, 3, accent); // drape
  } else if (accessory === "earrings") {
    put(4, 7, 1, 1, accent); put(11, 7, 1, 1, accent);
  } else if (accessory === "lanyard") {
    put(7, 10, 1, 4, C.line); put(9, 10, 1, 4, C.line);
    put(7, 13, 3, 3, accent);
  }
  return r;
}

function Person({ look, s }) {
  // 16×22 canvas to match the upgraded makePerson in office-scene.js
  return (
    <div style={{ display: "flex", position: "relative", width: 16 * s, height: 22 * s }}>
      {look.glow ? (
        <div style={{ position: "absolute", left: 1 * s, top: 2 * s, width: 14 * s, height: 20 * s, background: look.glow, opacity: 0.22 }} />
      ) : null}
      {personRects(look).map(([x, y, w, h, fill, extra], i) => (
        <div key={i} style={{ position: "absolute", left: x * s, top: y * s, width: w * s, height: h * s, background: fill, ...(extra || {}) }} />
      ))}
    </div>
  );
}

function Pill({ label, ink, ring, left, top = 84 }) {
  return (
    <div style={{ position: "absolute", left, top, display: "flex", padding: "5px 11px", borderRadius: 8, background: "#FFF6E4", border: `3px solid ${ring}`, color: ink, fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
      {label}
    </div>
  );
}

// Static signature prop per category, mirroring STATION_DRAW in the live engine.
// Positioned divs only (Satori-safe). Coordinates are relative to the Station's
// origin. The screen tint + this prop carry the "which tool" read with no
// animation — exactly what the card needs.
//
// These are drawn AFTER the desk surface divs (top:58/70) so props that sit ON
// the desk are visible above it. Props at negative top are against the wall/monitor
// area and also remain visible (they're above the monitor, which ends at top:52).
const STATION_PROP_RECTS = {
  // [left, top, width, height, background, extra?] — relative to the Station div.
  // CODING — a code-lit NOOK: green glow band + syntax code lines + a SECOND
  // angled monitor and a terminal slab on the desk (mirrors the v2 live set piece).
  coding: [
    // terminal-green glow spilling onto the desk
    [-48, 54, 150, 12, "#2E4A3A", { opacity: 0.28 }],
    // main-screen syntax code lines
    [-8, 16, 34, 4, "#9BD8B4", { opacity: 0.9 }],
    [-8, 24, 22, 4, "#4E7D66", { opacity: 0.9 }],
    [-8, 32, 30, 4, "#EFC08A", { opacity: 0.85 }],   // a "string" line
    [-8, 40, 40, 4, "#9BD8B4", { opacity: 0.9 }],
    // SECOND monitor, angled to the right
    [58, 6, 26, 30, "#2A3237"],
    [61, 9, 20, 24, "#1E262B"],
    [64, 13, 14, 3, "#9BD8B4", { opacity: 0.85 }],
    [64, 19, 16, 3, "#4E7D66", { opacity: 0.85 }],
    [64, 25, 10, 3, "#EFC08A", { opacity: 0.8 }],
    // TERMINAL slab on the desk (black + green prompt)
    [-52, 66, 26, 18, "#0E1216"],
    [-48, 70, 3, 3, "#9BD8B4"],
    [-43, 70, 12, 3, "#9BD8B4", { opacity: 0.9 }],
    [-48, 76, 16, 3, "#86CFA6", { opacity: 0.8 }],
    // status LED
    [24, 62, 4, 4, "#86CFA6", { borderRadius: 4 }],
  ],
  // REVIEW — an INSPECTION station: diff screen (+/−) + a corkboard of PR tickets
  // with ✓/✗ stamps + a magnifier on the desk, violet glow (mirrors v3 live).
  review: [
    // violet glow
    [-48, 54, 150, 12, "#CFBBF0", { opacity: 0.22 }],
    // diff lines (+ green / − red) on the monitor
    [-8, 16, 4, 4, "#86CFA6"], [-2, 16, 34, 4, "#86CFA6"],
    [-8, 24, 4, 4, "#F09B90"], [-2, 24, 26, 4, "#F09B90"],
    [-8, 32, 4, 4, "#86CFA6"], [-2, 32, 40, 4, "#86CFA6"],
    // corkboard of PR tickets floating above the desk
    [-64, -18, 62, 46, "#C7A16A"],   // cork frame
    [-60, -14, 54, 38, "#D8B681"],   // cork face
    [-56, -10, 14, 18, "#FFFBF0"], [-56, -10, 14, 5, "#CFBBF0"], [-52, -2, 6, 6, "#2E7F5C"],  // ticket 1 ✓
    [-38, -6, 14, 18, "#FFFBF0"], [-38, -6, 14, 5, "#CFBBF0"], [-34, 2, 6, 6, "#B0554C"],     // ticket 2 ✗
    [-20, -10, 14, 18, "#FFFBF0"], [-20, -10, 14, 5, "#CFBBF0"], [-16, -2, 6, 6, "#2E7F5C"],  // ticket 3 ✓
    // magnifier on the desk
    [44, 70, 16, 16, "#8A9EA8", { borderRadius: 16 }],
    [48, 74, 8, 8, "#EAF4F8", { borderRadius: 8 }],
    [58, 82, 10, 4, "#6E543A"],
  ],
  // DESIGN — a drafting STUDIO: a tilted easel/artboard (bright lightbox canvas
  // with a composition-in-progress + selection frame) + a swatch tray of chips on
  // the desk + a stylus, over a blush glow (mirrors the v2 live set piece).
  design: [
    // blush studio glow
    [-60, 40, 150, 20, "#F6BCD1", { opacity: 0.2 }],
    // easel frame + bright canvas floating above the monitor
    [-64, -20, 58, 46, "#E0CBA6"],       // frame
    [-61, -17, 52, 40, "#FBF7F0"],       // bright canvas (lightbox)
    // composition-in-progress
    [-54, -10, 20, 15, "#CFBBF0"],       // accent block (the "cycling" one)
    [-32, -14, 16, 11, "#BEE7F7"],
    [-28, 4, 14, 12, "#F4B3A6", { borderRadius: 12 }],
    [-56, 6, 18, 2, "#59696E", { opacity: 0.55 }],
    [-56, 10, 12, 2, "#59696E", { opacity: 0.55 }],
    // selection frame around the accent block
    [-56, -12, 24, 19, "transparent", { border: "1px solid #F6BCD1" }],
    // swatch TRAY of chips on the desk + a stylus
    [-30, 68, 52, 12, "#EADFC7"],
    [-27, 71, 7, 6, "#F4B3A6"], [-19, 71, 7, 6, "#F8DFA0"], [-11, 71, 7, 6, "#9BD8B4"],
    [-3, 71, 7, 6, "#BEE7F7"], [5, 71, 7, 6, "#CFBBF0"], [13, 71, 7, 6, "#F6BCD1"],
    [30, 70, 16, 3, "#E29CBE"],           // stylus
  ],
  // CALL — the meeting room LIT UP: a wall display tiled with participant camera
  // faces + an "● ON AIR" bar, over a cool sky wash (mirrors the v2 live set piece).
  call: [
    // cool "room lights up" wash behind the screen
    [-40, -30, 130, 60, "#BEE7F7", { opacity: 0.28 }],
    // display bezel + dark room fill, floating above the desk
    [-34, -26, 88, 60, "#24333F"],
    [-30, -22, 80, 52, "#1B2732"],
    // 2x3 grid of participant camera tiles (each: colored fill + head/shoulders)
    [-27, -19, 24, 22, "#6E9FD8", { opacity: 0.85 }],
    [-1, -19, 24, 22, "#86CFA6", { opacity: 0.85 }],
    [25, -19, 24, 22, "#F0A79E", { opacity: 0.85 }],
    [-27, 5, 24, 22, "#EFC08A", { opacity: 0.85 }],
    [-1, 5, 24, 22, "#9E86C8", { opacity: 0.85 }],
    [25, 5, 24, 22, "#BEE7F7", { opacity: 0.85 }],
    // a couple of head/shoulders silhouettes to read as faces
    [-19, -8, 8, 9, "#2E3A44", { opacity: 0.9 }], [-17, -15, 5, 6, "#2E3A44", { opacity: 0.9 }],
    [7, -8, 8, 9, "#2E3A44", { opacity: 0.9 }], [9, -15, 5, 6, "#2E3A44", { opacity: 0.9 }],
    // "● ON AIR" bar above the screen
    [-16, -38, 52, 10, "#7A2E2E"],
    [-12, -35, 4, 4, "#F0605A", { borderRadius: 4 }],  // on-air dot
    [-4, -34, 34, 4, "#FFE3DC", { opacity: 0.9 }],     // "ON AIR" text bar
    // active-speaker highlight ring on the first tile
    [-27, -19, 24, 22, "transparent", { border: "2px solid #FFF6E4" }],
  ],
  // MUSIC — a TURNTABLE CONSOLE on the desk: wood cabinet + raised deck + thick
  // grooved vinyl + chrome tonearm & counterweight + a VU/EQ strip + rising notes,
  // over a warm glow (mirrors the v2 live set piece). Drawn after the desk divs so
  // it's fully visible (og-prop-zorder fix).
  music: [
    // warm glow pooling under the console
    [-52, 78, 120, 16, "#F8DFA0", { opacity: 0.24 }],
    // console cabinet — wood grain body + highlight + feet
    [-50, 58, 76, 30, "#9E7A52"],                        // rim
    [-47, 61, 70, 24, "#CBA87C"],                        // main chassis
    [-47, 61, 70, 4, "#D4A86A"],                         // wood highlight
    [-46, 86, 6, 4, "#6E543A"], [16, 86, 6, 4, "#6E543A"], // feet
    // raised platter deck + thick grooved vinyl
    [-34, 62, 46, 22, "#3A342E", { borderRadius: 24 }],  // platter deck
    [-31, 64, 40, 18, "#2A2622", { borderRadius: 22 }],  // vinyl outer
    [-27, 66, 32, 14, "#3A3430", { borderRadius: 18 }],  // inner groove
    [-15, 69, 8, 8, "#F4B3A6", { borderRadius: 8 }],     // centre label
    [-5, 70, 2, 2, "#FFFBF0"],                           // spindle highlight
    // tonearm + counterweight
    [16, 56, 4, 16, "#9AA6A8"],                          // pivot post
    [12, 54, 10, 4, "#6E7276"],                          // counterweight
    [2, 64, 16, 3, "#B7C9CB"],                           // arm
    // VU / EQ strip — 4 bars of varied height
    [-44, 76, 4, 8, "#9BD8B4"], [-38, 78, 4, 6, "#9BD8B4"], [-32, 74, 4, 10, "#9BD8B4"], [-26, 79, 4, 5, "#9BD8B4"],
    // rising notes (small note-heads + stems, as tinted rects)
    [24, 50, 6, 6, "#9BD8B4", { borderRadius: 6 }], [29, 44, 2, 8, "#9BD8B4"],
    [34, 40, 5, 5, "#F8DFA0", { borderRadius: 6 }], [38, 35, 2, 7, "#F8DFA0"],
  ],
  // WRITING — a warm LIBRARY NOOK: gooseneck lamp (amber pool) + an open
  // manuscript (two pages) + a stack of books + a mug (mirrors v3 live).
  writing: [
    // amber lamp glow band
    [-48, 56, 150, 10, "#F8DFA0", { opacity: 0.24 }],
    // gooseneck lamp
    [44, 62, 4, 18, "#B7C9CB"],     // pole
    [40, 48, 4, 14, "#B7C9CB"],     // stem
    [30, 46, 14, 3, "#B7C9CB"],     // neck
    [26, 46, 10, 6, "#F8DFA0"],     // shade
    [28, 51, 6, 2, "#FFF3C4"],      // bulb
    // open manuscript (book cover + two facing pages)
    [-40, 66, 40, 22, "#E8DCC4"],
    [-37, 68, 17, 18, "#FFFBF0"], [-18, 68, 17, 18, "#FFFBF0"],
    [-19, 68, 2, 18, "#C7A16A"],    // spine
    [-33, 73, 11, 2, "#59696E", { opacity: 0.6 }], [-33, 78, 9, 2, "#59696E", { opacity: 0.6 }],
    [-14, 73, 11, 2, "#59696E", { opacity: 0.6 }],
    // stack of books on the left
    [-66, 78, 16, 4, "#F4B3A6"], [-65, 73, 15, 4, "#BEE7F7"], [-66, 68, 14, 4, "#9BD8B4"],
    // mug
    [10, 72, 8, 7, "#FFFBF0"], [18, 74, 3, 3, "#F4B3A6"],
  ],
  // BROWSING — a READING PERCH: a propped laptop (browser chrome + article cards)
  // + a floating bookmark tab + a mug, over a coral glow (mirrors v3 live).
  browsing: [
    // coral glow band
    [-48, 56, 150, 10, "#F4B3A6", { opacity: 0.2 }],
    // laptop screen
    [-30, 52, 44, 30, "#2E3438"],   // screen frame
    [-27, 55, 38, 24, "#F0E8DA"],   // page bg
    [-27, 55, 38, 5, "#F4B3A6"],    // browser chrome bar
    [-24, 56, 5, 3, "#6E9FD8"], [-17, 56, 5, 3, "#86CFA6"],  // tabs
    [-24, 62, 10, 8, "#CBD8DA"], [-24, 72, 10, 5, "#CBD8DA"],  // thumbnails
    [-12, 62, 22, 3, "#596E6E", { opacity: 0.55 }], [-12, 66, 16, 3, "#596E6E", { opacity: 0.55 }], [-12, 72, 22, 3, "#596E6E", { opacity: 0.55 }],
    [-32, 80, 50, 5, "#9AA6A2"],    // laptop base deck
    // floating bookmark tab
    [22, 48, 8, 14, "#F8DFA0"], [22, 60, 8, 4, "#E4C878"],
    // mug
    [38, 74, 8, 7, "#FFFBF0"], [46, 76, 3, 3, "#BEE7F7"],
  ],
  // TERMINAL — a SERVER / OPS station: a server rack of blinking LEDs + a black
  // prompt slab with a running log + green caret (mirrors v3 live).
  terminal: [
    // green ops glow band
    [-48, 56, 150, 10, "#2E4A3A", { opacity: 0.22 }],
    // server rack (right of desk): chassis + 4 stacked units w/ LEDs
    [40, 30, 34, 60, "#3A4750"],
    [44, 34, 26, 52, "#2A343C"],
    [48, 38, 22, 9, "#4A5A62"], [54, 40, 10, 2, "#6E7E79"], [66, 41, 3, 3, "#86CFA6"],
    [48, 50, 22, 9, "#4A5A62"], [54, 52, 10, 2, "#6E7E79"], [66, 53, 3, 3, "#EFC08A"],
    [48, 62, 22, 9, "#4A5A62"], [54, 64, 10, 2, "#6E7E79"], [66, 65, 3, 3, "#86CFA6"],
    [48, 74, 22, 9, "#4A5A62"], [54, 76, 10, 2, "#6E7E79"], [66, 77, 3, 3, "#F09B90"],
    // black prompt slab on the desk w/ a running log
    [-40, 64, 46, 20, "#0E1216"],
    [-36, 67, 3, 3, "#9BD8B4"], [-31, 67, 14, 3, "#9BD8B4"],
    [-36, 73, 26, 2, "#86CFA6", { opacity: 0.8 }], [-36, 78, 16, 2, "#86CFA6", { opacity: 0.8 }],
    [-8, 78, 3, 3, "#9BD8B4"],  // caret
  ],
  // FOCUS / OTHER — the QUIET nook: a small potted plant + a mug, soft glow.
  focus: [
    [-48, 60, 150, 8, "#BBDCF0", { opacity: 0.16 }],  // soft breathing glow band
    // potted plant
    [44, 72, 12, 10, "#8A5E38"], [44, 72, 12, 2, "#6B4A2F"],
    [45, 62, 10, 10, "#B6E4C0"], [48, 58, 4, 5, "#B6E4C0"],
    // coffee mug + steam
    [-40, 74, 10, 8, "#FFFBF0"], [-30, 76, 3, 4, "#BEE7F7"],
    [-37, 68, 3, 5, "#FFFFFF", { opacity: 0.4 }],
  ],
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

function Station({ left, look, s, category, station, screenKind }) {
  const screen = cardCat(category).screen;
  const kindRects = screenKind ? TOOL_SCREEN_RECTS[screenKind] : null;
  // the prop is chosen by `station` (a tool may override it, e.g. terminal → ops
  // rack) while the screen tint stays keyed on `category`.
  const propKey = station || category;
  // Station geometry: monitor at top, then desk surface, then person sitting in front.
  // stationPropRects are drawn AFTER the desk divs so props with top >= 58 (music
  // record player, browsing tablet, etc.) render above the desk surface and are
  // visible — the og-prop-zorder fix.
  return (
    <div style={{ position: "absolute", left, top: 40, display: "flex", width: 16 * s, height: 200 }}>
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
      <div style={{ position: "absolute", left: -52, top: 58, width: 152, height: 12, background: C.deskTop }} />
      <div style={{ position: "absolute", left: -52, top: 70, width: 152, height: 24, background: C.desk }} />
      <div style={{ position: "absolute", left: -46, top: 94, width: 140, height: 8, borderRadius: 6, background: "#C9AE86", opacity: 0.35 }} />
      {stationPropRects(propKey)}
      <div style={{ position: "absolute", left: 0, top: 96, display: "flex" }}>
        <Person look={look} s={s} />
      </div>
    </div>
  );
}

function ShareImage({ actors, title, offline }) {
  const s = 5;
  // Spread up to 4 stations EVENLY across the room band (inner width ~1080). Slots
  // are pulled in from the edges so wide set-pieces — the music turntable console
  // (extends ~-52..+40 from its slot) especially — read FULLY without clipping at
  // the right edge. Even 270px pitch keeps the room feeling like one shared floor.
  const slots = [130, 400, 670, 940];
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
        // the music turntable console is the one set piece tall enough to sit at
        // the default pill height — drop its status pill onto the desk front so the
        // console reads fully (all other stations keep the default pill position).
        const pillTop = cl.station === "music" ? 140 : 84;
        return { look, category: cl.category, station: cl.station, screenKind: cl.screenKind, status: a.status || "idle", ...style, left: slots[i] || slots[slots.length - 1], pillTop };
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

      {/* ONE cohesive room, not a row of separate desks: a single shared back
          wall + continuous window band + one warm floor plane, plus a consistent
          top-left light wash tying every station into the same space. */}
      <div style={{ display: "flex", position: "absolute", left: 60, bottom: 0, width: 1080, height: 300, border: `3px solid ${C.edge}`, borderBottom: "none", borderRadius: "18px 18px 0 0", background: C.floor, overflow: "hidden" }}>
        {/* shared back wall + baseboard trim, spanning the whole room */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 62, background: C.wall }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 62, background: "linear-gradient(105deg, #FFFFFF 0%, rgba(255,255,255,0) 42%)", opacity: 0.35 }} />
        <div style={{ position: "absolute", left: 0, top: 58, width: 1080, height: 4, background: "#A6D8D4" }} />
        {/* continuous ribbon window running the length of the wall — one shared space */}
        {[70, 340, 610, 880].map((x) => (
          <div key={x} style={{ display: "flex", position: "absolute", left: x, top: 10, width: 190, height: 42 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 190, height: 42, background: C.wallTrim }} />
            <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 32, background: C.sky }} />
            <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 11, background: C.skyTop }} />
            <div style={{ position: "absolute", left: 5, top: 30, width: 180, height: 7, background: C.leaf }} />
            <div style={{ position: "absolute", left: 92, top: 0, width: 6, height: 42, background: C.wallTrim }} />
          </div>
        ))}
        {/* string lights across the whole room — a shared ceiling detail */}
        <div style={{ position: "absolute", left: 0, top: 60, width: 1080, height: 2, background: "#C3D4D6", opacity: 0.7 }} />
        {[120, 300, 480, 660, 840, 1020].map((x, i) => (
          <div key={`b${x}`} style={{ position: "absolute", left: x, top: 60, width: 7, height: 9, borderRadius: 3, background: ["#F4B3A6", "#F8DFA0", "#9BD8B4", "#BEE7F7", "#CFBBF0", "#F9CBDA"][i % 6], opacity: 0.9 }} />
        ))}

        {/* one continuous floor plane: carpet + a shared warm rug under all desks */}
        <div style={{ position: "absolute", left: 40, top: 92, width: 1000, height: 208, background: C.carpet }} />
        <div style={{ position: "absolute", left: 40, top: 92, width: 1000, height: 4, background: C.carpetEdge }} />
        <div style={{ position: "absolute", left: 70, top: 150, width: 940, height: 140, borderRadius: 12, background: "#CBD6F0", opacity: 0.5 }} />
        {/* consistent light direction: a soft top-left wash over the whole floor */}
        <div style={{ position: "absolute", left: 0, top: 62, width: 1080, height: 238, background: "linear-gradient(115deg, rgba(255,247,225,0.5) 0%, rgba(255,247,225,0) 50%)" }} />

        {stations.map((st, i) => (
          <Station key={i} left={st.left} look={st.look} s={s} category={st.category} station={st.station} screenKind={st.screenKind} />
        ))}
        {stations.map((st, i) => (
          <Pill key={`p${i}`} label={st.status.toUpperCase()} ink={st.ink} ring={st.ring} left={st.left - 38} top={st.pillTop} />
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
