import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { cleanupExpiredSideQuestData, createSideQuestMessage, getOpenRoomForSession, sideQuestSessionHash } from "../../../../../src/server/sideQuests";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const messageText = cleanString(body.message, 360);
    if (!roomId) return badRequest("tiny room is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!messageText) return badRequest("message is required");

    const supabase = getSupabaseAdmin();
    await enforceRateLimit({ supabase, action: "side_quest_message", sessionToken });
    await cleanupExpiredSideQuestData(supabase);
    const sessionHash = sideQuestSessionHash(sessionToken);
    const room = await getOpenRoomForSession(supabase, { roomId, sessionHash });
    const message = await createSideQuestMessage(supabase, { room, sessionHash, message: messageText });
    return ok({ message });
  } catch (error) {
    return serverError(error);
  }
}
