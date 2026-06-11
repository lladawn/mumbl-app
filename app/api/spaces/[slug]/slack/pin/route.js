import { badRequest, notFound, ok, serverError } from "../../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../../src/server/auth";
import { pinSlackSpaceForMumblUser } from "../../../../../../src/server/slack";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("space slug is required");

    const owner = await resolveRequestOwner({ request, sessionToken: "slack-pin" });
    if (!owner.userId) return badRequest("log in before pinning a room for Slack.");

    const supabase = getSupabaseAdmin();
    const { data: space, error } = await supabase.from("spaces").select("id,name").eq("slug", slug).single();
    if (error?.code === "PGRST116") return notFound("space not found");
    if (error) throw error;

    await pinSlackSpaceForMumblUser({ mumblUserId: owner.userId, spaceId: space.id });
    return ok({ pinned: true, space });
  } catch (error) {
    return serverError(error);
  }
}
