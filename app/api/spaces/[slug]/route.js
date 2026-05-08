import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { hashToken } from "../../../../src/server/hash";
import { serializeSpace, summariseReactions } from "../../../../src/server/serializers";
import { getSupabaseAdmin } from "../../../../src/server/supabase";

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
    const [reactionsResult, activeReactionsResult, heartbeatsResult] = await Promise.all([
      postIds.length
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length && sessionTokenHash
        ? supabase.from("reactions").select("post_id,label").in("post_id", postIds).eq("session_token_hash", sessionTokenHash)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("heartbeats").select("*").eq("space_id", space.id).order("week_of", { ascending: false }),
    ]);

    if (reactionsResult.error) throw reactionsResult.error;
    if (activeReactionsResult.error) throw activeReactionsResult.error;
    if (heartbeatsResult.error) throw heartbeatsResult.error;

    return ok({
      space: serializeSpace(
        space,
        posts,
        heartbeatsResult.data,
        summariseReactions(reactionsResult.data),
        activeReactionsResult.data,
      ),
    });
  } catch (error) {
    return serverError(error);
  }
}
