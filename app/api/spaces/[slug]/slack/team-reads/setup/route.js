import { badRequest, notFound, ok, serverError } from "../../../../../../../src/server/http";
import { hashToken } from "../../../../../../../src/server/hash";
import { createTeamReadsSetup, slackTeamReadsInstallUrl } from "../../../../../../../src/server/slack";
import { getSupabaseAdmin } from "../../../../../../../src/server/supabase";
import { cleanString } from "../../../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const creatorToken = cleanString(body.creatorToken, 256);
    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error } = await supabase.from("spaces").select("id,creator_token_hash").eq("slug", slug).single();
    if (error?.code === "PGRST116") return notFound("space not found");
    if (error) throw error;
    if (space.creator_token_hash !== hashToken(creatorToken)) return badRequest("creator token did not match");

    const setup = await createTeamReadsSetup({ spaceId: space.id });
    return ok({ installUrl: slackTeamReadsInstallUrl(setup) });
  } catch (error) {
    return serverError(error);
  }
}
