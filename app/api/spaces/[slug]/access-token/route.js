import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../src/server/auth";
import { getSavedAccessToken, isMissingSavedRoomAccessTable } from "../../../../../src/server/roomAccess";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("space slug is required");

    const sessionToken = cleanString(request.headers.get("x-session-token"), 256);
    const owner = await resolveRequestOwner({ request, sessionToken });
    if (!owner.userId) return ok({ accessToken: null });

    const supabase = getSupabaseAdmin();
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id,slug,creator_user_id")
      .eq("slug", slug)
      .single();
    if (spaceError?.code === "PGRST116") return ok({ accessToken: null });
    if (spaceError) throw spaceError;

    const accessToken = await getSavedAccessToken({ supabase, owner, space });
    return ok({ accessToken });
  } catch (error) {
    if (isMissingSavedRoomAccessTable(error)) return ok({ accessToken: null });
    return serverError(error);
  }
}
