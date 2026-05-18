import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { cleanupExpiredSideQuestData, createSideQuestCard, fetchSideQuestState, getSpaceBySlug, sideQuestSessionHash } from "../../../../../src/server/sideQuests";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const sessionToken = cleanString(new URL(request.url).searchParams.get("sessionToken"), 256);
    if (!slug) return badRequest("space slug is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const space = await getSpaceBySlug(supabase, slug);
    return ok(await fetchSideQuestState(supabase, { spaceId: space.id, sessionHash: sideQuestSessionHash(sessionToken) }));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const kind = cleanString(body.kind, 12);
    const context = cleanString(body.context, 140);
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!slug) return badRequest("space slug is required");
    if (!["need", "open"].includes(kind)) return badRequest("unsupported side quest type");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "side_quest_create", sessionToken });
    await cleanupExpiredSideQuestData(supabase);
    const space = await getSpaceBySlug(supabase, slug);
    const card = await createSideQuestCard(supabase, {
      spaceId: space.id,
      sessionHash: sideQuestSessionHash(sessionToken),
      kind,
      context,
    });

    return ok({ card });
  } catch (error) {
    return serverError(error);
  }
}
