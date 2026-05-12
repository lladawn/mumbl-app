import { ImageResponse } from "next/og";

export const alt = "mumbl - say the thing you've been mumbling all week";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<ShareImage />, size);
}

function ShareImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fbfaf7",
        color: "#161412",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "62px 72px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(90deg, rgba(22,20,18,0.055) 1px, transparent 1px), linear-gradient(rgba(22,20,18,0.055) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 42, fontWeight: 800 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 24,
              background: "#f8dda0",
              border: "3px solid #161412",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "6px 6px 0 #161412",
            }}
          >
            m
          </div>
          mumbl
        </div>
        <div
          style={{
            padding: "14px 18px",
            border: "2px solid #161412",
            borderRadius: 999,
            background: "#d9f2df",
            color: "#1f5d3a",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          anonymous · always
        </div>
      </div>

      <div style={{ display: "flex", gap: 34, alignItems: "flex-end", position: "relative" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, lineHeight: 0.96, fontWeight: 900, letterSpacing: -1 }}>
            say the thing you've been mumbling all week.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.35, color: "#5f5952", maxWidth: 760 }}>
              where engineering teams actually talk. anonymous, no signup, just the team being real.
          </div>
        </div>
        <div
          style={{
            width: 318,
            border: "3px solid #161412",
            borderRadius: 10,
            background: "#ffffff",
            boxShadow: "10px 10px 0 #161412",
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <CardLine title="rant" text="one more meeting and i'm going feral" color="#edcec4" />
          <CardLine title="win" text="the build is green and so are we" color="#f8dda0" />
          <CardLine title="heartbeat" text="heavy but alive" color="#d8e8ff" />
        </div>
      </div>
    </div>
  );
}

function CardLine({ title, text, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          alignSelf: "flex-start",
          padding: "5px 10px",
          borderRadius: 999,
          background: color,
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 22, lineHeight: 1.22, color: "#4e4842" }}>{text}</div>
    </div>
  );
}
