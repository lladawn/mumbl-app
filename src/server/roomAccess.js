import { hashToken } from "./hash";
import { cleanString } from "./validation";

export function cleanRoomAccessToken(value) {
  return cleanString(value, 256);
}

export function roomInvitePath(slug, accessToken) {
  const cleanedSlug = cleanString(slug, 80);
  const cleanedToken = cleanRoomAccessToken(accessToken);
  if (!cleanedSlug) return "/";
  const path = `/r/${encodeURIComponent(cleanedSlug)}/reads`;
  return cleanedToken ? `${path}?key=${encodeURIComponent(cleanedToken)}` : path;
}

export function assertRoomAccess({ space, accessToken, owner }) {
  if (!space?.read_token_hash || space.is_public) return;
  if (owner?.userId && owner.userId === space.creator_user_id) return;
  if (cleanRoomAccessToken(accessToken) && space.read_token_hash === hashToken(accessToken)) return;

  const error = new Error("this room needs the full invite link.");
  error.status = 403;
  throw error;
}

export async function saveRoomAccessForUser({ supabase, owner, space, accessToken }) {
  if (!owner?.userId || !space?.id || !space?.read_token_hash) return false;
  const cleanedToken = cleanRoomAccessToken(accessToken);
  if (!cleanedToken || space.read_token_hash !== hashToken(cleanedToken)) return false;

  const { error } = await supabase.from("saved_room_access").upsert(
    {
      user_id: owner.userId,
      space_id: space.id,
      read_token_hash: space.read_token_hash,
      last_opened_at: new Date().toISOString(),
    },
    { onConflict: "user_id,space_id" },
  );
  if (isMissingSavedRoomAccessTable(error)) return false;
  if (error) throw error;
  return true;
}

export function isMissingSavedRoomAccessTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205" || error?.code === "PGRST204" || message.includes("saved_room_access");
}
