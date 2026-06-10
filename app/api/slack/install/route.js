import { NextResponse } from "next/server";
import { serverError } from "../../../../src/server/http";
import { slackInstallUrl } from "../../../../src/server/slack";

export async function GET() {
  try {
    return NextResponse.redirect(slackInstallUrl());
  } catch (error) {
    return serverError(error);
  }
}
