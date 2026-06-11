import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { claimCreatorAccess, resolveCreatorAccess } from "../../../../../../src/server/creatorAccess";
import { updateSlackSpacePosting } from "../../../../../../src/server/slack";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";

export async function PATCH(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    if (!slug) return badRequest("space slug is required");
    if (!Object.hasOwn(body, "postingEnabled")) return badRequest("postingEnabled is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error } = await supabase.from("spaces").select("id,creator_token_hash,creator_user_id").eq("slug", slug).single();
    if (error?.code === "PGRST116") return notFound("space not found");
    if (error) throw error;
    const access = await resolveCreatorAccess({ request, body, space });
    if (!access.canManage) return badRequest("creator token did not match");
    if (access.shouldClaim) await claimCreatorAccess({ supabase, spaceId: space.id, userId: access.owner.userId });

    const slackTeamReads = await updateSlackSpacePosting({ spaceId: space.id, postingEnabled: body.postingEnabled === true });
    return ok({ slackTeamReads });
  } catch (error) {
    return serverError(error);
  }
}
