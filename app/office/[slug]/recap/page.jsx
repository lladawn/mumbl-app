/**
 * /office/[slug]/recap — browsable day-recap page.
 *
 * Renders the same archetype headline, summary, time-breakdown, and stat
 * numbers as the OG share card (opengraph-image.jsx). Data source:
 *   - "demo" slug → stable mock sample (recapMock variant 0)
 *   - Any other slug → today's daily_app_totals aggregate; falls back to mock
 *     when no real rows exist yet.
 *
 * Reuses the same data functions (recapMock, mockToRecap, pickArchetype, fmt)
 * by importing them from a shared module — but those functions live inline in
 * opengraph-image.jsx (a Next.js route file) so we re-declare the data layer
 * here (small duplication, isolated to pure functions). The visual design
 * matches the OG card palette and type scale.
 */

import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { readDayRecap } from "../../../../src/server/dayRecap";
import { cleanString } from "../../../../src/server/validation";

export const dynamic = "force-dynamic";

// ── Palette — matches opengraph-image.jsx exactly
const C = {
  paper: "#FBF4E8", panel: "#FFFAF2", edge: "#E3D5BD", ink: "#3E4E4A", muted: "#7E8C86",
  gold: "#F6D9A8", goldInk: "#6B5334", track: "#EDE2CE", floor: "#DDBA88",
  wall: "#C7E9E5", wallTrim: "#FFF8EC", sky: "#BEE7F7", skyTop: "#DCF3FC",
  leaf: "#B6E4C0", carpet: "#D2DAF0", carpetEdge: "#AEB9DE",
  deskTop: "#F0D5A8", desk: "#E3C094", monitor: "#9FB3BE", line: "#59696E",
  shoe: "#8A7358",
};

// ── Per-tool look — mirrors TOOL in opengraph-image.jsx
const TOOL = {
  vscode:        { accent: "#4FA5E0", glyph: "VS", label: "VS Code",      category: "coding"   },
  cursor:        { accent: "#7FA6B8", glyph: "Cu", label: "Cursor",       category: "coding"   },
  xcode:         { accent: "#4FA5E0", glyph: "Xc", label: "Xcode",        category: "coding"   },
  intellij:      { accent: "#F0A79E", glyph: "IJ", label: "IntelliJ",     category: "coding"   },
  pycharm:       { accent: "#9BD8B4", glyph: "Py", label: "PyCharm",      category: "coding"   },
  zed:           { accent: "#6E9FD8", glyph: "Ze", label: "Zed",          category: "coding"   },
  sublime:       { accent: "#EFC08A", glyph: "Su", label: "Sublime",      category: "coding"   },
  terminal:      { accent: "#4FB07E", glyph: ">_", label: "Terminal",     category: "coding",  isTerminal: true },
  iterm:         { accent: "#4FB07E", glyph: ">_", label: "iTerm",        category: "coding",  isTerminal: true },
  ghostty:       { accent: "#CFBBF0", glyph: ">_", label: "Ghostty",      category: "coding",  isTerminal: true },
  warp:          { accent: "#6E9FD8", glyph: ">_", label: "Warp",         category: "coding",  isTerminal: true },
  figma:         { accent: "#F0736A", glyph: "Fi", label: "Figma",        category: "design"   },
  sketch:        { accent: "#EFC08A", glyph: "Sk", label: "Sketch",       category: "design"   },
  photoshop:     { accent: "#6E9FD8", glyph: "Ps", label: "Photoshop",    category: "design"   },
  illustrator:   { accent: "#EFB472", glyph: "Ai", label: "Illustrator",  category: "design"   },
  zoom:          { accent: "#4A82D8", glyph: "Zm", label: "Zoom",         category: "call"     },
  meet:          { accent: "#57B884", glyph: "Mt", label: "Meet",         category: "call"     },
  teams:         { accent: "#9E86C8", glyph: "Te", label: "Teams",        category: "call"     },
  discord:       { accent: "#9E86C8", glyph: "Dc", label: "Discord",      category: "call"     },
  slack:         { accent: "#9E6BA0", glyph: "#",  label: "Slack",        category: "browsing", isChat: true },
  spotify:       { accent: "#5FBE7E", glyph: "Sp", label: "Spotify",      category: "music"    },
  "apple-music": { accent: "#F0736A", glyph: "♪",  label: "Apple Music",  category: "music"    },
  notion:        { accent: "#59696E", glyph: "N",  label: "Notion",       category: "writing"  },
  obsidian:      { accent: "#9E86C8", glyph: "Ob", label: "Obsidian",     category: "writing"  },
  notes:         { accent: "#F8DFA0", glyph: "Nt", label: "Notes",        category: "writing"  },
  word:          { accent: "#6E9FD8", glyph: "W",  label: "Word",         category: "writing"  },
  chrome:        { accent: "#6E9FD8", glyph: "Ch", label: "Chrome",       category: "browsing" },
  safari:        { accent: "#6E9FD8", glyph: "Sa", label: "Safari",       category: "browsing" },
  arc:           { accent: "#F6BCD1", glyph: "Ar", label: "Arc",          category: "browsing" },
  firefox:       { accent: "#EFB472", glyph: "Fx", label: "Firefox",      category: "browsing" },
  other:         { accent: "#C7D2CE", glyph: "•",  label: "Other",        category: "other"    },
};
const tool = (t) => TOOL[t] || TOOL.other;

