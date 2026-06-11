import { NextResponse } from "next/server";
import { serverError } from "../../../../../../src/server/http";
import {
  consumeTeamReadsSetup,
  createSlackSpaceChannel,
  exchangeSlackTeamReadsCode,
  storeSlackInstallation,
  verifySlackState,
} from "../../../../../../src/server/slack";
import { getServerEnv } from "../../../../../../src/server/env";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) throw new Error(`Slack team reads setup failed: ${error}`);

    const code = url.searchParams.get("code") || "";
    const state = verifySlackState(url.searchParams.get("state") || "");
    if (!code) throw new Error("Slack team reads setup was missing an OAuth code.");
    if (!state.setupId || !state.setupToken) throw new Error("Slack team reads setup expired. Try again.");

    const setup = await consumeTeamReadsSetup({ setupId: state.setupId, setupToken: state.setupToken });
    const oauthResult = await exchangeSlackTeamReadsCode(code);
    await storeSlackInstallation(oauthResult);
    await createSlackSpaceChannel({ oauthResult, setup });

    return NextResponse.redirect(`${getServerEnv().appUrl}/r/${setup.spaces.slug}/reads?slack=team-reads-ready`);
  } catch (error) {
    return serverError(error);
  }
}
