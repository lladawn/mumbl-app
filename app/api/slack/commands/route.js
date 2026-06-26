import { after } from "next/server";
import { ok, serverError } from "../../../../src/server/http";
import {
  connectSlackUser,
  createPendingSlackDump,
  createSlackStartedSpacePayload,
  dumpUrl,
  ephemeralText,
  findMumblUserByEmail,
  findSlackConnection,
  getSlackUserEmail,
  parseVerifiedSlackForm,
  pinSlackSpaceBySlug,
  postSlackResponse,
  publishSlackAppHome,
  saveSlackDump,
  slackConnectPayload,
  slackConnectUrl,
  slackHelpPayload,
  slackSavedDumpPayload,
  openSlackRoomModal,
} from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const form = await parseVerifiedSlackForm(request);
    const teamId = cleanString(form.get("team_id"), 80);
    const slackUserId = cleanString(form.get("user_id"), 80);
    const text = cleanString(form.get("text"), 4000);
    const responseUrl = cleanString(form.get("response_url"), 2000);
    const triggerId = cleanString(form.get("trigger_id"), 200);
    const roomName = parseRoomCommand(text);
    const pinSlug = parsePinCommand(text);

    if (!teamId || !slackUserId) return ok(ephemeralText("couldn't tell which Slack workspace this came from."));
    if (!text || text.toLowerCase() === "help") return ok(slackHelpPayload());
    if (pinSlug !== null && !pinSlug) return ok(ephemeralText("try `/mumbl pin` followed by the room invite link."));
    if (roomName !== null && !roomName) {
      after(async () => {
        try {
          await openSlackRoomModal({ teamId, triggerId });
        } catch (error) {
          await postSlackResponse(responseUrl, ephemeralText(error.message || "couldn't open room setup."));
        }
      });
      return new Response(null, { status: 200 });
    }

    after(async () => {
      try {
        const result =
          roomName !== null
            ? await startRoomFromSlack({ teamId, slackUserId, name: roomName })
            : pinSlug !== null
              ? await pinSpaceFromSlack({ teamId, slackUserId, slug: pinSlug })
            : await saveOrConnect({ teamId, slackUserId, content: text, sourceMeta: { trigger: "slash_command" } });
        await postSlackResponse(responseUrl, result);
        if (roomName !== null || pinSlug !== null) {
          try {
            await publishSlackAppHome({ teamId, slackUserId });
          } catch (error) {
            console.error("Slack App Home refresh after command failed", { message: error.message, slackError: error.slack?.error });
          }
        }
      } catch (error) {
        await postSlackResponse(responseUrl, ephemeralText(error.message || "couldn't finish that Mumbl action yet."));
      }
    });

    return new Response(null, { status: 200 });
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

function parsePinCommand(text) {
  const trimmed = cleanString(text, 4000);
  const lower = trimmed.toLowerCase();
  if (lower === "pin") return "";
  if (lower.startsWith("pin ")) return cleanString(trimmed.slice(4), 2000);
  return null;
}

async function startRoomFromSlack({ teamId, slackUserId, name }) {
  return createSlackStartedSpacePayload({ teamId, slackUserId, name });
}

async function pinSpaceFromSlack({ teamId, slackUserId, slug }) {
  const { space, channelJoin, alreadyPinned } = await pinSlackSpaceBySlug({ teamId, slackUserId, slug });
  const channelText = channelJoin?.joined
    ? ` You're also in the ${channelJoin.channelName ? `#${channelJoin.channelName}` : "Slack reads"} channel.`
    : "";
  return ephemeralText(`${space.name} ${alreadyPinned ? "was already pinned" : "is pinned"} for team reads.${channelText}`);
}

async function saveOrConnect({ teamId, slackUserId, content, sourceMeta }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id), compact: true });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id), compact: true });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return slackConnectPayload({ url: slackConnectUrl(pending.id) });
}
