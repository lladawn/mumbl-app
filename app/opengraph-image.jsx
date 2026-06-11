import { ImageResponse } from "next/og";

export const alt = "mumbl - save what you're thinking before you polish what you say";
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
        padding: "56px 66px",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 42, fontWeight: 900 }}>
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
            background: "#d8e8ff",
            color: "#173c66",
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          slack beta · private first
        </div>
      </div>

      <div style={{ display: "flex", gap: 36, alignItems: "flex-end", position: "relative" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, lineHeight: 0.96, fontWeight: 900, letterSpacing: 0 }}>
            save what you're thinking before you polish what you say.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.35, color: "#5f5952", maxWidth: 760 }}>
            /mumbl saves the honest version privately. shape it into a field note later, or keep it for yourself.
          </div>
        </div>
        <div
          style={{
            width: 360,
            border: "3px solid #161412",
            borderRadius: 10,
            background: "#ffffff",
            boxShadow: "10px 10px 0 #161412",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <CardLine
            title="# tiny-fires"
            text={'/mumbl i said "just needs polish" again, but honestly i think i\'m scared to name the rewrite.'}
            color="#f8dda0"
          />
          <CardLine title="only visible to you" text="saved privately to mumbl." color="#d9f2df" />
          <CardLine title="team read" text="publish only when the useful part can help the team." color="#d8e8ff" />
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
          fontWeight: 900,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 22, lineHeight: 1.22, color: "#4e4842" }}>{text}</div>
    </div>
  );
}
