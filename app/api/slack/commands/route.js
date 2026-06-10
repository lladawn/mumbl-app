import { after } from "next/server";
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
  postSlackResponse,
  saveSlackDump,
  slackConnectUrl,
} from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const form = await parseVerifiedSlackForm(request);
    const teamId = cleanString(form.get("team_id"), 80);
    const slackUserId = cleanString(form.get("user_id"), 80);
    const text = cleanString(form.get("text"), 4000);
    const responseUrl = cleanString(form.get("response_url"), 2000);

    if (!teamId || !slackUserId) return ok(ephemeralText("couldn't tell which Slack workspace this came from."));
    if (!text) return ok(ephemeralText("drop a thought after `/mumbl`, like `/mumbl deployment felt cursed today`."));

    after(async () => {
      try {
        const result = await saveOrConnect({ teamId, slackUserId, content: text, sourceMeta: { trigger: "slash_command" } });
        await postSlackResponse(responseUrl, result);
      } catch (error) {
        await postSlackResponse(responseUrl, ephemeralText(error.message || "couldn't save that to mumbl yet."));
      }
    });

    return ok(ephemeralText("saving to mumbl..."));
  } catch (error) {
    return serverError(error);
  }
}

async function saveOrConnect({ teamId, slackUserId, content, sourceMeta }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return ephemeralLink({ text: "saved. only you can see this.", url: dumpUrl(dump.id), label: "open in mumbl ->" });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return ephemeralLink({ text: "saved. only you can see this.", url: dumpUrl(dump.id), label: "open in mumbl ->" });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return ephemeralLink({
    text: "connect your mumbl account to start saving thoughts from Slack.",
    url: slackConnectUrl(pending.id),
    label: "connect ->",
  });
}
