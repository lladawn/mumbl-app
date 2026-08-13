// TEMPORARY avatar lab — not linked from anywhere, deleted once a mark is
// picked. GET /_avatar-lab?v=1..4 renders a 400x400 profile picture candidate;
// ?sheet=1 renders all four side by side with 48px previews.
import { ImageResponse } from "next/og";

const C = {
  paper: "#FBF4E8",
  butter: "#F6D9A8",
  butterDeep: "#EFC08A",
  ink: "#3E4E4A",
  goldInk: "#6B5334",
  carpet: "#D2DAF0",
  mint: "#9BD8B4",
  wall: "#C7E9E5",
  floor: "#DDBA88",
  deskTop: "#F0D5A8",
  desk: "#E3C094",
  monitor: "#9FB3BE",
  screen: "#BBDCF0",
  line: "#59696E",
  shoe: "#8A7358",
  cream: "#FFF8EC",
};

// a pixel "m" on a 7x5 grid
const M = [
  [1, 0], [2, 0], [4, 0], [5, 0],
  [0, 1], [3, 1], [6, 1],
  [0, 2], [3, 2], [6, 2],
  [0, 3], [3, 3], [6, 3],
  [0, 4], [3, 4], [6, 4],
];

function PixelM({ px, color, left, top }) {
  return (
    <div style={{ display: "flex", position: "absolute", left, top }}>
      {M.map(([x, y], i) => (
        <div
          key={i}
          style={{ position: "absolute", left: x * px, top: y * px, width: px, height: px, background: color }}
        />
      ))}
    </div>
  );
}

// same trait system as the demo, trimmed to what an avatar shows
function personRects(look) {
  const hairStyle = look.hairStyle || "short";
  const outfit = look.outfit || "plain";
  const accessory = look.accessory || "none";
  const accent = look.accent || C.cream;
  const tx = look.build === "slim" ? 4 : 3;
  const tw = look.build === "slim" ? 6 : look.build === "broad" ? 9 : 8;
  const legL = tx + 1;
  const legR = tx + tw - (tw >= 8 ? 3 : 2);
  const r = [];
  const put = (x, y, w, h, fill) => r.push([x, y, w, h, fill]);

  if (hairStyle === "curly") {
    put(3, 0, 8, 5, look.hair);
    put(2, 2, 1, 4, look.hair);
    put(11, 2, 1, 4, look.hair);
  } else if (hairStyle === "cap") {
    put(4, 1, 6, 3, look.hair);
    put(3, 2, 8, 4, look.hair);
    put(3, 1, 8, 2, accent);
    put(2, 3, 5, 1, accent);
    put(3, 3, 8, 1, C.line);
  } else {
    put(4, 1, 6, 3, look.hair);
    put(3, 2, 8, 4, look.hair);
    put(4, 3, 6, 1, look.hair);
  }
  put(4, 4, 6, 4, look.skin);
  put(5, 6, 1, 1, C.line);
  put(8, 6, 1, 1, C.line);
  put(tx, 8, tw, 7, look.shirt);
  put(tx - 1, 9, 1, 5, look.shirt);
  put(tx + tw, 9, 1, 5, look.shirt);
  put(tx - 1, 13, 1, 2, look.skin);
  put(tx + tw, 13, 1, 2, look.skin);
  if (outfit === "stripes") [9, 11, 13].forEach((y) => put(tx, y, tw, 1, accent));
  if (outfit === "collar") {
    put(tx, 8, 2, 7, accent);
    put(tx + tw - 2, 8, 2, 7, accent);
    put(6, 8, 2, 1, C.cream);
    put(6, 9, 2, 4, look.pants);
  }
  put(legL, 15, 2, 4, look.pants);
  put(legR, 15, 2, 4, look.pants);
  put(legL - 1, 19, 3, 1, C.shoe);
  put(legR, 19, 3, 1, C.shoe);
  if (accessory === "glasses") {
    put(4, 5, 6, 1, C.line);
    put(3, 5, 1, 2, C.line);
    put(10, 5, 1, 2, C.line);
  }
  return r;
}

function Person({ look, s, left, top }) {
  return (
    <div style={{ display: "flex", position: "absolute", left, top, width: 14 * s, height: 20 * s }}>
      {personRects(look).map(([x, y, w, h, fill], i) => (
        <div
          key={i}
          style={{ position: "absolute", left: x * s, top: y * s, width: w * s, height: h * s, background: fill }}
        />
      ))}
    </div>
  );
}

