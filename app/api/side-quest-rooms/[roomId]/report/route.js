import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { cleanupExpiredSideQuestData, closeSideQuestRoom, getOpenRoomForSession, sideQuestSessionHash } from "../../../../../src/server/sideQuests";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    if (!roomId) return badRequest("tiny room is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    await cleanupExpiredSideQuestData(supabase);
    const sessionHash = sideQuestSessionHash(sessionToken);
    const room = await getOpenRoomForSession(supabase, { roomId, sessionHash });
    await closeSideQuestRoom(supabase, { room, sessionHash, status: "reported" });
    return ok({ reported: true });
  } catch (error) {
    return serverError(error);
  }
}
