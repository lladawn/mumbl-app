import { after } from "next/server";
import { ok, serverError } from "../../../../src/server/http";
import {
  connectSlackUser,
  createPendingSlackDump,
  createSlackStartedSpace,
  dumpUrl,
  ephemeralText,
  findMumblUserByEmail,
  findSlackConnection,
  getSlackUserEmail,
  parseVerifiedSlackForm,
  postSlackResponse,
  saveSlackDump,
  slackConnectPayload,
  slackConnectUrl,
  slackHelpPayload,
  slackRoomCreatedPayload,
  slackSavedDumpPayload,
  slackSavingPayload,
  slackRoomNeedsNamePayload,
} from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const form = await parseVerifiedSlackForm(request);
    const teamId = cleanString(form.get("team_id"), 80);
    const slackUserId = cleanString(form.get("user_id"), 80);
    const text = cleanString(form.get("text"), 4000);
    const responseUrl = cleanString(form.get("response_url"), 2000);
    const roomName = parseRoomCommand(text);

    if (!teamId || !slackUserId) return ok(ephemeralText("couldn't tell which Slack workspace this came from."));
    if (!text || text.toLowerCase() === "help") return ok(slackHelpPayload());
    if (roomName !== null && !roomName) return ok(slackRoomNeedsNamePayload());

    after(async () => {
      try {
        const result =
          roomName !== null
            ? await startRoomFromSlack({ teamId, slackUserId, name: roomName })
            : await saveOrConnect({ teamId, slackUserId, content: text, sourceMeta: { trigger: "slash_command" } });
        await postSlackResponse(responseUrl, result);
      } catch (error) {
        await postSlackResponse(responseUrl, ephemeralText(error.message || "couldn't save that to mumbl yet."));
      }
    });

    return ok(roomName !== null ? ephemeralText("creating a mumbl room...") : slackSavingPayload());
  } catch (error) {
    return serverError(error);
  }
}

function parseRoomCommand(text) {
  const trimmed = cleanString(text, 4000);
  const lower = trimmed.toLowerCase();
  if (lower === "room" || lower === "start") return "";
  if (lower.startsWith("room ")) return cleanString(trimmed.slice(5), 80);
  if (lower.startsWith("start ")) return cleanString(trimmed.slice(6), 80);
  return null;
}

async function startRoomFromSlack({ teamId, slackUserId, name }) {
  const result = await createSlackStartedSpace({ teamId, slackUserId, name });
  return slackRoomCreatedPayload(result);
}

async function saveOrConnect({ teamId, slackUserId, content, sourceMeta }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id) });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id) });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return slackConnectPayload({ url: slackConnectUrl(pending.id) });
}
