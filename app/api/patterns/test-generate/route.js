import { badRequest, ok, serverError } from "../../../../src/server/http";
import { assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../src/server/auth";
import { getServerEnv } from "../../../../src/server/env";
import { generateAndDeliverInsight } from "../../../../src/server/insights";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    if (!getServerEnv().patternGraphTestToolsEnabled) {
      return badRequest("pattern test tools are disabled");
    }

    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    if (!owner.userId) return badRequest("login is required");

    const { count, error: countError } = await supabase
      .from("dumps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner.userId)
      .eq("visibility", "private");
    if (countError) throw countError;

    const pattern = await generateAndDeliverInsight(supabase, owner.userId, count || 0);
    if (!pattern) {
      return ok({
        pattern: null,
        message: "not enough private dumps yet. add at least 5 logged-in dumps, then try again.",
      });
    }

    return ok({ pattern });
  } catch (error) {
    return serverError(error);
  }
}
