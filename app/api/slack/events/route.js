import { after } from "next/server";
import { ok, serverError } from "../../../../src/server/http";
import { parseVerifiedSlackJson, publishSlackAppHome } from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const payload = await parseVerifiedSlackJson(request);
    if (payload.type === "url_verification") {
      return ok({ challenge: payload.challenge || "" });
    }

    if (payload.type === "event_callback" && payload.event?.type === "app_home_opened") {
      const teamId = cleanString(payload.team_id || payload.authorizations?.[0]?.team_id, 80);
      const slackUserId = cleanString(payload.event.user, 80);
      after(async () => {
        if (!teamId || !slackUserId) return;
        try {
          await publishSlackAppHome({ teamId, slackUserId });
        } catch {
          // App Home should not retry noisily if Slack rejects the view publish.
        }
      });
    }

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
