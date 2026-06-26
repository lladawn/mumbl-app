import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../src/server/auth";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { hashToken } from "../../../../../src/server/hash";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const label = cleanString(body.label, 48);
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!postId) return badRequest("post id is required");
    if (!label) return badRequest("reaction label is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    const reactionIdentity = owner.userId ? `auth-reaction:${owner.userId}` : sessionToken;
    await enforceRateLimit({ supabase, action: "reaction", sessionToken: reactionIdentity });

    const sessionTokenHash = hashToken(reactionIdentity);

    let existingQuery = supabase.from("reactions").select("id").eq("post_id", postId).eq("label", label);
    if (owner.userId && owner.sessionToken) {
      // also check the pre-migration session-token hash in case link-session hasn't run yet
      existingQuery = existingQuery.in("session_token_hash", [sessionTokenHash, hashToken(owner.sessionToken)]);
    } else {
      existingQuery = existingQuery.eq("session_token_hash", sessionTokenHash);
    }
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { error: deleteError } = await supabase.from("reactions").delete().eq("id", existing.id);
      if (deleteError) throw deleteError;
      return ok({ active: false });
    }

    const { error: insertError } = await supabase.from("reactions").insert({
      post_id: postId,
      label,
      session_token_hash: sessionTokenHash,
    });
    if (insertError) throw insertError;

    return ok({ active: true });
  } catch (error) {
    return serverError(error);
  }
}
