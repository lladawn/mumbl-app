import { ImageResponse } from "next/og";
import { cleanString } from "../../../../src/server/validation";

export const alt = "A recap of my workday, in the mumbl office.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ────────────────────────────────────────────────────────────────────────────
// DAY RECAP — "Spotify Wrapped for your workday"
//
// A shareable end-of-day card: day archetype headline, one-line summary with
// concrete numbers, per-app time breakdown, highlights. Pixel-art office hero
// scene at right. Visual vocabulary consistent with opengraph-image.jsx.
//
// ARCHETYPES + COPY: wired to docs/office-recap-voice.md (Meredith, 2026-08-20).
// Selection order: first-match-wins, §4.1. Templates: §3. Variables: §4.2.
//
// SHAPE-ONLY: app names + durations only — never window titles, repos, docs.
// DATA: REPRESENTATIVE MOCK. Real data = drop-in via daily_app_totals aggregate.
// ────────────────────────────────────────────────────────────────────────────

// ── Palette — matches opengraph-image.jsx exactly
const C = {
  paper: "#FBF4E8", panel: "#FFFAF2", edge: "#E3D5BD", ink: "#3E4E4A", muted: "#7E8C86",
  gold: "#F6D9A8", goldInk: "#6B5334", track: "#EDE2CE", floor: "#DDBA88",
  wall: "#C7E9E5", wallTrim: "#FFF8EC", sky: "#BEE7F7", skyTop: "#DCF3FC",
  leaf: "#B6E4C0", carpet: "#D2DAF0", carpetEdge: "#AEB9DE",
  deskTop: "#F0D5A8", desk: "#E3C094", monitor: "#9FB3BE", line: "#59696E",
  shoe: "#8A7358",
};

// ── Per-app look — mirrors TOOL_CARD in opengraph-image.jsx
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

// AMBIENT tools: never count toward focusedSeconds
const AMBIENT_TOOLS = new Set(["spotify", "apple-music", "other"]);
// Chat tools: for Chat Storm detection
const CHAT_TOOLS = new Set(["slack", "discord", "teams"]);

// ────────────────────────────────────────────────────────────────────────────
// ARCHETYPE SYSTEM (docs/office-recap-voice.md §3, §4)
// First-match-wins selection order per §4.1.
// Each archetype returns { headline, summary, badge, badgeColor, lookIdx }
// from a pure function given the derived recap `r`.
// ────────────────────────────────────────────────────────────────────────────

