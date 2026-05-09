import { makeHeartbeat } from "../../../../src/lib/heartbeat";
import { getServerEnv } from "../../../../src/server/env";
import { badRequest, ok, serverError } from "../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../src/server/supabase";

export async function GET(request) {
  return generateHeartbeats(request);
}

export async function POST(request) {
  return generateHeartbeats(request);
}

async function generateHeartbeats(request) {
  try {
    const { cronSecret } = getServerEnv();
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return badRequest("invalid cron secret");
    }

    const supabase = getSupabaseAdmin();
    const weekOf = currentMonday();
    const { data: spaces, error: spacesError } = await supabase.from("spaces").select("*");
    if (spacesError) throw spacesError;

    const generated = [];
    for (const space of spaces) {
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("id,type,content")
        .eq("space_id", space.id)
        .gte("created_at", `${weekOf}T00:00:00.000Z`);
      if (postsError) throw postsError;

      const postIds = posts.map((post) => post.id);
      const { data: reactions, error: reactionsError } = postIds.length
        ? await supabase.from("reactions").select("post_id,label").in("post_id", postIds)
        : { data: [], error: null };
      if (reactionsError) throw reactionsError;

      const reactionCounts = reactions.reduce((counts, reaction) => {
        counts[reaction.post_id] = (counts[reaction.post_id] || 0) + 1;
        return counts;
      }, {});

      const anonymisedPosts = posts.map((post) => ({
        type: post.type,
        content: post.content,
        reaction_count: reactionCounts[post.id] || 0,
      }));

      // This local generator keeps the route useful before the AI provider is wired.
      // The payload above is intentionally the only shape an AI call should receive.
      const heartbeat = makeHeartbeat({
        ...space,
        vibe: space.vibe,
        posts: anonymisedPosts.map((post) => ({
          type: post.type,
          content: post.content,
          reactions: { total: Array.from({ length: post.reaction_count }) },
        })),
      });

      const { error: upsertError } = await supabase.from("heartbeats").upsert(
        {
          space_id: space.id,
          week_of: weekOf,
          vibe_read: heartbeat.vibeRead,
          digest: heartbeat.digest,
          uplift: heartbeat.uplift,
        },
        { onConflict: "space_id,week_of" },
      );
      if (upsertError) throw upsertError;

      generated.push({ slug: space.slug, posts: anonymisedPosts.length });
    }

    return ok({ weekOf, generated });
  } catch (error) {
    return serverError(error);
  }
}

function currentMonday() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() - day + 1);
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}
