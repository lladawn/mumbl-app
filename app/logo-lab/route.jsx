// TEMPORARY logo lab. GET /logo-lab?v=a|b|c|d renders a single mark as a square
// PNG (?size=), ?word=1 renders the wordmark lockup, ?sheet=1 renders every
// candidate at 200 / 64 / 24px on light and dark. Deleted once a mark is picked.
import { ImageResponse } from "next/og";
import { PALETTE, BUBBLE_ONE, BUBBLE_SCREEN, BUBBLE_DOT, LETTERS } from "../avatar-lab/logos";

const MARKS = { a: BUBBLE_ONE, b: BUBBLE_SCREEN, c: BUBBLE_DOT };
const NAMES = { a: "a · someone talking", b: "b · work, talked about", c: "c · bubble + status" };
const PAPER = "#FBF4E8";
const NIGHT = "#2E3A38";
const INK = "#3E4E4A";

// A grid of divs is the honest way to draw pixel art in Satori — no rounding,
// no antialiasing, exact at any scale.
function Grid({ grid, cell, left = 0, top = 0, colors = PALETTE }) {
  const cells = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = colors[ch];
      if (!fill) return;
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: left + x * cell,
            top: top + y * cell,
            width: cell,
            height: cell,
            background: fill,
          }}
        />
      );
    });
  });
  return <div style={{ display: "flex", position: "absolute", left: 0, top: 0 }}>{cells}</div>;
}

function Mark({ grid, size, bg }) {
  const cell = size / 16;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, background: bg || "transparent" }}>
      <Grid grid={grid} cell={cell} />
    </div>
  );
}

// mark + "mumbl" in pixel letters, the lockup for a site header or a README
function Wordmark({ height, color = INK, bg = PAPER }) {
  const cell = height / 16;
  const markW = 16 * cell;
  const lcell = cell * 1.15;
  const gap = lcell;
  const word = "mumbl";
  let x = markW + cell * 2.4;
  const letters = [];
  [...word].forEach((ch, i) => {
    const glyph = LETTERS[ch];
    glyph.forEach((row, gy) => {
      [...row].forEach((c, gx) => {
        if (c !== "#") return;
        letters.push(
          <div
            key={`${i}-${gx}-${gy}`}
            style={{
              position: "absolute",
              left: x + gx * lcell,
              top: height * 0.28 + gy * lcell,
              width: lcell,
              height: lcell,
              background: color,
            }}
          />
        );
      });
    });
    x += 5 * lcell + gap;
  });
  return (
    <div style={{ display: "flex", position: "relative", width: x, height, background: bg }}>
      <Grid grid={BUBBLE_ONE} cell={cell} />
      {letters}
    </div>
  );
}

function Sheet() {
  const keys = ["a", "b", "c"];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "30px 36px",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, fontWeight: 900 }}>
        mumbl logo candidates — 200px, 64px, 24px (favicon), and on dark
      </div>
      <div style={{ display: "flex", gap: 46, marginTop: 24 }}>
        {keys.map((k) => (
          <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Mark grid={MARKS[k]} size={230} />
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
              <Mark grid={MARKS[k]} size={64} />
              <Mark grid={MARKS[k]} size={24} />
              <div style={{ display: "flex", background: NIGHT, padding: 6 }}>
                <Mark grid={MARKS[k]} size={44} />
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#6B5334" }}>{NAMES[k]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 26, alignItems: "center", gap: 30 }}>
        <Wordmark height={86} />
        <div style={{ display: "flex", background: NIGHT, padding: "10px 14px" }}>
          <Wordmark height={54} color="#FFF8EC" bg={NIGHT} />
        </div>
      </div>
    </div>
  );
}

export function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("sheet")) {
    return new ImageResponse(<Sheet />, { width: 1200, height: 630 });
  }
  const size = Math.min(2048, Math.max(16, Number(searchParams.get("size")) || 512));
  if (searchParams.get("word")) {
    const height = size;
    return new ImageResponse(<Wordmark height={height} />, { width: Math.round(height * 5.4), height });
  }
  const grid = MARKS[searchParams.get("v") || "a"] || BUBBLE_ONE;
  const bg = searchParams.get("bg") === "paper" ? PAPER : undefined;
  return new ImageResponse(<Mark grid={grid} size={size} bg={bg} />, { width: size, height: size });
}
