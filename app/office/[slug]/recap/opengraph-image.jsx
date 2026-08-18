import { ImageResponse } from "next/og";
import { cleanString } from "../../../../src/server/validation";

export const alt = "A recap of my workday, in the mumbl office.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ────────────────────────────────────────────────────────────────────────────
// DAY RECAP — "Spotify Wrapped for your workday" (PROTOTYPE).
//
// A single postable card that summarizes a day in the office aesthetic: which
// APPS you used and roughly how long, top-app spotlight, and a couple of
// headline stats. Reuses the per-app visual vocabulary (brand accent + glyph +
// screen) from public/office/office-scene.js and app/office/[slug]/
// opengraph-image.jsx.
//
// SHAPE-ONLY: app names + durations only — never a window title, repo, doc, or
// any content. Same privacy boundary as the live card.
//
// DATA: this prototype renders REPRESENTATIVE MOCK data (recapMock below).
// There is no durable day history today — posture #2 makes agent_events
// ephemeral (~15 min TTL). The real version reads a small shape-only daily
// aggregate (spec in docs/office-visual-design.md §7: `daily_app_totals`), NOT a
// full event log. See mockToRecap() for the exact shape the route expects, so
// wiring real data later is a drop-in swap.
// ────────────────────────────────────────────────────────────────────────────

const C = {
  paper: "#FBF4E8", panel: "#FFFAF2", edge: "#E3D5BD", ink: "#3E4E4A", muted: "#7E8C86",
  gold: "#F6D9A8", goldInk: "#6B5334", track: "#EDE2CE", floor: "#DDBA88",
};

// Per-app brand accent + short glyph + a human label. Mirrors TOOL_LOOK /
// TOOL_CARD; kept inline so the recap route is a self-contained prototype.
const TOOL = {
  vscode: { accent: "#4FA5E0", glyph: "VS", label: "VS Code" },
  cursor: { accent: "#7FA6B8", glyph: "Cu", label: "Cursor" },
  terminal: { accent: "#4FB07E", glyph: ">_", label: "Terminal" },
  figma: { accent: "#F0736A", glyph: "Fi", label: "Figma" },
  photoshop: { accent: "#6E9FD8", glyph: "Ps", label: "Photoshop" },
  zoom: { accent: "#4A82D8", glyph: "Zm", label: "Zoom" },
  meet: { accent: "#57B884", glyph: "Mt", label: "Meet" },
  slack: { accent: "#9E6BA0", glyph: "#", label: "Slack" },
  spotify: { accent: "#5FBE7E", glyph: "Sp", label: "Spotify" },
  notion: { accent: "#59696E", glyph: "N", label: "Notion" },
  chrome: { accent: "#6E9FD8", glyph: "Ch", label: "Chrome" },
  other: { accent: "#C7D2CE", glyph: "•", label: "Other" },
};
const tool = (t) => TOOL[t] || TOOL.other;

// ── mock aggregate: one day, per-app seconds (the shape the real aggregate emits)
function recapMock() {
  return {
    date: "Aug 18",
    // { tool, seconds } — already summed per app for the day (shape-only)
    apps: [
      { tool: "vscode", seconds: 4 * 3600 + 20 * 60 },
      { tool: "figma", seconds: 2 * 3600 + 5 * 60 },
      { tool: "zoom", seconds: 1 * 3600 + 40 * 60 },
      { tool: "slack", seconds: 55 * 60 },
      { tool: "spotify", seconds: 3 * 3600 + 10 * 60 },
      { tool: "notion", seconds: 35 * 60 },
    ],
  };
}

function fmt(sec) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// aggregate → the derived view the card renders (pure; deterministic)
function mockToRecap(agg) {
  // "focused" = time in non-ambient work apps (music/other don't count as focus)
  const AMBIENT = new Set(["spotify", "apple-music", "other"]);
  const apps = [...agg.apps].sort((a, b) => b.seconds - a.seconds);
  const total = apps.reduce((s, a) => s + a.seconds, 0);
  const focused = apps.filter((a) => !AMBIENT.has(a.tool)).reduce((s, a) => s + a.seconds, 0);
  const top = apps[0];
  return {
    date: agg.date,
    apps,
    max: apps.length ? apps[0].seconds : 1,
    toolCount: apps.length,
    focused,
    total,
    top,
  };
}

