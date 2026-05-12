import { makeHeartbeat } from "../../../../src/lib/heartbeat";
import { getServerEnv } from "../../../../src/server/env";
import { makeHeartbeatCardFields } from "../../../../src/server/heartbeatCard";
import { badRequest, ok, serverError } from "../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../src/server/supabase";

const BATCH_SIZE = 25;

export async function GET(request) {
  return enqueueAndProcessHeartbeats(request);
}

export async function POST(request) {
  return enqueueAndProcessHeartbeats(request);
}

async function enqueueAndProcessHeartbeats(request) {
  try {
    const { cronSecret } = getServerEnv();
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader !== "Bearer " + cronSecret) {
      return badRequest("invalid cron secret");
    }

    const supabase = getSupabaseAdmin();
    const weekOf = currentMonday();
    const enqueued = await enqueueHeartbeatJobs(supabase, weekOf);
    const processed = await processHeartbeatJobs(supabase, weekOf);

    return ok({ weekOf, enqueued, processed, batchSize: BATCH_SIZE });
  } catch (error) {
    return serverError(error);
  }
}

async function enqueueHeartbeatJobs(supabase, weekOf) {
  const { data: spaces, error: spacesError } = await supabase.from("spaces").select("id");
  if (spacesError) throw spacesError;
  if (!spaces.length) return 0;

  const { error } = await supabase.from("heartbeat_jobs").upsert(
    spaces.map((space) => ({
      space_id: space.id,
      week_of: weekOf,
      status: "queued",
    })),
    { onConflict: "space_id,week_of", ignoreDuplicates: true },
  );
  if (error) throw error;
  return spaces.length;
}

async function processHeartbeatJobs(supabase, weekOf) {
  const { data: jobs, error: jobsError } = await supabase.rpc("claim_heartbeat_jobs", {
    p_week_of: weekOf,
    p_limit: BATCH_SIZE,
    p_max_attempts: 3,
  });
  if (jobsError) throw jobsError;

  const processed = [];
  for (const job of jobs || []) {
    try {
      const summary = await generateHeartbeatForSpace(supabase, job.space_id, weekOf);
      const { error: completeError } = await supabase
        .from("heartbeat_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (completeError) throw completeError;
      processed.push({ spaceId: job.space_id, status: "completed", ...summary });
    } catch (error) {
      const { error: failError } = await supabase
        .from("heartbeat_jobs")
        .update({ status: "failed", last_error: error.message || "heartbeat failed" })
        .eq("id", job.id);
      if (failError) throw failError;
      processed.push({ spaceId: job.space_id, status: "failed" });
    }
  }

  return processed;
}

async function generateHeartbeatForSpace(supabase, spaceId, weekOf) {
  const { data: space, error: spaceError } = await supabase.from("spaces").select("*").eq("id", spaceId).single();
  if (spaceError) throw spaceError;

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id,type,content")
    .eq("space_id", space.id)
    .gte("created_at", weekOf + "T00:00:00.000Z");
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

  const heartbeat = makeHeartbeat({
    ...space,
    vibe: space.vibe,
    posts: anonymisedPosts.map((post) => ({
      type: post.type,
      content: post.content,
      reactions: { total: Array.from({ length: post.reaction_count }) },
    })),
  });
  const card = makeHeartbeatCardFields({ heartbeat, posts, reactions });

  const { error: upsertError } = await supabase.from("heartbeats").upsert(
    {
      space_id: space.id,
      week_of: weekOf,
      vibe_read: heartbeat.vibeRead,
      digest: heartbeat.digest,
      uplift: heartbeat.uplift,
      vibe_word: card.vibeWord,
      top_theme: card.topTheme,
      energy_level: card.energyLevel,
      card_line: card.cardLine,
    },
    { onConflict: "space_id,week_of" },
  );
  if (upsertError) throw upsertError;

  return { slug: space.slug, posts: anonymisedPosts.length };
}

function currentMonday() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() - day + 1);
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}
