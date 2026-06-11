import { NextResponse } from "next/server";
import { serverError } from "../../../../../src/server/http";
import { exchangeSlackCode, storeSlackInstallation, verifySlackState } from "../../../../../src/server/slack";
import { getServerEnv } from "../../../../../src/server/env";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) throw new Error(`Slack install failed: ${error}`);

    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code) throw new Error("Slack install was missing an OAuth code.");
    verifySlackState(state);

    const oauthResult = await exchangeSlackCode(code);
    await storeSlackInstallation(oauthResult);

    return NextResponse.redirect(`${getServerEnv().appUrl}/slack/installed`);
  } catch (error) {
    return serverError(error);
  }
}
