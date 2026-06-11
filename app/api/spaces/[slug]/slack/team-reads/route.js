import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { hashToken } from "../../../../../../src/server/hash";
import { updateSlackSpacePosting } from "../../../../../../src/server/slack";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";
import { cleanString } from "../../../../../../src/server/validation";

export async function PATCH(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const creatorToken = cleanString(body.creatorToken, 256);
    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");
    if (!Object.hasOwn(body, "postingEnabled")) return badRequest("postingEnabled is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error } = await supabase.from("spaces").select("id,creator_token_hash").eq("slug", slug).single();
    if (error?.code === "PGRST116") return notFound("space not found");
    if (error) throw error;
    if (space.creator_token_hash !== hashToken(creatorToken)) return badRequest("creator token did not match");

    const slackTeamReads = await updateSlackSpacePosting({ spaceId: space.id, postingEnabled: body.postingEnabled === true });
    return ok({ slackTeamReads });
  } catch (error) {
    return serverError(error);
  }
}
