import { badRequest, notFound, ok, serverError } from "../../../../../src/server/http";
import { hashToken } from "../../../../../src/server/hash";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const creatorToken = cleanString(body.creatorToken, 256);

    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,creator_token_hash")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return notFound("space not found");
    if (spaceError) throw spaceError;

    if (space.creator_token_hash !== hashToken(creatorToken)) {
      return badRequest("creator token did not match");
    }

    const { error: updateError } = await supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id);
    if (updateError) throw updateError;

    return ok({ firstPostDone: true });
  } catch (error) {
    return serverError(error);
  }
}
