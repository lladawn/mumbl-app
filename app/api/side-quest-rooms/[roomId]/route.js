import { badRequest, ok, serverError } from "../../../../src/server/http";
import { getOpenRoomForSession, serializeRoomWithMessages, sideQuestSessionHash } from "../../../../src/server/sideQuests";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function GET(request, { params }) {
  try {
    const { roomId } = await params;
    const sessionToken = cleanString(request.headers.get("x-session-token"), 256);
    if (!roomId) return badRequest("tiny room is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const sessionHash = sideQuestSessionHash(sessionToken);
    const room = await getOpenRoomForSession(supabase, { roomId, sessionHash });
    return ok({ room: await serializeRoomWithMessages(supabase, room, sessionHash) });
  } catch (error) {
    return serverError(error);
  }
}
