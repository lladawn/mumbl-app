import { resolveRequestOwner } from "./auth";
import { hashToken } from "./hash";
import { cleanString } from "./validation";

export async function resolveCreatorAccess({ request, body = {}, space }) {
  const creatorToken = cleanString(body.creatorToken, 256);
  const owner = await resolveRequestOwner({ request, sessionToken: cleanString(body.sessionToken, 256) || "creator-access" });
  const tokenMatches = creatorToken && space.creator_token_hash === hashToken(creatorToken);
  const userMatches = owner.userId && space.creator_user_id === owner.userId;

  return {
    owner,
    creatorToken,
    canManage: Boolean(tokenMatches || userMatches),
    shouldClaim: Boolean(tokenMatches && owner.userId && !space.creator_user_id),
  };
}

export async function claimCreatorAccess({ supabase, spaceId, userId }) {
  if (!userId) return;
  const { error } = await supabase.from("spaces").update({ creator_user_id: userId }).eq("id", spaceId).is("creator_user_id", null);
  if (error) throw error;
}
