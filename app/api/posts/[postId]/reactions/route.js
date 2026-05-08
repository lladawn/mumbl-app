import { badRequest, ok, serverError } from "../../../../../src/server/http";
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
    const sessionTokenHash = hashToken(sessionToken);

    const { data: existing, error: existingError } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("label", label)
      .eq("session_token_hash", sessionTokenHash)
      .maybeSingle();
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
