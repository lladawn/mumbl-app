import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { hashToken } from "../../../../../src/server/hash";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString, isValidPostType } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const type = cleanString(body.type, 24);
    const content = cleanString(body.content, 420);
    const isAnonymous = body.isAnonymous !== false;
    const displayName = isAnonymous ? null : cleanString(body.displayName, 48) || "someone brave";
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!slug) return badRequest("space slug is required");
    if (!isValidPostType(type)) return badRequest("unsupported post type");
    if (!content) return badRequest("post content is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase.from("spaces").select("id").eq("slug", slug).single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        space_id: space.id,
        type,
        content,
        is_anonymous: isAnonymous,
        display_name: displayName,
      })
      .select()
      .single();
    if (postError) throw postError;

    if (isAnonymous && sessionToken) {
      await supabase.from("anon_audit").insert({
        post_id: post.id,
        session_token_hash: hashToken(sessionToken),
      });
    }

    const { error: updateError } = await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);
    if (updateError) throw updateError;

    return ok({ post });
  } catch (error) {
    return serverError(error);
  }
}
