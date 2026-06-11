import { after } from "next/server";
import { ok, serverError } from "../../../../src/server/http";
import { parseVerifiedSlackJson, pinSlackSpaceForChannelMember, publishSlackAppHome } from "../../../../src/server/slack";
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

    if (payload.type === "event_callback" && payload.event?.type === "member_joined_channel") {
      const teamId = cleanString(payload.team_id || payload.event.team || payload.authorizations?.[0]?.team_id, 80);
      const slackUserId = cleanString(payload.event.user, 80);
      const channelId = cleanString(payload.event.channel, 80);
      after(async () => {
        if (!teamId || !slackUserId || !channelId) return;
        try {
          await pinSlackSpaceForChannelMember({ teamId, slackUserId, channelId });
        } catch (error) {
          console.error("Slack channel member auto-pin failed", {
            message: error.message,
            slackError: error.slack?.error,
          });
        }
      });
    }

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
