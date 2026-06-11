import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { claimCreatorAccess, resolveCreatorAccess } from "../../../../../src/server/creatorAccess";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();

    if (!slug) return badRequest("space slug is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,creator_token_hash,creator_user_id")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const access = await resolveCreatorAccess({ request, body, space });
    if (!access.canManage) {
      return badRequest("creator token did not match");
    }
    if (access.shouldClaim) await claimCreatorAccess({ supabase, spaceId: space.id, userId: access.owner.userId });

    const { error: updateError } = await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);
    if (updateError) throw updateError;

    return ok({ firstPostDone: true });
  } catch (error) {
    return serverError(error);
  }
}