// Pick the archetype for a given day — first-match wins (§4.1)
function pickArchetype(r) {
  const {
    apps, total, focused, focusRatio, toolCount,
    catSec, musicRatio, topApp, secondApp, thirdApp,
    topCat, topCatSec, secondCat, thirdCat,
  } = r;

  // 1. No data at all
  if (total === 0 || apps.length === 0) {
    return {
      key: "no_data",
      headline: "nothing tracked today.",
      summary: "Either an off day, or the office wasn't pointed at anything yet. Come back once you've connected a tool or two.",
      badge: "NO DATA", badgeColor: "#C7D2CE", lookIdx: 1,
    };
  }

  // 2. Quiet Day: < 90 min total
  if (total < 90 * 60) {
    return {
      key: "quiet_day",
      headline: "a quiet one.",
      summary: `Only ${fmt(total)} showed up in the office today. Could've been a light day, could've been a day that happened somewhere mumbl wasn't watching. Both are fine.`,
      badge: "QUIET", badgeColor: "#9FB3BE", lookIdx: 1,
    };
  }

  // 3. The Long Haul: 9+ hours focused
  if (focused >= 9 * 3600) {
    return {
      key: "long_haul",
      headline: "a long one.",
      summary: `${fmt(focused)} tracked today, across ${toolCount} tools. Hope there was a walk in there somewhere.`,
      badge: "LONG HAUL", badgeColor: "#6B5334", lookIdx: 0,
    };
  }

  // 4. Deep Work Day: focusRatio ≥ 0.65 and toolCount ≤ 3
  if (focusRatio >= 0.65 && toolCount <= 3) {
    const others = toolCount - 1;
    return {
      key: "deep_work",
      headline: `${topApp.label}, basically all day.`,
      summary: `${fmt(topApp.seconds)} in ${topApp.label}, ${others > 0 ? `${others} other tab${others > 1 ? "s" : ""} open the whole time` : "nothing else even running"}. That's not multitasking, that's a lockdown.`,
      badge: "DEEP WORK", badgeColor: topApp.accent, lookIdx: 2,
    };
  }

  // 5. Chat Storm: any chat-mapped app ≥ 30% of total
  const chatApp = apps.find((a) => CHAT_TOOLS.has(a.tool) && a.seconds / total >= 0.30);
  if (chatApp) {
    const ct = tool(chatApp.tool);
    return {
      key: "chat_storm",
      headline: "today was a conversation.",
      summary: `${fmt(chatApp.seconds)} in ${ct.label} alone — more time talking about the work than time visibly doing it. Sometimes that's the work.`,
      badge: "CHAT STORM", badgeColor: "#9E6BA0", lookIdx: 1,
    };
  }

  // 6. Meeting Marathon: call category ≥ 35% of total
  const callSec = catSec.call || 0;
  if (callSec / total >= 0.35) {
    const pct = Math.round((callSec / total) * 100);
    return {
      key: "meeting_marathon",
      headline: "back-to-back-to-back.",
      summary: `${fmt(callSec)} on calls today — that's ${pct}% of everything tracked. Whatever got built happened in the gaps.`,
      badge: "CALL HEAVY", badgeColor: "#4A82D8", lookIdx: 1,
    };
  }

  // 7. Shipping Day: coding dominant + terminal app present + review category present
  const codingSec = catSec.coding || 0;
  const reviewSec = catSec.review || 0;
  const hasTerminal = apps.some((a) => tool(a.tool).isTerminal);
  const topCodingApp = apps.filter((a) => !tool(a.tool).isTerminal && tool(a.tool).category === "coding")[0];
  const topTerminalApp = apps.filter((a) => tool(a.tool).isTerminal)[0];
  if (codingSec > 0 && hasTerminal && reviewSec > 0) {
    const editorTime = topCodingApp ? fmt(topCodingApp.seconds) : fmt(codingSec);
    const editorLabel = topCodingApp ? tool(topCodingApp.tool).label : "the editor";
    const terminalTime = topTerminalApp ? fmt(topTerminalApp.seconds) : fmt(0);
    return {
      key: "shipping",
      headline: "code, terminal, repeat.",
      summary: `${editorTime} in ${editorLabel}, ${terminalTime} in the terminal, and a PR in the mix. Something shipped today.`,
      badge: "SHIPPING", badgeColor: "#4FB07E", lookIdx: 0,
    };
  }

  // 8. Maker's Day: coding + design ≥ 60% of focused, call < 15%
  const designSec = catSec.design || 0;
  const makerShare = (codingSec + designSec) / (focused || 1);
  const callFocusShare = callSec / (focused || 1);
  if (makerShare >= 0.60 && callFocusShare < 0.15) {
    const topDesignApp = apps.find((a) => tool(a.tool).category === "design");
    const topDesignT = topDesignApp ? tool(topDesignApp.tool) : null;
    return {
      key: "makers_day",
      headline: "you built something today.",
      summary: `${fmt(codingSec)} in the editor, ${topDesignT ? `${fmt(designSec)} in ${topDesignT.label}` : `${fmt(designSec)} in design`} — barely a meeting in sight. This was a making day, not a talking day.`,
      badge: "MAKER", badgeColor: "#57B884", lookIdx: 0,
    };
  }

  // 9. The Lurker: browsing + review ≥ 55% of focused, coding/design < 20%
  const browsingFocusSec = catSec.browsing || 0;
  const lurkerShare = (browsingFocusSec + reviewSec) / (focused || 1);
  const builderShare = (codingSec + designSec) / (focused || 1);
  if (lurkerShare >= 0.55 && builderShare < 0.20) {
    return {
      key: "lurker",
      headline: "a lot of reading, not much writing.",
      summary: `${fmt(browsingFocusSec)} browsing${reviewSec > 0 ? `, ${fmt(reviewSec)} reviewing` : ""} — you looked at a lot today and typed very little of it.`,
      badge: "THE LURKER", badgeColor: "#7E8C86", lookIdx: 3,
    };
  }

  // 10. Soundtrack Day: musicRatio ≥ 0.35 (and non-trivial focus so it's not "did nothing + music")
  if (musicRatio >= 0.35 && focused >= 2 * 3600) {
    const musicSec = catSec.music || 0;
    return {
      key: "soundtrack",
      headline: `${topApp.label}, with a soundtrack.`,
      summary: `${fmt(musicSec)} of music running under ${fmt(focused)} of actual work. Almost an album's worth of focus.`,
      badge: "SOUNDTRACK", badgeColor: "#5FBE7E", lookIdx: 3,
    };
  }

  // 11. Context-Switch Chaos: ≥ 7 tools and focusRatio < 0.25
  if (toolCount >= 7 && focusRatio < 0.25) {
    const extra = toolCount - 3;
    return {
      key: "chaos",
      headline: `${toolCount} tools, no ringleader.`,
      summary: `Nothing today crossed ${fmt(topApp.seconds)}. You were everywhere for a little while — ${topApp.label}${secondApp ? `, ${secondApp.label}` : ""}${thirdApp ? `, ${thirdApp.label}` : ""}${extra > 0 ? `, and ${extra} more` : ""}.`,
      badge: "CHAOS MODE", badgeColor: "#9E86C8", lookIdx: 1,
    };
  }

  // 12. Balanced Day — fallback
  const cat2label = secondCat || null;
  const cat3label = thirdCat || null;
  return {
    key: "balanced",
    headline: "a bit of everything.",
    summary: `${topCat} led with ${fmt(topCatSec)}${cat2label ? `, but ${cat2label}${cat3label ? ` and ${cat3label}` : ""} both got real time too` : ""}. A normal, mixed-bag kind of day.`,
    badge: "BALANCED", badgeColor: "#57B884", lookIdx: 0,
  };
}