export default async function Image({ params }) {
  const { slug } = await params;
  const title = cleanString(slug, 40) || "you";
  const recap = mockToRecap(recapMock());
  return new ImageResponse(<Recap title={title} r={recap} />, size);
}

function AppBar({ a, max }) {
  const t = tool(a.tool);
  const pct = Math.max(6, Math.round((a.seconds / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 16 }}>
      {/* glyph chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 10, background: t.accent, color: "#FFFFFF", fontSize: 20, fontWeight: 900, marginRight: 16, flexShrink: 0 }}>
        {t.glyph}
      </div>
      {/* name + bar */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700, color: C.ink, marginBottom: 5 }}>
          <div style={{ display: "flex" }}>{t.label}</div>
          <div style={{ display: "flex", color: C.muted, fontWeight: 700 }}>{fmt(a.seconds)}</div>
        </div>
        <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 7, background: C.track }}>
          <div style={{ display: "flex", width: `${pct}%`, height: 14, borderRadius: 7, background: t.accent }} />
        </div>
      </div>
    </div>
  );
}

function Stat({ big, small }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "14px 22px", borderRadius: 14, background: C.panel, border: `3px solid ${C.edge}`, marginRight: 16 }}>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 900, color: C.ink }}>{big}</div>
      <div style={{ display: "flex", fontSize: 16, color: C.muted, marginTop: 2 }}>{small}</div>
    </div>
  );
}

function Recap({ title, r }) {
  const topT = tool(r.top.tool);
  const bars = r.apps.slice(0, 6);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.paper, color: C.ink, fontFamily: "Arial, Helvetica, sans-serif", position: "relative" }}>
      {/* left: headline + stats */}
      <div style={{ display: "flex", flexDirection: "column", width: 560, padding: "48px 0 0 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 900 }}>
          <div style={{ width: 54, height: 54, background: C.gold, border: `3px solid ${C.edge}`, borderRadius: 12, color: C.goldInk, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "4px 4px 0 #EFE4CE" }}>
            m
          </div>
          mumbl
        </div>

        <div style={{ display: "flex", fontSize: 60, lineHeight: 1.05, fontWeight: 900, marginTop: 34 }}>
          {title}&apos;s day.
        </div>
        <div style={{ display: "flex", fontSize: 24, color: C.muted, marginTop: 12 }}>
          {r.date} · {r.toolCount} tools · {fmt(r.focused)} focused
        </div>

        {/* stats row */}
        <div style={{ display: "flex", marginTop: 34 }}>
          <Stat big={fmt(r.focused)} small="focused" />
          <Stat big={String(r.toolCount)} small="tools used" />
        </div>

        {/* most-used spotlight */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 30, padding: "16px 20px", borderRadius: 14, background: C.panel, border: `3px solid ${topT.accent}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 12, background: topT.accent, color: "#FFFFFF", fontSize: 22, fontWeight: 900, marginRight: 16 }}>
            {topT.glyph}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 15, color: C.muted, letterSpacing: 1, fontWeight: 700 }}>MOST TIME IN</div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 900 }}>{topT.label} · {fmt(r.top.seconds)}</div>
          </div>
        </div>

        <div style={{ display: "flex", position: "absolute", left: 60, bottom: 30, fontSize: 18, color: C.muted, fontWeight: 700 }}>
          mumbl.wtf/office/{title}/recap
        </div>
      </div>

      {/* right: the app-time chart (fixed width so full bars stay on-card) */}
      <div style={{ display: "flex", flexDirection: "column", width: 540, padding: "72px 60px 60px 20px", justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: 18, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 22 }}>
          WHERE THE DAY WENT
        </div>
        {bars.map((a, i) => (
          <AppBar key={i} a={a} max={r.max} />
        ))}
      </div>
    </div>
  );
}
