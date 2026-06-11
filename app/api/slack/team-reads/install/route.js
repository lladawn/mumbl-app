import { NextResponse } from "next/server";
import { badRequest, notFound, serverError } from "../../../../../src/server/http";
import { hashToken } from "../../../../../src/server/hash";
import { createTeamReadsSetup, slackTeamReadsInstallUrl } from "../../../../../src/server/slack";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const slug = cleanString(url.searchParams.get("slug"), 64);
    const creatorToken = cleanString(url.searchParams.get("creatorToken"), 256);
    if (!slug) return badRequest("space slug is required");
    if (!creatorToken) return badRequest("creator token is required");

    const supabase = getSupabaseAdmin();
    const { data: space, error } = await supabase.from("spaces").select("id,creator_token_hash").eq("slug", slug).single();
    if (error?.code === "PGRST116") return notFound("space not found");
    if (error) throw error;
    if (space.creator_token_hash !== hashToken(creatorToken)) return badRequest("creator token did not match");

    const setup = await createTeamReadsSetup({ spaceId: space.id });
    return NextResponse.redirect(slackTeamReadsInstallUrl(setup));
  } catch (error) {
    return serverError(error);
  }
}