// ── Time formatter (matches fmt() spec in voice doc exactly)
function fmt(sec) {
  if (!sec || sec <= 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}h${String(m).padStart(2, "0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ────────────────────────────────────────────────────────────────────────────
// MOCK DATA — three sample day-shapes covering distinct archetypes.
// These are the literal test fixtures from docs/office-recap-voice.md §5,
// extended with a third shape for variety.
// ────────────────────────────────────────────────────────────────────────────
function recapMock(variant = 0) {
  const shapes = [
    // Variant 0: Deep Work Day (Example A, voice spec §5)
    // VS Code 6h20m, Slack 25m, Chrome 15m → focusRatio ≈ 0.90, toolCount 3
    {
      date: "Aug 18",
      apps: [
        { tool: "vscode",  seconds: 6 * 3600 + 20 * 60 },
        { tool: "slack",   seconds: 25 * 60 },
        { tool: "chrome",  seconds: 15 * 60 },
        { tool: "spotify", seconds: 2 * 3600 + 10 * 60 },
      ],
    },
    // Variant 1: Meeting Marathon (Example B, voice spec §5)
    // Zoom 3h10m, Slack 1h05m, Notion 20m, VS Code 45m → call share ≈ 58%
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
    // Variant 2: Shipping Day (coding + terminal + review → "code, terminal, repeat")
    {
      date: "Aug 20",
      apps: [
        { tool: "vscode",    seconds: 3 * 3600 + 35 * 60 },
        { tool: "terminal",  seconds: 1 * 3600 + 20 * 60 },
        { tool: "chrome",    seconds: 40 * 60 },  // review category
        { tool: "slack",     seconds: 30 * 60 },
        { tool: "spotify",   seconds: 2 * 3600 },
        { tool: "notion",    seconds: 15 * 60 },
      ],
      // Inject review category for terminal+coding+review Shipping Day signal
      injectCatSec: { review: 40 * 60 },
    },
  ];
  return shapes[variant % shapes.length];
}

// ── Aggregate → derived recap view (pure, deterministic)
function mockToRecap(agg) {
  const apps = [...(agg.apps || [])].sort((a, b) => b.seconds - a.seconds);
  const total = apps.reduce((s, a) => s + a.seconds, 0);
  const focused = apps.filter((a) => !AMBIENT_TOOLS.has(a.tool)).reduce((s, a) => s + a.seconds, 0);

  // Category seconds: group by category
  const catSecRaw = {};
  for (const a of apps) {
    const cat = tool(a.tool).category || "other";
    catSecRaw[cat] = (catSecRaw[cat] || 0) + a.seconds;
  }
  // Allow mock to inject category overrides (e.g. synthetic review seconds)
  const catSec = { ...catSecRaw, ...(agg.injectCatSec || {}) };

  const musicSec = catSec.music || 0;
  const musicRatio = total > 0 ? musicSec / total : 0;

  // Focus apps = non-ambient, sorted by seconds
  const focusApps = apps.filter((a) => !AMBIENT_TOOLS.has(a.tool));
  const topApp = focusApps[0] ? { ...focusApps[0], ...tool(focusApps[0].tool), seconds: focusApps[0].seconds } : null;
  const secondApp = focusApps[1] ? { ...tool(focusApps[1].tool), seconds: focusApps[1].seconds } : null;
  const thirdApp  = focusApps[2] ? { ...tool(focusApps[2].tool), seconds: focusApps[2].seconds } : null;

  const focusRatio = (focused > 0 && topApp) ? topApp.seconds / focused : 0;
  const toolCount = focusApps.length;

  // Category ranking (non-ambient only)
  const catRank = Object.entries(catSec)
    .filter(([k]) => !AMBIENT_TOOLS.has(k) && k !== "music")
    .sort((a, b) => b[1] - a[1]);
  const topCat = catRank[0]?.[0] || null;
  const topCatSec = catRank[0]?.[1] || 0;
  const secondCat = catRank[1]?.[0] || null;
  const thirdCat  = catRank[2]?.[0] || null;

  return {
    date: agg.date,
    apps,
    focusApps,
    total,
    focused,
    catSec,
    musicRatio,
    focusRatio,
    toolCount,
    topApp,
    secondApp,
    thirdApp,
    topCat,
    topCatSec,
    secondCat,
    thirdCat,
    max: apps.length ? apps[0].seconds : 1,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// PIXEL-ART HELPERS
// All plain functions returning arrays — satori-safe.
// Rule: no React component may return a bare array (crashes satori).
// ────────────────────────────────────────────────────────────────────────────

// Person looks — mirrors LOOKS in opengraph-image.jsx
const LOOKS = [
  { hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96",
    hairStyle: "curly", outfit: "stripes", accessory: "glasses", accent: "#FFF8EC", build: "slim", glow: "#C6F5EC" },
  { hair: "#3A322C", skin: "#C89370", shirt: "#F29C8D", pants: "#7A7189",
    hairStyle: "beanie", outfit: "vest", accessory: "lanyard", accent: "#CFBBF0", build: "broad", glow: "#FFD2CA" },
  { hair: "#332C26", skin: "#A0714B", shirt: "#94CDEE", pants: "#6E7E96",
    hairStyle: "cap", outfit: "hoodie", accessory: "headphones", accent: "#6E9FD8", build: "slim", glow: "#D8EEFF" },
  { hair: "#6B4426", skin: "#F0D2AC", shirt: "#F3CE79", pants: "#8A7358",
    hairStyle: "bun", outfit: "collar", accessory: "earrings", accent: "#C7913F", build: "slim", glow: "#FFF1CC" },
];

// personRects — mirrors opengraph-image.jsx exactly (returns [x,y,w,h,fill,extra?][])
function personRects(look) {
  const hairStyle = look.hairStyle || "short";
  const outfit = look.outfit || "plain";
  const accessory = look.accessory || "none";
  const accent = look.accent || "#FFF8EC";
  const tx = look.build === "slim" ? 4 : look.build === "broad" ? 2 : 3;
  const tw = look.build === "slim" ? 8 : look.build === "broad" ? 12 : 10;
  const shoulderX = tx - 1;
  const shoulderW = tw + 2;
  const legL = tx + 1;
  const legR = tx + tw - 3;
  const r = [];
  const put = (x, y, w, h, fill, extra) => r.push([x, y, w, h, fill, extra]);

  if (hairStyle === "curly") {
    put(4, 0, 8, 6, look.hair); put(3, 1, 1, 4, look.hair); put(12, 1, 1, 4, look.hair);
    put(5, 0, 6, 1, look.hair);
  } else if (hairStyle === "bun") {
    put(6, 0, 4, 2, look.hair);
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
  } else if (hairStyle === "cap") {
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
    put(4, 1, 8, 2, accent); put(3, 3, 5, 1, accent); put(4, 3, 8, 1, C.line);
  } else if (hairStyle === "beanie") {
    put(4, 2, 8, 4, look.hair);
    put(4, 1, 8, 3, accent); put(4, 3, 8, 1, C.line); put(7, 0, 2, 1, accent);
  } else {
    put(5, 1, 6, 3, look.hair); put(4, 2, 8, 4, look.hair);
  }
  put(5, 3, 6, 1, look.hair);
  put(5, 4, 6, 4, look.skin);
  put(6, 6, 1, 1, C.line); put(9, 6, 1, 1, C.line);
  put(7, 8, 2, 1, look.skin);
  put(shoulderX, 9, shoulderW, 1, look.shirt);
  put(tx, 10, tw, 5, look.shirt);
  put(tx - 1, 10, 1, 5, look.shirt); put(tx + tw, 10, 1, 5, look.shirt);
  put(tx - 1, 14, 1, 2, look.skin); put(tx + tw, 14, 1, 2, look.skin);

  if (outfit === "hoodie") {
    put(tx, 10, tw, 2, accent);
    put(7, 12, 1, 2, accent); put(9, 12, 1, 2, accent);
    put(tx + 1, 13, tw - 2, 2, C.line);
  } else if (outfit === "collar") {
    put(tx, 10, 2, 5, accent); put(tx + tw - 2, 10, 2, 5, accent);
    put(7, 10, 2, 1, "#FFF8EC"); put(7, 11, 2, 4, look.pants);
  } else if (outfit === "stripes") {
    [11, 13].forEach((y) => put(tx, y, tw, 1, accent));
  } else if (outfit === "vest") {
    put(tx, 10, 2, 5, accent); put(tx + tw - 2, 10, 2, 5, accent);
    put(tx + 2, 10, tw - 4, 1, "#FFF8EC");
  }

  put(legL, 16, 2, 4, look.pants); put(legR, 16, 2, 4, look.pants);
  put(legL - 1, 20, 3, 1, C.shoe); put(legR, 20, 3, 1, C.shoe);

  if (accessory === "glasses") {
    put(5, 5, 3, 2, C.line); put(8, 5, 3, 2, C.line);
    put(7, 5, 2, 1, C.line);
    put(4, 5, 1, 2, C.line); put(11, 5, 1, 2, C.line);
  } else if (accessory === "headphones") {
    put(4, 1, 8, 1, C.line);
    put(3, 3, 2, 4, C.line); put(11, 3, 2, 4, C.line);
  } else if (accessory === "earrings") {
    put(4, 7, 1, 1, accent); put(11, 7, 1, 1, accent);
  } else if (accessory === "lanyard") {
    put(7, 10, 1, 4, C.line); put(9, 10, 1, 4, C.line);
    put(7, 13, 3, 3, accent);
  }
  return r;
}

// Station prop rects — mirrors STATION_PROP_RECTS in opengraph-image.jsx
const STATION_PROP_RECTS = {
  coding: [
    [-48, 54, 150, 12, "#2E4A3A", { opacity: 0.28 }],
    [-8, 16, 34, 4, "#9BD8B4", { opacity: 0.9 }],
    [-8, 24, 22, 4, "#4E7D66", { opacity: 0.9 }],
    [-8, 32, 30, 4, "#EFC08A", { opacity: 0.85 }],
    [-8, 40, 40, 4, "#9BD8B4", { opacity: 0.9 }],
    [58, 6, 26, 30, "#2A3237"],
    [61, 9, 20, 24, "#1E262B"],
    [64, 13, 14, 3, "#9BD8B4", { opacity: 0.85 }],
    [64, 19, 16, 3, "#4E7D66", { opacity: 0.85 }],
    [64, 25, 10, 3, "#EFC08A", { opacity: 0.8 }],
    [-52, 66, 26, 18, "#0E1216"],
    [-48, 70, 3, 3, "#9BD8B4"],
    [-43, 70, 12, 3, "#9BD8B4", { opacity: 0.9 }],
    [-48, 76, 16, 3, "#86CFA6", { opacity: 0.8 }],
    [24, 62, 4, 4, "#86CFA6", { borderRadius: 4 }],
  ],
  design: [
    [-60, 40, 150, 20, "#F6BCD1", { opacity: 0.2 }],
    [-64, -20, 58, 46, "#E0CBA6"],
    [-61, -17, 52, 40, "#FBF7F0"],
    [-54, -10, 20, 15, "#CFBBF0"],
    [-32, -14, 16, 11, "#BEE7F7"],
    [-28, 4, 14, 12, "#F4B3A6", { borderRadius: 12 }],
    [-56, 6, 18, 2, "#59696E", { opacity: 0.55 }],
    [-56, 10, 12, 2, "#59696E", { opacity: 0.55 }],
    [-56, -12, 24, 19, "transparent", { border: "1px solid #F6BCD1" }],
    [-30, 68, 52, 12, "#EADFC7"],
    [-27, 71, 7, 6, "#F4B3A6"], [-19, 71, 7, 6, "#F8DFA0"], [-11, 71, 7, 6, "#9BD8B4"],
    [-3, 71, 7, 6, "#BEE7F7"], [5, 71, 7, 6, "#CFBBF0"], [13, 71, 7, 6, "#F6BCD1"],
    [30, 70, 16, 3, "#E29CBE"],
  ],
  call: [
    [-40, -30, 130, 60, "#BEE7F7", { opacity: 0.28 }],
    [-34, -26, 88, 60, "#24333F"],
    [-30, -22, 80, 52, "#1B2732"],
    [-27, -19, 24, 22, "#6E9FD8", { opacity: 0.85 }],
    [-1, -19, 24, 22, "#86CFA6", { opacity: 0.85 }],
    [25, -19, 24, 22, "#F0A79E", { opacity: 0.85 }],
    [-27, 5, 24, 22, "#EFC08A", { opacity: 0.85 }],
    [-1, 5, 24, 22, "#9E86C8", { opacity: 0.85 }],
    [25, 5, 24, 22, "#BEE7F7", { opacity: 0.85 }],
    [-19, -8, 8, 9, "#2E3A44", { opacity: 0.9 }], [-17, -15, 5, 6, "#2E3A44", { opacity: 0.9 }],
    [7, -8, 8, 9, "#2E3A44", { opacity: 0.9 }], [9, -15, 5, 6, "#2E3A44", { opacity: 0.9 }],
    [-16, -38, 52, 10, "#7A2E2E"],
    [-12, -35, 4, 4, "#F0605A", { borderRadius: 4 }],
    [-4, -34, 34, 4, "#FFE3DC", { opacity: 0.9 }],
    [-27, -19, 24, 22, "transparent", { border: "2px solid #FFF6E4" }],
  ],
  music: [
    [-52, 78, 120, 16, "#F8DFA0", { opacity: 0.24 }],
    [-50, 58, 76, 30, "#9E7A52"],
    [-47, 61, 70, 24, "#CBA87C"],
    [-47, 61, 70, 4, "#D4A86A"],
    [-46, 86, 6, 4, "#6E543A"], [16, 86, 6, 4, "#6E543A"],
    [-34, 62, 46, 22, "#3A342E", { borderRadius: 24 }],
    [-31, 64, 40, 18, "#2A2622", { borderRadius: 22 }],
    [-27, 66, 32, 14, "#3A3430", { borderRadius: 18 }],
    [-15, 69, 8, 8, "#F4B3A6", { borderRadius: 8 }],
    [-5, 70, 2, 2, "#FFFBF0"],
    [16, 56, 4, 16, "#9AA6A8"],
    [12, 54, 10, 4, "#6E7276"],
    [2, 64, 16, 3, "#B7C9CB"],
    [-44, 76, 4, 8, "#9BD8B4"], [-38, 78, 4, 6, "#9BD8B4"], [-32, 74, 4, 10, "#9BD8B4"], [-26, 79, 4, 5, "#9BD8B4"],
    [24, 50, 6, 6, "#9BD8B4", { borderRadius: 6 }], [29, 44, 2, 8, "#9BD8B4"],
    [34, 40, 5, 5, "#F8DFA0", { borderRadius: 6 }], [38, 35, 2, 7, "#F8DFA0"],
  ],
  writing: [
    [44, 62, 4, 18, "#B7C9CB"],
    [32, 54, 20, 8, "#F8DFA0"],
    [-38, 68, 30, 20, "#FFFBF0"],
    [-32, 74, 18, 2, "#59696E", { opacity: 0.7 }],
    [-32, 79, 22, 2, "#59696E", { opacity: 0.7 }],
  ],
  browsing: [
    [-26, 60, 42, 30, "#3A4348"],
    [-22, 64, 34, 6, "#F4B3A6"],
    [-22, 72, 34, 14, "#EFE7DA"],
    [-18, 75, 20, 2, "#9AA3A0"],
    [-18, 80, 26, 2, "#9AA3A0"],
  ],
  focus: [
    [46, 72, 12, 10, "#FFFBF0"],
    [58, 74, 4, 5, "#F4B3A6"],
    [48, 68, 8, 4, "#9FB3BE", { opacity: 0.4 }],
  ],
};

// Tool → screen kind mapping (for TOOL_SCREEN_RECTS lookup)
const TOOL_SCREEN_KIND = {
  vscode: "vscode", cursor: "vscode", xcode: "vscode", intellij: "vscode",
  pycharm: "vscode", zed: "vscode", sublime: "vscode",
  terminal: "terminal", iterm: "terminal", ghostty: "terminal", warp: "terminal",
  figma: "figma", sketch: "figma", photoshop: "figma", illustrator: "figma",
  zoom: "zoom", meet: "zoom", teams: "zoom", discord: "zoom",
  chrome: "chrome", safari: "chrome", arc: "chrome", firefox: "chrome",
  slack: "slack",
  notion: "notion", obsidian: "notion", notes: "notion", word: "notion",
};

// Tool → category for hero station
const TOOL_CAT = {
  vscode: "coding", cursor: "coding", xcode: "coding", intellij: "coding",
  pycharm: "coding", zed: "coding", sublime: "coding",
  terminal: "coding", iterm: "coding", ghostty: "coding", warp: "coding",
  figma: "design", sketch: "design", photoshop: "design", illustrator: "design",
  zoom: "call", meet: "call", teams: "call", discord: "call",
  spotify: "music", "apple-music": "music",
  notion: "writing", obsidian: "writing", notes: "writing", word: "writing",
  chrome: "browsing", safari: "browsing", arc: "browsing", firefox: "browsing",
  slack: "browsing",
};

const SCREEN_W = 76, SCREEN_H = 32;
const TOOL_SCREEN_RECTS = {
  vscode:   [[0,0,8,SCREEN_H,"#2C6F9E"],[14,5,34,4,"#4FA5E0"],[14,12,22,4,"#86CFA6"],[22,19,30,4,"#EFC08A"],[14,26,38,4,"#6E7E79"]],
  terminal: [[0,0,SCREEN_W,SCREEN_H,"#11161A"],[6,5,6,4,"#9BD8B4"],[16,5,24,4,"#9BD8B4"],[6,13,34,4,"#86CFA6"],[6,21,20,4,"#86CFA6"],[30,21,8,4,"#9BD8B4"]],
  figma:    [[0,0,SCREEN_W,SCREEN_H,"#F3ECE4"],[10,5,14,14,"#F0A79E"],[28,5,14,14,"#EFB472"],[10,21,14,8,"#86CFA6"],[28,21,14,8,"#6E9FD8"],[46,10,16,16,"#9E86C8"]],
  zoom:     [[0,0,SCREEN_W,SCREEN_H,"#2C4A6E"],[6,4,30,11,"#8FB8E0"],[40,4,30,11,"#8FB8E0"],[6,17,30,11,"#BEE7F7"],[40,17,30,11,"#BEE7F7"]],
  chrome:   [[0,0,SCREEN_W,SCREEN_H,"#FFFFFF"],[0,0,SCREEN_W,8,"#EDEDED"],[30,14,16,8,"#6E9FD8"],[28,12,8,5,"#F0A79E"],[24,18,7,8,"#86CFA6"],[40,18,7,8,"#EFC08A"]],
  slack:    [[0,0,SCREEN_W,SCREEN_H,"#3F2A3F"],[6,5,8,8,"#F0A79E"],[16,5,8,8,"#86CFA6"],[6,15,8,8,"#EFC08A"],[16,15,8,8,"#6E9FD8"],[30,6,34,3,"#EADFC7"],[30,13,26,3,"#EADFC7"],[30,20,34,3,"#EADFC7"]],
  notion:   [[0,0,SCREEN_W,SCREEN_H,"#F7F5F1"],[6,5,3,12,"#2A2622"],[15,5,3,12,"#2A2622"],[8,6,8,3,"#2A2622"],[24,7,40,3,"#9AA3A0"],[6,17,58,3,"#9AA3A0"],[6,24,44,3,"#9AA3A0"]],
};

// ── Hero station elements — plain function returning array of JSX elements (satori-safe)
function heroStationElements(category, screenKind, look, s) {
  const propRects = STATION_PROP_RECTS[category] || STATION_PROP_RECTS.focus;
  const kindRects = screenKind ? TOOL_SCREEN_RECTS[screenKind] : null;
  const catScreenColor = {
    coding: "#1E262B", design: "#F6BCD1", call: "#BEE7F7",
    music: "#2E4A3A", writing: "#F3E4B8", browsing: "#F4B3A6",
    focus: "#9FB3BE", other: "#9FB3BE",
  }[category] || "#9FB3BE";

  const prects = personRects(look);
  const els = [];

  if (look.glow) {
    els.push(<div key="glow" style={{ position: "absolute", left: 1 * s, top: 96 + 2 * s, width: 14 * s, height: 20 * s, background: look.glow, opacity: 0.22 }} />);
  }
  els.push(<div key="mon" style={{ position: "absolute", left: -28, top: 0, width: 100, height: 52, background: C.monitor }} />);
  els.push(<div key="scr" style={{ position: "absolute", left: -16, top: 10, width: 76, height: 32, background: kindRects ? "#000000" : catScreenColor }} />);

  if (kindRects) {
    kindRects.forEach(([x, y, w, h, bg], i) => {
      els.push(<div key={`sc${i}`} style={{ position: "absolute", left: -16 + x, top: 10 + y, width: w, height: h, background: bg }} />);
    });
  } else {
    els.push(<div key="g1" style={{ position: "absolute", left: -8, top: 18, width: 44, height: 5, background: "#FFFFFF", opacity: 0.35 }} />);
    els.push(<div key="g2" style={{ position: "absolute", left: -8, top: 29, width: 26, height: 5, background: "#FFFFFF", opacity: 0.25 }} />);
  }

  els.push(<div key="dt" style={{ position: "absolute", left: -52, top: 58, width: 152, height: 12, background: C.deskTop }} />);
  els.push(<div key="db" style={{ position: "absolute", left: -52, top: 70, width: 152, height: 24, background: C.desk }} />);
  els.push(<div key="ds" style={{ position: "absolute", left: -46, top: 94, width: 140, height: 8, borderRadius: 6, background: "#C9AE86", opacity: 0.35 }} />);

  propRects.forEach(([left, top, width, height, background, extra], i) => {
    els.push(<div key={`prop${i}`} style={{ position: "absolute", left, top, width, height, background, ...(extra || {}) }} />);
  });

  prects.forEach(([x, y, w, h, fill, extra], i) => {
    els.push(<div key={`p${i}`} style={{ position: "absolute", left: x * s, top: 96 + y * s, width: w * s, height: h * s, background: fill, ...(extra || {}) }} />);
  });

  return els;
}

// ── Route handler
export default async function Image({ params }) {
  const { slug } = await params;
  const title = cleanString(slug, 40) || "you";
  // For demo/testing: if slug starts with "demo-v" use that variant index.
  // Otherwise always use variant 0 (the default shape).
  const variantMatch = slug?.match(/^demo-v(\d)$/);
  const variant = variantMatch ? parseInt(variantMatch[1]) : 0;
  const recap = mockToRecap(recapMock(variant));
  const arch = pickArchetype(recap);
  return new ImageResponse(<RecapCard title={title} r={recap} arch={arch} />, size);
}

// ── The card — 1200×630 split left (content) / right (hero office scene)
function RecapCard({ title, r, arch }) {
  const { headline, summary, badge, badgeColor, lookIdx } = arch;

  // Hero station: pick category + screen from top non-ambient tool
  const heroTool = r.topApp ? r.topApp.tool : null;
  const heroCategory = TOOL_CAT[heroTool] || "focus";
  const heroScreenKind = TOOL_SCREEN_KIND[heroTool] || null;
  const heroLook = LOOKS[lookIdx % LOOKS.length];
  const topT = r.topApp || { accent: C.muted, glyph: "?", label: "—", seconds: 0 };
  const topAccent = r.topApp ? tool(r.topApp.tool).accent : C.muted;

  // App bar data: focus apps (top 4) + optional music row
  const musicApp = r.apps.find((a) => a.tool === "spotify" || a.tool === "apple-music");
  const bars = [...r.focusApps.slice(0, 4), ...(musicApp ? [musicApp] : [])].slice(0, 5);
  const barMax = bars.length ? bars[0].seconds : 1;

  const s = 4; // sprite scale: 4px per pixel

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex",
      background: C.paper, color: C.ink,
      fontFamily: "Arial, Helvetica, sans-serif", position: "relative",
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        display: "flex", flexDirection: "column", width: 630,
        padding: "38px 36px 34px 52px", position: "relative",
      }}>

        {/* Header: logo + date + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 42, height: 42, background: C.gold, border: `3px solid ${C.edge}`,
            borderRadius: 10, color: C.goldInk, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 900, boxShadow: "3px 3px 0 #EFE4CE",
          }}>
            m
          </div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 900, color: C.ink }}>mumbl</div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{
            display: "flex", padding: "5px 13px",
            borderRadius: 8, background: badgeColor, color: "#FFFFFF",
            fontSize: 12, fontWeight: 900, letterSpacing: 1.5,
          }}>
            {badge}
          </div>
        </div>

        {/* HEADLINE */}
        <div style={{
          display: "flex", fontSize: 22, fontWeight: 700, color: C.muted,
          letterSpacing: 0.5, marginBottom: 4, gap: 0,
        }}>
          <div style={{ display: "flex", color: C.muted }}>{title}&apos;s day · </div>
          <div style={{ display: "flex", color: C.ink }}>{r.date}</div>
        </div>
        <div style={{
          display: "flex", fontSize: 46, fontWeight: 900, lineHeight: 1.08,
          color: topAccent, marginBottom: 12,
        }}>
          {headline}
        </div>

        {/* SUMMARY */}
        <div style={{
          display: "flex", fontSize: 17, lineHeight: 1.5,
          color: C.muted, marginBottom: 20, maxWidth: 540,
        }}>
          {summary}
        </div>

        {/* TIME BREAKDOWN */}
        <div style={{
          display: "flex", fontSize: 12, color: C.muted, fontWeight: 700,
          letterSpacing: 1.5, marginBottom: 12,
        }}>
          WHERE THE DAY WENT
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 9 }}>
          {bars.map((a, i) => {
            const t = tool(a.tool);
            const isAmbient = AMBIENT_TOOLS.has(a.tool);
            const pct = Math.max(5, Math.round((a.seconds / barMax) * 100));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 7,
                  background: isAmbient ? C.track : t.accent,
                  color: isAmbient ? C.muted : "#FFFFFF",
                  fontSize: 13, fontWeight: 900, flexShrink: 0,
                  border: isAmbient ? `2px dashed ${C.edge}` : "none",
                }}>
                  {t.glyph}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: isAmbient ? C.muted : C.ink, marginBottom: 4 }}>
                    <div style={{ display: "flex" }}>{isAmbient ? `${t.label} ♪` : t.label}</div>
                    <div style={{ display: "flex", color: C.muted, fontSize: 13 }}>{fmt(a.seconds)}</div>
                  </div>
                  <div style={{ display: "flex", width: "100%", height: 9, borderRadius: 5, background: C.track }}>
                    <div style={{
                      display: "flex", width: `${pct}%`, height: 9, borderRadius: 5,
                      background: isAmbient ? C.edge : t.accent,
                      opacity: isAmbient ? 0.6 : 1,
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom meta line */}
        <div style={{
          position: "absolute", left: 52, bottom: 26,
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 13, color: C.muted, fontWeight: 700,
        }}>
          <div style={{ display: "flex" }}>{r.toolCount} tools</div>
          <div style={{ display: "flex", width: 3, height: 3, borderRadius: 3, background: C.edge }} />
          <div style={{ display: "flex" }}>{fmt(r.focused)} focused</div>
          <div style={{ display: "flex", width: 3, height: 3, borderRadius: 3, background: C.edge }} />
          <div style={{ display: "flex" }}>mumbl.wtf</div>
        </div>
      </div>

      {/* ── RIGHT PANEL: hero office scene ── */}
      <div style={{
        display: "flex", flexDirection: "column", width: 570,
        background: C.wall, position: "relative", overflow: "hidden",
      }}>
        {/* sky */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 570, height: 80, background: C.skyTop }} />
        <div style={{ position: "absolute", left: 0, top: 68, width: 570, height: 32, background: C.sky }} />
        {/* wall trim */}
        <div style={{ position: "absolute", left: 0, top: 96, width: 570, height: 4, background: "#A6D8D4" }} />

        {/* window */}
        <div style={{ position: "absolute", left: 175, top: 12, width: 190, height: 64, display: "flex" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 190, height: 64, background: C.wallTrim }} />
          <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 54, background: C.sky }} />
          <div style={{ position: "absolute", left: 5, top: 5, width: 180, height: 20, background: C.skyTop }} />
          <div style={{ position: "absolute", left: 5, top: 44, width: 180, height: 15, background: C.leaf }} />
          <div style={{ position: "absolute", left: 92, top: 0, width: 6, height: 64, background: C.wallTrim }} />
        </div>

        {/* floor + carpet */}
        <div style={{ position: "absolute", left: 0, top: 100, width: 570, height: 530, background: C.floor }} />
        <div style={{ position: "absolute", left: 20, top: 128, width: 530, height: 502, background: C.carpet }} />
        <div style={{ position: "absolute", left: 20, top: 128, width: 530, height: 4, background: C.carpetEdge }} />

        {/* HERO STATION — centered */}
        <div style={{
          position: "absolute", left: 215, top: 58,
          display: "flex", width: 16 * s, height: 320,
        }}>
          {heroStationElements(heroCategory, heroScreenKind, heroLook, s)}
        </div>

        {/* Stats bar at bottom of hero panel */}
        <div style={{
          position: "absolute", left: 0, bottom: 0, width: 570,
          display: "flex", flexDirection: "row",
          borderTop: `3px solid ${C.edge}`,
        }}>
          <div style={{
            display: "flex", flexDirection: "column", flex: 1,
            padding: "12px 18px", background: C.panel,
            borderRight: `2px solid ${C.edge}`,
          }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 900, color: C.ink }}>{fmt(r.focused)}</div>
            <div style={{ display: "flex", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>FOCUSED</div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", flex: 1,
            padding: "12px 18px", background: C.panel,
            borderRight: `2px solid ${C.edge}`,
          }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 900, color: C.ink }}>{r.toolCount}</div>
            <div style={{ display: "flex", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>TOOLS</div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", flex: 2,
            padding: "12px 18px", background: C.panel,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                display: "flex", width: 24, height: 24, borderRadius: 6,
                background: topAccent, color: "#FFF",
                alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900,
              }}>
                {tool(r.topApp?.tool || "other").glyph}
              </div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 900, color: C.ink }}>{fmt(r.topApp?.seconds || 0)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>
              TOP · {tool(r.topApp?.tool || "other").label.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