const AMBIENT_TOOLS = new Set(["spotify", "apple-music", "other"]);
const CHAT_TOOLS    = new Set(["slack", "discord", "teams"]);
const DEMO_SLUG = "demo";

// ── Time formatter
function fmt(sec) {
  if (!sec || sec <= 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}h${String(m).padStart(2, "0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ── Mock shapes (same as opengraph-image.jsx)
function recapMock(variant = 0) {
  const shapes = [
    {
      date: "Aug 18",
      apps: [
        { tool: "vscode",  seconds: 6 * 3600 + 20 * 60 },
        { tool: "slack",   seconds: 25 * 60 },
        { tool: "chrome",  seconds: 15 * 60 },
        { tool: "spotify", seconds: 2 * 3600 + 10 * 60 },
      ],
    },
    {
      date: "Aug 19",
      apps: [
        { tool: "zoom",    seconds: 3 * 3600 + 10 * 60 },
        { tool: "slack",   seconds: 1 * 3600 + 5 * 60  },
        { tool: "notion",  seconds: 20 * 60 },
        { tool: "vscode",  seconds: 45 * 60 },
        { tool: "spotify", seconds: 1 * 3600 + 30 * 60 },
      ],
    },
    {
      date: "Aug 20",
      apps: [
        { tool: "vscode",    seconds: 3 * 3600 + 35 * 60 },
        { tool: "terminal",  seconds: 1 * 3600 + 20 * 60 },
        { tool: "chrome",    seconds: 40 * 60 },
        { tool: "slack",     seconds: 30 * 60 },
        { tool: "spotify",   seconds: 2 * 3600 },
        { tool: "notion",    seconds: 15 * 60 },
      ],
      injectCatSec: { review: 40 * 60 },
    },
  ];
  return shapes[variant % shapes.length];
}

// ── Aggregate → derived recap view (pure, mirrors opengraph-image.jsx)
function aggToRecap(agg) {
  const apps = [...(agg.apps || [])].sort((a, b) => b.seconds - a.seconds);
  const total = apps.reduce((s, a) => s + a.seconds, 0);
  const focused = apps.filter((a) => !AMBIENT_TOOLS.has(a.tool)).reduce((s, a) => s + a.seconds, 0);

  const catSecRaw = {};
  for (const a of apps) {
    const cat = tool(a.tool).category || "other";
    catSecRaw[cat] = (catSecRaw[cat] || 0) + a.seconds;
  }
  const catSec = { ...catSecRaw, ...(agg.injectCatSec || {}) };

  const musicSec = catSec.music || 0;
  const musicRatio = total > 0 ? musicSec / total : 0;

  const focusApps = apps.filter((a) => !AMBIENT_TOOLS.has(a.tool));
  const topApp    = focusApps[0] ? { ...focusApps[0], ...tool(focusApps[0].tool), seconds: focusApps[0].seconds } : null;
  const secondApp = focusApps[1] ? { ...tool(focusApps[1].tool), seconds: focusApps[1].seconds } : null;
  const thirdApp  = focusApps[2] ? { ...tool(focusApps[2].tool), seconds: focusApps[2].seconds } : null;

  const focusRatio = (focused > 0 && topApp) ? topApp.seconds / focused : 0;
  const toolCount = focusApps.length;

  const catRank = Object.entries(catSec)
    .filter(([k]) => !AMBIENT_TOOLS.has(k) && k !== "music")
    .sort((a, b) => b[1] - a[1]);
  const topCat    = catRank[0]?.[0] || null;
  const topCatSec = catRank[0]?.[1] || 0;
  const secondCat = catRank[1]?.[0] || null;
  const thirdCat  = catRank[2]?.[0] || null;

  return {
    date: agg.date, apps, focusApps, total, focused, catSec,
    musicRatio, focusRatio, toolCount, topApp, secondApp, thirdApp,
    topCat, topCatSec, secondCat, thirdCat,
    max: apps.length ? apps[0].seconds : 1,
  };
}

// ── Archetype selection (first-match-wins, mirrors opengraph-image.jsx exactly)
function pickArchetype(r) {
  const { apps, total, focused, focusRatio, toolCount, catSec, musicRatio, topApp, secondApp, thirdApp, topCat, topCatSec, secondCat, thirdCat } = r;

  if (total === 0 || apps.length === 0) {
    return { key: "no_data", headline: "nothing tracked today.", summary: "Either an off day, or the office wasn't pointed at anything yet. Come back once you've connected a tool or two.", badge: "NO DATA", badgeColor: "#C7D2CE" };
  }
  if (total < 90 * 60) {
    return { key: "quiet_day", headline: "a quiet one.", summary: `Only ${fmt(total)} showed up in the office today. Could've been a light day, could've been a day that happened somewhere mumbl wasn't watching. Both are fine.`, badge: "QUIET", badgeColor: "#9FB3BE" };
  }
  if (focused >= 9 * 3600) {
    return { key: "long_haul", headline: "a long one.", summary: `${fmt(focused)} tracked today, across ${toolCount} tools. Hope there was a walk in there somewhere.`, badge: "LONG HAUL", badgeColor: "#6B5334" };
  }
  if (focusRatio >= 0.65 && toolCount <= 3) {
    const others = toolCount - 1;
    return { key: "deep_work", headline: `${topApp.label}, basically all day.`, summary: `${fmt(topApp.seconds)} in ${topApp.label}, ${others > 0 ? `${others} other tab${others > 1 ? "s" : ""} open the whole time` : "nothing else even running"}. That's not multitasking, that's a lockdown.`, badge: "DEEP WORK", badgeColor: topApp.accent };
  }
  const chatApp = apps.find((a) => CHAT_TOOLS.has(a.tool) && a.seconds / total >= 0.30);
  if (chatApp) {
    const ct = tool(chatApp.tool);
    return { key: "chat_storm", headline: "today was a conversation.", summary: `${fmt(chatApp.seconds)} in ${ct.label} alone — more time talking about the work than time visibly doing it. Sometimes that's the work.`, badge: "CHAT STORM", badgeColor: "#9E6BA0" };
  }
  const callSec = catSec.call || 0;
  if (callSec / total >= 0.35) {
    const pct = Math.round((callSec / total) * 100);
    return { key: "meeting_marathon", headline: "back-to-back-to-back.", summary: `${fmt(callSec)} on calls today — that's ${pct}% of everything tracked. Whatever got built happened in the gaps.`, badge: "CALL HEAVY", badgeColor: "#4A82D8" };
  }
  const codingSec  = catSec.coding || 0;
  const reviewSec  = catSec.review || 0;
  const hasTerminal = apps.some((a) => tool(a.tool).isTerminal);
  const topCodingApp   = apps.filter((a) => !tool(a.tool).isTerminal && tool(a.tool).category === "coding")[0];
  const topTerminalApp = apps.filter((a) => tool(a.tool).isTerminal)[0];
  if (codingSec > 0 && hasTerminal && reviewSec > 0) {
    const editorTime  = topCodingApp ? fmt(topCodingApp.seconds) : fmt(codingSec);
    const editorLabel = topCodingApp ? tool(topCodingApp.tool).label : "the editor";
    const terminalTime = topTerminalApp ? fmt(topTerminalApp.seconds) : fmt(0);
    return { key: "shipping", headline: "code, terminal, repeat.", summary: `${editorTime} in ${editorLabel}, ${terminalTime} in the terminal, and a PR in the mix. Something shipped today.`, badge: "SHIPPING", badgeColor: "#4FB07E" };
  }
  const designSec = catSec.design || 0;
  const makerShare = (codingSec + designSec) / (focused || 1);
  const callFocusShare = callSec / (focused || 1);
  if (makerShare >= 0.60 && callFocusShare < 0.15) {
    const topDesignApp = apps.find((a) => tool(a.tool).category === "design");
    const topDesignT   = topDesignApp ? tool(topDesignApp.tool) : null;
    return { key: "makers_day", headline: "you built something today.", summary: `${fmt(codingSec)} in the editor, ${topDesignT ? `${fmt(designSec)} in ${topDesignT.label}` : `${fmt(designSec)} in design`} — barely a meeting in sight. This was a making day, not a talking day.`, badge: "MAKER", badgeColor: "#57B884" };
  }
  const browsingFocusSec = catSec.browsing || 0;
  const lurkerShare = (browsingFocusSec + reviewSec) / (focused || 1);
  const builderShare = (codingSec + designSec) / (focused || 1);
  if (lurkerShare >= 0.55 && builderShare < 0.20) {
    return { key: "lurker", headline: "a lot of reading, not much writing.", summary: `${fmt(browsingFocusSec)} browsing${reviewSec > 0 ? `, ${fmt(reviewSec)} reviewing` : ""} — you looked at a lot today and typed very little of it.`, badge: "THE LURKER", badgeColor: "#7E8C86" };
  }
  if (musicRatio >= 0.35 && focused >= 2 * 3600) {
    const musicSec = catSec.music || 0;
    return { key: "soundtrack", headline: `${topApp.label}, with a soundtrack.`, summary: `${fmt(musicSec)} of music running under ${fmt(focused)} of actual work. Almost an album's worth of focus.`, badge: "SOUNDTRACK", badgeColor: "#5FBE7E" };
  }
  if (toolCount >= 7 && focusRatio < 0.25) {
    const extra = toolCount - 3;
    return { key: "chaos", headline: `${toolCount} tools, no ringleader.`, summary: `Nothing today crossed ${fmt(topApp.seconds)}. You were everywhere for a little while — ${topApp.label}${secondApp ? `, ${secondApp.label}` : ""}${thirdApp ? `, ${thirdApp.label}` : ""}${extra > 0 ? `, and ${extra} more` : ""}.`, badge: "CHAOS MODE", badgeColor: "#9E86C8" };
  }
  return { key: "balanced", headline: "a bit of everything.", summary: `${topCat} led with ${fmt(topCatSec)}${secondCat ? `, but ${secondCat}${thirdCat ? ` and ${thirdCat}` : ""} both got real time too` : ""}. A normal, mixed-bag kind of day.`, badge: "BALANCED", badgeColor: "#57B884" };
}

// ── Metadata
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = cleanString(slug, 64) || "you";
  return {
    title: `${name}'s day recap · mumbl`,
    description: `${name}'s workday at a glance — tools, focus time, and the shape of the day.`,
    openGraph: {
      title: `${name}'s day recap · mumbl`,
      images: [`/office/${encodeURIComponent(slug)}/recap/opengraph-image`],
    },
  };
}

// ── Data loader
async function loadRecap(slug) {
  const isDemo = slug === DEMO_SLUG || /^demo-v\d$/.test(slug);
  if (!isDemo) {
    try {
      const supabase = getSupabaseAdmin();
      const agg = await readDayRecap(supabase, slug);
      if (agg) return { recap: aggToRecap(agg), isLive: true };
    } catch {
      // fall through to mock
    }
  }
  const variantMatch = slug?.match(/^demo-v(\d)$/);
  const variant = variantMatch ? parseInt(variantMatch[1]) : 0;
  return { recap: aggToRecap(recapMock(variant)), isLive: false };
}

// ── Page component
export default async function RecapPage({ params }) {
  const { slug } = await params;
  const title = cleanString(slug, 40) || "you";
  const { recap: r, isLive } = await loadRecap(slug);
  const arch = pickArchetype(r);
  const { headline, summary, badge, badgeColor } = arch;

  const topT = r.topApp ? tool(r.topApp.tool) : tool("other");
  const topAccent = r.topApp ? tool(r.topApp.tool).accent : C.muted;

  const musicApp = r.apps.find((a) => a.tool === "spotify" || a.tool === "apple-music");
  const bars = [...r.focusApps.slice(0, 4), ...(musicApp ? [musicApp] : [])].slice(0, 5);
  const barMax = bars.length ? bars[0].seconds : 1;

  const shareUrl = `/office/${encodeURIComponent(slug)}/recap/opengraph-image`;

  return (
    <main style={{
      minHeight: "100vh", background: C.paper, color: C.ink,
      fontFamily: "Arial, Helvetica, sans-serif",
      padding: "0 0 48px",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "18px 24px", borderBottom: `2px solid ${C.edge}`,
        background: C.panel,
      }}>
        <div style={{
          width: 36, height: 36, background: C.gold, border: `2px solid ${C.edge}`,
          borderRadius: 8, color: C.goldInk, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, boxShadow: "2px 2px 0 #EFE4CE",
          flexShrink: 0,
        }}>
          m
        </div>
        <span style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>mumbl</span>
        <span style={{ flex: 1 }} />
        {!isLive && (
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", background: C.track, borderRadius: 6 }}>
            SAMPLE
          </span>
        )}
        <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 12, fontWeight: 700, color: C.muted, textDecoration: "none",
          padding: "6px 14px", border: `2px solid ${C.edge}`, borderRadius: 8,
          background: C.paper,
        }}>
          share card ↗
        </a>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header line */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.muted }}>
            {title}&apos;s day
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>· {r.date}</span>
          <span style={{ flex: 1 }} />
          <span style={{
            padding: "4px 12px", borderRadius: 7,
            background: badgeColor, color: "#FFFFFF",
            fontSize: 11, fontWeight: 900, letterSpacing: 1.5,
          }}>
            {badge}
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 40, fontWeight: 900, lineHeight: 1.1,
          color: topAccent, margin: "0 0 14px",
        }}>
          {headline}
        </h1>

        {/* Summary */}
        <p style={{
          fontSize: 17, lineHeight: 1.6, color: C.muted,
          margin: "0 0 32px", maxWidth: 580,
        }}>
          {summary}
        </p>

        {/* Time breakdown */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: C.muted, marginBottom: 14 }}>
          WHERE THE DAY WENT
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {bars.map((a, i) => {
            const t = tool(a.tool);
            const isAmbient = AMBIENT_TOOLS.has(a.tool);
            const pct = Math.max(5, Math.round((a.seconds / barMax) * 100));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Glyph badge */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: isAmbient ? C.track : t.accent,
                  color: isAmbient ? C.muted : "#FFFFFF",
                  fontSize: 12, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  border: isAmbient ? `2px dashed ${C.edge}` : "none",
                }}>
                  {t.glyph}
                </div>
                {/* Label + bar */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 14, fontWeight: 700, marginBottom: 5,
                    color: isAmbient ? C.muted : C.ink,
                  }}>
                    <span>{isAmbient ? `${t.label} ♪` : t.label}</span>
                    <span style={{ color: C.muted, fontSize: 13 }}>{fmt(a.seconds)}</span>
                  </div>
                  <div style={{ width: "100%", height: 8, borderRadius: 4, background: C.track, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: 8, borderRadius: 4,
                      background: isAmbient ? C.edge : t.accent,
                      opacity: isAmbient ? 0.6 : 1,
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 2, borderRadius: 12,
          overflow: "hidden", border: `2px solid ${C.edge}`,
          marginBottom: 32,
        }}>
          <div style={{ flex: 1, padding: "16px 20px", background: C.panel, borderRight: `2px solid ${C.edge}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>{fmt(r.focused)}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.muted, marginTop: 2 }}>FOCUSED</div>
          </div>
          <div style={{ flex: 1, padding: "16px 20px", background: C.panel, borderRight: `2px solid ${C.edge}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>{r.toolCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.muted, marginTop: 2 }}>TOOLS</div>
          </div>
          <div style={{ flex: 2, padding: "16px 20px", background: C.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: topAccent, color: "#FFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 900,
              }}>
                {topT.glyph}
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>{fmt(r.topApp?.seconds || 0)}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.muted, marginTop: 4 }}>
              TOP · {topT.label.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>
          mumbl.wtf · {isLive ? "real data" : "sample"}
        </div>
      </div>
    </main>
  );
}