const scout = {
  hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96",
  hairStyle: "curly", outfit: "stripes", accessory: "glasses", accent: C.cream, build: "slim",
};
const builder = {
  hair: "#332C26", skin: "#A0714B", shirt: "#94CDEE", pants: "#6E7E96",
  hairStyle: "cap", outfit: "plain", accessory: "none", accent: "#6E9FD8",
};
const you = {
  hair: "#3E3128", skin: "#D9A277", shirt: "#FFFDF4", pants: "#5E6E86",
  hairStyle: "short", outfit: "collar", accessory: "none", accent: "#DCE7E8",
};

function frame(children, bg) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: bg,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// 1 — the mark. Butter ground, deep pixel m, one mint "working" dot.
function V1(size) {
  const px = Math.round(size * 0.1);
  const mw = 7 * px;
  const mh = 5 * px;
  const d = size * 0.1;
  return frame(
    <>
      <PixelM px={px} color={C.goldInk} left={(size - mw) / 2} top={(size - mh) / 2 - size * 0.03} />
      <div
        style={{
          position: "absolute",
          left: size * 0.7,
          top: size * 0.17,
          width: d,
          height: d,
          borderRadius: d / 2,
          background: C.mint,
        }}
      />
    </>,
    C.butter
  );
}

// 2 — one collaborator, whole, standing on the bullpen carpet. Kept small
// enough that Twitter's circular crop never clips their head or feet.
function V2(size) {
  const s = size / 34;
  return frame(
    <>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: size, height: size * 0.22, background: "#C3CCE8" }} />
      <div style={{ position: "absolute", left: 0, bottom: size * 0.22, width: size, height: size * 0.012, background: "#AEB9DE" }} />
      <Person look={scout} s={s} left={(size - 14 * s) / 2} top={size * 0.28} />
    </>,
    C.carpet
  );
}

// 3 — the signature frame: head and shoulders above a desk, monitor lit.
function V3(size) {
  const s = size / 22;
  return frame(
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size * 0.22, background: C.wall }} />
      <div style={{ position: "absolute", left: 0, top: size * 0.21, width: size, height: size * 0.018, background: "#A6D8D4" }} />
      {/* monitor, small enough to leave the face room */}
      <div style={{ position: "absolute", left: size * 0.32, top: size * 0.03, width: size * 0.36, height: size * 0.19, background: C.monitor }} />
      <div style={{ position: "absolute", left: size * 0.35, top: size * 0.06, width: size * 0.3, height: size * 0.12, background: C.screen }} />
      <div style={{ position: "absolute", left: size * 0.38, top: size * 0.09, width: size * 0.16, height: size * 0.02, background: C.cream }} />
      {/* the person, then the desk in front of them */}
      <Person look={builder} s={s} left={(size - 14 * s) / 2} top={size * 0.26} />
      <div style={{ position: "absolute", left: 0, top: size * 0.68, width: size, height: size * 0.06, background: C.deskTop }} />
      <div style={{ position: "absolute", left: 0, top: size * 0.74, width: size, height: size * 0.26, background: C.desk }} />
    </>,
    C.floor
  );
}

// 4 — option 1 inverted: cream mark on the bullpen periwinkle.
function V4(size) {
  const px = Math.round(size * 0.1);
  const mw = 7 * px;
  const mh = 5 * px;
  const d = size * 0.1;
  return frame(
    <>
      <PixelM px={px} color={C.cream} left={(size - mw) / 2} top={(size - mh) / 2 - size * 0.03} />
      <div
        style={{
          position: "absolute",
          left: size * 0.7,
          top: size * 0.17,
          width: d,
          height: d,
          borderRadius: d / 2,
          background: C.butter,
        }}
      />
    </>,
    "#8E9BD8"
  );
}

const VARIANTS = { 1: V1, 2: V2, 3: V3, 4: V4 };

function Sheet() {
  const sizes = [260, 96, 48];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.paper,
        color: C.ink,
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: 40,
      }}
    >
      <div style={{ display: "flex", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
        mumbl avatar candidates — shown at 260px, 96px and 48px (real timeline size)
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 18 }}>
        {[1, 2, 3, 4].map((v) => (
          <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            {sizes.map((size) => (
              <div
                key={size}
                style={{
                  display: "flex",
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  overflow: "hidden",
                  border: `3px solid #E3D5BD`,
                }}
              >
                {VARIANTS[v](size)}
              </div>
            ))}
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: C.goldInk }}>option {v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("sheet")) {
    return new ImageResponse(<Sheet />, { width: 1200, height: 630 });
  }
  const v = Number(searchParams.get("v") || 1);
  // everything in a variant is proportional to `size`, so any square works
  const size = Math.min(2048, Math.max(64, Number(searchParams.get("size")) || 400));
  return new ImageResponse(VARIANTS[v] ? VARIANTS[v](size) : VARIANTS[1](size), { width: size, height: size });
}
