import { ImageResponse } from "next/og";

export const alt = "mumbl — a workspace where your AI agents are collaborators you can see";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<ShareImage />, size);
}

// Palette and sprite geometry are the same as the landing and /demo, so the
// share card looks like the thing people land on. Satori has no <svg> rect
// support worth relying on, so the pixel art is built from positioned divs —
// which is what pixel art is anyway.
const C = {
  teal: "#14312F",
  tealRaised: "#1B3B38",
  wall: "#1B3B38",
  ink: "#0A1918",
  cream: "#F0E2C8",
  muted: "#9DB3AC",
  ochre: "#E0A458",
  red: "#C25450",
  green: "#6FA88A",
  floor: "#6B4A2F",
  floorAlt: "#63432A",
  deskTop: "#A5713F",
  desk: "#8A5E38",
  monitor: "#14201F",
  screen: "#2E4A46",
};

// [x, y, w, h, colourKey] on a 14x20 grid — identical to the demo's makePerson
const PERSON = [
  [4, 1, 6, 3, "hair"],
  [3, 2, 8, 4, "hair"],
  [4, 4, 6, 4, "skin"],
  [4, 3, 6, 1, "hair"],
  [5, 6, 1, 1, "eye"],
  [8, 6, 1, 1, "eye"],
  [3, 8, 8, 7, "shirt"],
  [2, 9, 1, 5, "shirt"],
  [11, 9, 1, 5, "shirt"],
  [2, 13, 1, 2, "skin"],
  [11, 13, 1, 2, "skin"],
  [4, 15, 2, 4, "pants"],
  [8, 15, 2, 4, "pants"],
  [3, 19, 3, 1, "shoe"],
  [8, 19, 3, 1, "shoe"],
];

function Person({ look, s }) {
  return (
    <div style={{ display: "flex", position: "relative", width: 14 * s, height: 20 * s }}>
      {look.glow ? (
        <div
          style={{
            position: "absolute",
            left: 1 * s,
            top: 0,
            width: 12 * s,
            height: 20 * s,
            background: look.glow,
            opacity: 0.22,
          }}
        />
      ) : null}
      {PERSON.map(([x, y, w, h, key], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x * s,
            top: y * s,
            width: w * s,
            height: h * s,
            background: key === "eye" ? "#14201F" : key === "shoe" ? "#2A1D12" : look[key],
          }}
        />
      ))}
    </div>
  );
}

function Pill({ label, color, left }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 16,
        display: "flex",
        padding: "5px 11px",
        background: "rgba(7,11,11,0.92)",
        border: `2px solid ${color}`,
        color,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: 1.5,
      }}
    >
      {label}
    </div>
  );
}

// Everything is measured so the character's feet land inside the room band —
// at larger scales the sprites overflow and get clipped away entirely.
function Station({ left, look, s }) {
  return (
    <div style={{ position: "absolute", left, top: 52, display: "flex", width: 14 * s, height: 180 }}>
      {/* monitor */}
      <div style={{ position: "absolute", left: -28, top: 0, width: 100, height: 52, background: C.monitor }} />
      <div style={{ position: "absolute", left: -16, top: 10, width: 76, height: 32, background: C.screen }} />
      <div style={{ position: "absolute", left: -8, top: 18, width: 44, height: 5, background: C.green, opacity: 0.7 }} />
      <div style={{ position: "absolute", left: -8, top: 29, width: 26, height: 5, background: "#9FD4C4", opacity: 0.5 }} />
      {/* desk */}
      <div style={{ position: "absolute", left: -52, top: 58, width: 152, height: 12, background: C.deskTop }} />
      <div style={{ position: "absolute", left: -52, top: 70, width: 152, height: 24, background: C.desk }} />
      {/* collaborator */}
      <div style={{ position: "absolute", left: 0, top: 96, display: "flex" }}>
        <Person look={look} s={s} />
      </div>
    </div>
  );
}

function ShareImage() {
  const s = 4;
  const looks = {
    scout: { hair: "#3B2A1E", skin: "#D9A277", shirt: "#2F6B63", pants: "#2A2E33", glow: "#7FD4C6" },
    human: { hair: "#2B211A", skin: "#C98B5E", shirt: "#F0E2C8", pants: "#2A2E33", glow: null },
    builder: { hair: "#1E1B18", skin: "#8C5F3C", shirt: "#3E5F8A", pants: "#242830", glow: "#8FB6E8" },
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.teal,
        color: C.cream,
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "44px 60px 0",
        position: "relative",
      }}
    >
      {/* brand row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 900 }}>
          <div
            style={{
              width: 68,
              height: 68,
              background: C.ochre,
              border: `3px solid ${C.ink}`,
              color: C.teal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `6px 6px 0 ${C.ink}`,
            }}
          >
            m
          </div>
          mumbl
        </div>
        <div
          style={{
            display: "flex",
            padding: "12px 18px",
            border: `2px solid ${C.ochre}`,
            background: "rgba(7,11,11,0.5)",
            color: C.ochre,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          early build · mumbl.wtf/demo
        </div>
      </div>

      {/* headline */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative", marginTop: 48 }}>
        <div style={{ fontSize: 56, lineHeight: 1.06, fontWeight: 900, maxWidth: 1010 }}>
          agent work still feels like a terminal.
        </div>
        <div style={{ marginTop: 16, fontSize: 25, lineHeight: 1.35, color: C.muted, maxWidth: 900 }}>
          Most people use a code editor instead. Mumbl is a workspace where your AI agents are collaborators
          you can see.
        </div>
      </div>

      {/* the room */}
      <div
        style={{
          display: "flex",
          // anchored to the bottom edge rather than flowed, so the sprites'
          // feet always land inside the card no matter how the text wraps
          position: "absolute",
          left: 60,
          bottom: 0,
          width: 1080,
          height: 262,
          border: `3px solid ${C.ink}`,
          borderBottom: "none",
          background: C.floor,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 64, background: C.wall }} />
        <div style={{ position: "absolute", left: 0, top: 60, width: 1080, height: 4, background: C.ink }} />
        {/* windows */}
        <div style={{ position: "absolute", left: 330, top: 12, width: 140, height: 40, background: "#E8B979" }} />
        <div style={{ position: "absolute", left: 330, top: 12, width: 140, height: 16, background: "#F2D4A2" }} />
        <div style={{ position: "absolute", left: 660, top: 12, width: 140, height: 40, background: "#E8B979" }} />
        <div style={{ position: "absolute", left: 660, top: 12, width: 140, height: 16, background: "#F2D4A2" }} />

        <Pill label="WORKING" color={C.ochre} left={110} />
        <Pill label="BLOCKED" color={C.red} left={492} />
        <Pill label="DONE" color={C.green} left={872} />

        <Station left={150} look={looks.scout} s={s} />
        <Station left={528} look={looks.human} s={s} />
        <Station left={900} look={looks.builder} s={s} />
      </div>
    </div>
  );
}
