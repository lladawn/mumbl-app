import { getServerEnv } from "../../../../src/server/env";
import { badRequest, ok, serverError } from "../../../../src/server/http";
import { ensureDailyPrompt } from "../../../../src/server/prompts";

export async function GET(request) {
  return rotatePrompt(request);
}

export async function POST(request) {
  return rotatePrompt(request);
}

async function rotatePrompt(request) {
  try {
    const { cronSecret } = getServerEnv();
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader !== "Bearer " + cronSecret) {
      return badRequest("invalid cron secret");
    }

    const prompt = await ensureDailyPrompt();
    return ok({ prompt });
  } catch (error) {
    return serverError(error);
  }
}
