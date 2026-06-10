import { hashToken } from "./hash";
import { getSupabaseAdmin } from "./supabase";
import { cleanString } from "./validation";

export async function resolveRequestOwner({ request, sessionToken }) {
  const cleanedSessionToken = cleanString(sessionToken, 256);
  const sessionTokenHash = cleanedSessionToken ? hashToken(cleanedSessionToken) : "";
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return { userId: "", sessionToken: cleanedSessionToken, sessionTokenHash, isAuthenticated: false };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return { userId: "", sessionToken: cleanedSessionToken, sessionTokenHash, isAuthenticated: false, authError: error };
  }

  return { userId: data.user.id, sessionToken: cleanedSessionToken, sessionTokenHash, isAuthenticated: true };
}

export function applyOwnerFilter(query, owner) {
  if (owner.userId) return query.eq("user_id", owner.userId);
  return query.eq("session_token_hash", owner.sessionTokenHash);
}

export function ownerInsertFields(owner) {
  return {
    session_token_hash: owner.sessionTokenHash,
    ...(owner.userId ? { user_id: owner.userId } : {}),
  };
}

export function ownerMatches(row, owner) {
  if (!row) return false;
  if (owner.userId && row.user_id === owner.userId) return true;
  return row.session_token_hash === owner.sessionTokenHash;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return "";
  return cleanString(token, 4096);
}
