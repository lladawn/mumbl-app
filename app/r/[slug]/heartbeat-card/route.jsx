import { ImageResponse } from "next/og";
import { getSupabaseAdmin } from "../../../../src/server/supabase";

export const runtime = "edge";
export const alt = "mumbl weekly heartbeat card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const heartbeat = await getLatestHeartbeat(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 58,
          border: "6px solid #161412",
          background: "#fbfaf7",
          color: "#161412",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 800 }}>
          <span>mumbl heartbeat</span>
          <span>{heartbeat.week_of || "this week"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              width: "fit-content",
              padding: "18px 30px",
              border: "4px solid #161412",
              borderRadius: 999,
              background: "#f8dda0",
              boxShadow: "8px 8px 0 #161412",
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {heartbeat.vibe_word || "alive"}
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.08, maxWidth: 960 }}>
            {heartbeat.card_line || heartbeat.vibe_read || "the room is becoming real."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 30, fontWeight: 800 }}>
          <span style={pillStyle}>theme: {heartbeat.top_theme || "general work weather"}</span>
          <span style={pillStyle}>energy: {heartbeat.energy_level ?? 50}/100</span>
        </div>
      </div>
    ),
    size,
  );
}

const pillStyle = {
  display: "flex",
  padding: "14px 20px",
  border: "3px solid #161412",
  borderRadius: 999,
  background: "#d9f2df",
};

async function getLatestHeartbeat(slug) {
  const supabase = getSupabaseAdmin();
  const { data: space, error: spaceError } = await supabase.from("spaces").select("id").eq("slug", slug).single();
  if (spaceError) return {};

  const { data: heartbeat, error: heartbeatError } = await supabase
    .from("heartbeats")
    .select("week_of,vibe_read,vibe_word,top_theme,energy_level,card_line")
    .eq("space_id", space.id)
    .order("week_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (heartbeatError || !heartbeat) return {};
  return heartbeat;
}
