import { ok, serverError } from "../../../../src/server/http";
import {
  connectSlackUser,
  createPendingSlackDump,
  dumpUrl,
  ephemeralLink,
  ephemeralText,
  findMumblUserByEmail,
  findSlackConnection,
  getSlackUserEmail,
  parseVerifiedSlackForm,
  saveSlackDump,
  slackConnectUrl,
} from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const form = await parseVerifiedSlackForm(request);
    const payloadText = form.get("payload");
    if (!payloadText) return ok(ephemeralText("Slack did not send a shortcut payload."));

    const payload = JSON.parse(payloadText);
    if (payload.type !== "message_action" || payload.callback_id !== "save_to_mumbl") {
      return ok(ephemeralText("That Slack action is not wired to Mumbl yet."));
    }

    const teamId = cleanString(payload.team?.id, 80);
    const slackUserId = cleanString(payload.user?.id, 80);
    const content = cleanString(payload.message?.text, 4000);
    if (!teamId || !slackUserId) return ok(ephemeralText("couldn't tell which Slack workspace this came from."));
    if (!content) return ok(ephemeralText("that message didn't have text Mumbl could save."));

    const sourceMeta = {
      trigger: "message_shortcut",
      channel: cleanString(payload.channel?.id, 80),
      channel_name: cleanString(payload.channel?.name, 120),
      ts: cleanString(payload.message?.ts, 80),
    };

    const result = await saveOrConnect({ teamId, slackUserId, content, sourceMeta });
    if (payload.response_url) {
      await fetch(payload.response_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      });
      return ok({});
    }
    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}

async function saveOrConnect({ teamId, slackUserId, content, sourceMeta }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return ephemeralLink({ text: "saved to mumbl privately.", url: dumpUrl(dump.id), label: "open ->" });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return ephemeralLink({ text: "saved to mumbl privately.", url: dumpUrl(dump.id), label: "open ->" });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return ephemeralLink({
    text: "connect your mumbl account to save that privately.",
    url: slackConnectUrl(pending.id),
    label: "connect ->",
  });
}
