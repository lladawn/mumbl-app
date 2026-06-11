import { after } from "next/server";
import { ok, serverError } from "../../../../src/server/http";
import {
  connectSlackUser,
  createPendingSlackDump,
  createSlackStartedSpaceModalView,
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
  slackDumpConnectModalView,
  slackDumpSavedModalView,
  slackSavedDumpPayload,
  openSlackDumpModal,
  openSlackRoomModal,
} from "../../../../src/server/slack";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const form = await parseVerifiedSlackForm(request);
    const payloadText = form.get("payload");
    if (!payloadText) return ok(ephemeralText("Slack did not send a shortcut payload."));

    const payload = JSON.parse(payloadText);
    if (payload.type === "block_actions") {
      const actionId = cleanString(payload.actions?.[0]?.action_id, 80);
      if (actionId === "start_room_modal") {
        await openSlackRoomModal({
          teamId: cleanString(payload.team?.id, 80),
          triggerId: cleanString(payload.trigger_id, 200),
        });
      }
      if (actionId === "new_private_dump") {
        await openSlackDumpModal({
          teamId: cleanString(payload.team?.id, 80),
          triggerId: cleanString(payload.trigger_id, 200),
        });
      }
      return ok({});
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "create_private_dump") {
      const teamId = cleanString(payload.team?.id, 80);
      const slackUserId = cleanString(payload.user?.id, 80);
      const content = cleanString(payload.view?.state?.values?.dump_content?.value?.value, 4000);
      if (!content) {
        return ok({
          response_action: "errors",
          errors: { dump_content: "write the thought first." },
        });
      }

      try {
        const view = await saveModalDump({ teamId, slackUserId, content });
        return ok({ response_action: "update", view });
      } catch (error) {
        return ok({
          response_action: "errors",
          errors: { dump_content: error.message || "couldn't save that to mumbl yet." },
        });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "create_mumbl_room") {
      const teamId = cleanString(payload.team?.id, 80);
      const slackUserId = cleanString(payload.user?.id, 80);
      const roomName = cleanString(payload.view?.state?.values?.room_name?.value?.value, 80);
      if (!roomName) {
        return ok({
          response_action: "errors",
          errors: { room_name: "name the room first." },
        });
      }

      try {
        const view = await createSlackStartedSpaceModalView({ teamId, slackUserId, name: roomName });
        return ok({ response_action: "update", view });
      } catch (error) {
        return ok({
          response_action: "errors",
          errors: { room_name: error.message || "couldn't create that room yet." },
        });
      }
    }

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

    after(async () => {
      try {
        const result = await saveOrConnect({ teamId, slackUserId, content, sourceMeta });
        await postSlackResponse(payload.response_url, result);
      } catch (error) {
        await postSlackResponse(payload.response_url, ephemeralText(error.message || "couldn't save that to mumbl yet."));
      }
    });

    return ok({});
  } catch (error) {
    return serverError(error);
  }
}

async function saveModalDump({ teamId, slackUserId, content }) {
  const sourceMeta = { trigger: "app_home_modal" };
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return slackDumpSavedModalView({ url: dumpUrl(dump.id) });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return slackDumpSavedModalView({ url: dumpUrl(dump.id) });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return slackDumpConnectModalView({ url: slackConnectUrl(pending.id) });
}

async function saveOrConnect({ teamId, slackUserId, content, sourceMeta }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) {
    const dump = await saveSlackDump({ connection: existingConnection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id), shortcut: true });
  }

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (mumblUserId) {
    const connection = await connectSlackUser({ teamId, slackUserId, mumblUserId });
    const dump = await saveSlackDump({ connection, content, sourceMeta });
    return slackSavedDumpPayload({ url: dumpUrl(dump.id), shortcut: true });
  }

  const pending = await createPendingSlackDump({ teamId, slackUserId, content, sourceMeta });
  return slackConnectPayload({ url: slackConnectUrl(pending.id), shortcut: true });
}
