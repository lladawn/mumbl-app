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

function headline(actors) {
  const working = actors.filter((a) => a.status === "working").length;
  const blocked = actors.filter((a) => a.status === "blocked").length;
  const done = actors.filter((a) => a.status === "done").length;
  const parts = [];
  if (working) parts.push(`${working} working`);
  if (blocked) parts.push(`${blocked} blocked`);
  if (done) parts.push(`${done} done`);
  if (!parts.length) return "a quiet office right now";
  return `${actors.length} desk${actors.length === 1 ? "" : "s"} · ${parts.join(" · ")}`;
}

export default async function Image({ params }) {
  const { slug } = await params;
  const state = await loadPublicState(slug);
  // shape-only: at most 4 stations rendered, statuses only, no task strings
  const actors = (state.actors || []).slice(0, 4);
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

function Station({ left, look, s, screen }) {
  return (
    <div style={{ position: "absolute", left, top: 40, display: "flex", width: 14 * s, height: 200 }}>
      <div style={{ position: "absolute", left: -28, top: 0, width: 100, height: 52, background: C.monitor }} />
      <div style={{ position: "absolute", left: -16, top: 10, width: 76, height: 32, background: screen }} />
      <div style={{ position: "absolute", left: -8, top: 18, width: 44, height: 5, background: "#FFFFFF", opacity: 0.8 }} />
      <div style={{ position: "absolute", left: -8, top: 29, width: 26, height: 5, background: "#FFFFFF", opacity: 0.6 }} />
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
        const look = LOOKS[i % LOOKS.length];
        const style = STATUS_STYLE[a.status] || STATUS_STYLE.idle;
        return { look, status: a.status || "idle", ...style, left: slots[i] || slots[slots.length - 1] };
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
          <Station key={i} left={st.left} look={st.look} s={s} screen={st.look.screen} />
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
