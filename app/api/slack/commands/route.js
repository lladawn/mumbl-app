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
    const joinSlug = parseJoinCommand(text);

    if (!teamId || !slackUserId) return ok(ephemeralText("couldn't tell which Slack workspace this came from."));
    if (!text || text.toLowerCase() === "help") return ok(slackHelpPayload());
    if (pinSlug !== null && !pinSlug) return ok(ephemeralText("try `/mumbl pin` followed by the room invite link."));
    if (joinSlug !== null && !joinSlug) return ok(ephemeralText("try `/mumbl join` followed by the room invite link your teammate shared."));
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
            : joinSlug !== null
              ? await joinSpaceFromSlack({ teamId, slackUserId, slug: joinSlug })
            : await saveOrConnect({ teamId, slackUserId, content: text, sourceMeta: { trigger: "slash_command" } });
        await postSlackResponse(responseUrl, result);
        if (roomName !== null || pinSlug !== null || joinSlug !== null) {
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

function parseJoinCommand(text) {
  const trimmed = cleanString(text, 4000);
  const lower = trimmed.toLowerCase();
  if (lower === "join") return "";
  if (lower.startsWith("join ")) return cleanString(trimmed.slice(5), 2000);
  return null;
}

// Accept the `<room-name> <key>` two-token form (what we tell teams to share) and
// normalize it into the slug-or-URL string findSpaceForSlackPin already understands.
// A pasted full invite URL still works for backwards compatibility.
function joinArgsToLookup(args) {
  const raw = cleanString(args, 2000) || "";
  if (/\/r\/|https?:/i.test(raw)) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  const slug = parts[0] || "";
  const key = parts[1] || "";
  if (!slug) return "";
  // Slack may wrap a pasted slug in <...>; strip stray angle brackets.
  const cleanSlug = slug.replace(/[<>]/g, "");
  return key ? `/r/${cleanSlug}?key=${key}` : cleanSlug;
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

async function joinSpaceFromSlack({ teamId, slackUserId, slug }) {
  const lookup = joinArgsToLookup(slug);
  const { space, channelJoin } = await pinSlackSpaceBySlug({ teamId, slackUserId, slug: lookup });
  const channel = channelJoin?.channelName ? `#${channelJoin.channelName}` : "the team reads channel";
  return channelJoin?.joined
    ? ephemeralText(`you're in 🎉 — ${space.name} reads will land in ${channel}, and the room is pinned in your mumbl App Home.`)
    : ephemeralText(`pinned ${space.name} for you. ask whoever set up the room to add you to ${channel} if you don't see it yet.`);
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
