import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { hashToken } from "../../../../src/server/hash";
import { ensureDailyPrompt } from "../../../../src/server/prompts";
import { getTopReactionLabels, startOfTodayIso } from "../../../../src/server/roomVibe";
import { serializeSpace, summariseReactions } from "../../../../src/server/serializers";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("space slug is required");

    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken");
    const sessionTokenHash = sessionToken ? hashToken(sessionToken) : null;
    const supabase = getSupabaseAdmin();

    const { data: space, error: spaceError } = await supabase.from("spaces").select("*").eq("slug", slug).single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (postsError) throw postsError;

    const postIds = posts.map((post) => post.id);
    const [reactionsResult, activeReactionsResult, heartbeatsResult, todayReactionsResult, dailyPrompt] = await Promise.all([
      postIds.length
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length && sessionTokenHash
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds).eq("session_token_hash", sessionTokenHash)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("heartbeats").select("*").eq("space_id", space.id).order("week_of", { ascending: false }),
      postIds.length
        ? supabase.from("reactions").select("label,created_at").in("post_id", postIds).gte("created_at", startOfTodayIso())
        : Promise.resolve({ data: [], error: null }),
      ensureDailyPrompt(),
    ]);

    if (reactionsResult.error) throw reactionsResult.error;
    if (activeReactionsResult.error) throw activeReactionsResult.error;
    if (heartbeatsResult.error) throw heartbeatsResult.error;
    if (todayReactionsResult.error) throw todayReactionsResult.error;

    return ok({
      space: serializeSpace(
        space,
        posts,
        heartbeatsResult.data,
        summariseReactions(reactionsResult.data),
        activeReactionsResult.data,
        { dailyPrompt, roomVibe: getTopReactionLabels(todayReactionsResult.data) },
      ),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const creatorToken = cleanString(body.creatorToken, 256);
    const isPublic = body.isPublic === true;
    const publicName = isPublic ? cleanString(body.publicName, 80) || null : null;

    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,creator_token_hash")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    if (space.creator_token_hash !== hashToken(creatorToken)) {
      return badRequest("creator token did not match");
    }

    const { data: updatedSpace, error: updateError } = await supabase
      .from("spaces")
      .update({ is_public: isPublic, public_name: publicName })
      .eq("id", space.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return ok({ space: serializeSpace(updatedSpace) });
  } catch (error) {
    return serverError(error);
  }
}
