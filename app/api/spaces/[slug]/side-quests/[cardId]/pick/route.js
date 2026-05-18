import { badRequest, ok, serverError } from "../../../../../../../src/server/http";
import { enforceRateLimit } from "../../../../../../../src/server/rateLimit";
import { getSpaceBySlug, pickSideQuestCard, sideQuestSessionHash } from "../../../../../../../src/server/sideQuests";
import { getSupabaseAdmin } from "../../../../../../../src/server/supabase";
import { cleanString } from "../../../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { slug, cardId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    if (!slug) return badRequest("space slug is required");
    if (!cardId) return badRequest("side quest card is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "side_quest_pick", sessionToken });
    const space = await getSpaceBySlug(supabase, slug);
    return ok(await pickSideQuestCard(supabase, { spaceId: space.id, cardId, sessionHash: sideQuestSessionHash(sessionToken) }));
  } catch (error) {
    return serverError(error);
  }
}
