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
  getSlackFieldNoteDraft,
  getSlackUserEmail,
  openSlackLoadingModal,
  parseVerifiedSlackForm,
  publishSlackFieldNoteDraft,
  postSlackResponse,
  saveSlackDump,
  createSlackFieldNoteDraft,
  slackFieldNoteDraftPickerView,
  slackConnectPayload,
  slackConnectUrl,
  slackDumpModalView,
  slackDumpConnectModalView,
  slackDumpSavedModalView,
  slackFieldNoteEditModalView,
  slackFieldNoteDraftingModalView,
  slackFieldNoteDraftErrorModalView,
  slackFieldNotePublishedModalView,
  slackFieldNoteSavedModalView,
  slackFieldNoteReviewPickerView,
  slackSavedDumpPayload,
  slackLoadingModalView,
  slackPinnedSpacesView,
  slackPublishedReadsView,
  slackPublishOptionsView,
  slackPublishPreviewView,
  slackRoomModalView,
  slackUnpinPinnedSpaceConfirmView,
  openSlackDumpModal,
  openSlackRoomModal,
  publishSlackAppHome,
  updateSlackView,
  updateSlackFieldNoteDraft,
  unpinSlackPinnedSpace,
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
      try {
        if (actionId === "start_room_modal") {
          const teamId = slackTeamId(payload);
          const viewId = slackModalViewId(payload);
          if (viewId) {
            await updateSlackView({
              teamId,
              viewId,
              view: slackRoomModalView(),
            });
          } else {
            await openSlackRoomModal({
              teamId,
              triggerId: cleanString(payload.trigger_id, 200),
            });
          }
        }
        if (actionId === "new_private_dump") {
          const teamId = slackTeamId(payload);
          const viewId = slackModalViewId(payload);
          if (viewId) {
            await updateSlackView({ teamId, viewId, view: slackDumpModalView() });
          } else {
            await openSlackDumpModal({
              teamId,
              triggerId: cleanString(payload.trigger_id, 200),
            });
          }
        }
        if (actionId === "draft_team_read") {
          await showLoadingThenReplace({
            payload,
            title: "draft team read",
            message: "loading your recent private dumps...",
            buildView: ({ teamId, slackUserId }) => slackFieldNoteDraftPickerView({ teamId, slackUserId }),
            logLabel: "Slack draft picker update failed",
          });
        }
        if (actionId === "review_field_note_drafts") {
          await showLoadingThenReplace({
            payload,
            title: "review drafts",
            message: "loading your private drafts...",
            buildView: ({ teamId, slackUserId }) => slackFieldNoteReviewPickerView({ teamId, slackUserId }),
            logLabel: "Slack draft review update failed",
          });
        }
        if (actionId === "review_published_reads") {
          await showLoadingThenReplace({
            payload,
            title: "published reads",
            message: "loading your published reads...",
            buildView: ({ teamId, slackUserId }) => slackPublishedReadsView({ teamId, slackUserId }),
            logLabel: "Slack published reads update failed",
          });
        }
        if (actionId === "manage_pinned_spaces") {
          await showLoadingThenReplace({
            payload,
            title: "pinned spaces",
            message: "loading your pinned teamspaces...",
            buildView: ({ teamId, slackUserId }) => slackPinnedSpacesView({ teamId, slackUserId }),
            logLabel: "Slack pinned spaces update failed",
          });
        }
        if (actionId === "unpin_pinned_space_start") {
          const teamId = slackTeamId(payload);
          const slackUserId = cleanString(payload.user?.id, 80);
          const viewId = slackModalViewId(payload);
          if (viewId) {
            await updateSlackView({
              teamId,
              viewId,
              view: await slackUnpinPinnedSpaceConfirmView({
                teamId,
                slackUserId,
                pinId: cleanString(payload.actions?.[0]?.value, 64),
              }),
            });
          }
        }
        if (actionId === "publish_field_note_start") {
          const fieldNoteId = cleanString(payload.actions?.[0]?.value, 64);
          await showLoadingThenReplace({
            payload,
            title: "publish draft",
            message: "loading pinned spaces...",
            buildView: ({ teamId, slackUserId }) => slackPublishOptionsView({ teamId, slackUserId, fieldNoteId }),
            logLabel: "Slack publish options update failed",
          });
        }
      } catch (error) {
        console.error("Slack action failed", {
          actionId,
          message: error.message,
          slackError: error.slack?.error,
          slackResponse: error.slack,
        });
      }
      return ok({});
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "create_private_dump") {
      const teamId = slackTeamId(payload);
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

    if (payload.type === "view_submission" && payload.view?.callback_id === "draft_team_read") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const selectedDumpIds = selectedSlackOptionValues(payload.view?.state?.values?.draft_dump_ids?.value?.selected_options);
      if (!selectedDumpIds.length) {
        return ok({
          response_action: "errors",
          errors: { draft_dump_ids: "choose at least one dump." },
        });
      }

      after(async () => {
        try {
          const result = await createSlackFieldNoteDraft({ teamId, slackUserId, dumpIds: selectedDumpIds });
          await updateSlackView({
            teamId,
            viewId: cleanString(payload.view?.id, 120),
            view: slackFieldNoteEditModalView(result.fieldNote),
          });
        } catch (error) {
          await updateSlackView({
            teamId,
            viewId: cleanString(payload.view?.id, 120),
            view: slackFieldNoteDraftErrorModalView(error.message || "couldn't draft that field note yet."),
          });
        }
      });

      return ok({ response_action: "update", view: slackFieldNoteDraftingModalView() });
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "review_field_note_drafts") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const fieldNoteId = cleanString(payload.view?.state?.values?.field_note_id?.value?.selected_option?.value, 64);
      if (!fieldNoteId) {
        return ok({
          response_action: "errors",
          errors: { field_note_id: "choose a draft." },
        });
      }

      try {
        const fieldNote = await getSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId });
        return ok({ response_action: "update", view: slackFieldNoteEditModalView(fieldNote) });
      } catch (error) {
        return ok({
          response_action: "errors",
          errors: { field_note_id: error.message || "couldn't open that draft." },
        });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "edit_field_note_draft") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const fieldNoteId = cleanString(payload.view?.private_metadata, 64);
      const title = cleanString(payload.view?.state?.values?.field_note_title?.value?.value, 120);
      const content = cleanString(payload.view?.state?.values?.field_note_content?.value?.value, 4000);
      if (!title) {
        return ok({
          response_action: "errors",
          errors: { field_note_title: "title the draft first." },
        });
      }
      if (!content) {
        return ok({
          response_action: "errors",
          errors: { field_note_content: "write the field note first." },
        });
      }

      try {
        const result = await updateSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId, title, content });
        return ok({ response_action: "update", view: slackFieldNoteSavedModalView(result) });
      } catch (error) {
        return ok({
          response_action: "errors",
          errors: { field_note_content: error.message || "couldn't save that draft." },
        });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "publish_field_note_options") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const fieldNoteId = cleanString(payload.view?.private_metadata, 64);
      const spaceId = cleanString(payload.view?.state?.values?.publish_space?.value?.selected_option?.value, 64);
      const identity = cleanString(payload.view?.state?.values?.publish_identity?.value?.selected_option?.value, 24);
      const displayName = cleanString(payload.view?.state?.values?.publish_handle?.value?.value, 48);
      const isAnonymous = identity !== "handle";
      if (!spaceId) {
        return ok({
          response_action: "errors",
          errors: { publish_space: "choose a Mumbl space." },
        });
      }
      if (!isAnonymous && !displayName) {
        return ok({
          response_action: "errors",
          errors: { publish_handle: "add the handle to show, or choose anonymous." },
        });
      }

      try {
        const view = await slackPublishPreviewView({ teamId, slackUserId, fieldNoteId, spaceId, isAnonymous, displayName });
        return ok({ response_action: "update", view });
      } catch (error) {
        return ok({
          response_action: "errors",
          errors: { publish_space: error.message || "couldn't prepare that publish preview." },
        });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "publish_field_note_confirm") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const metadata = parseViewMetadata(payload.view?.private_metadata);
      try {
        const result = await publishSlackFieldNoteDraft({
          teamId,
          slackUserId,
          fieldNoteId: metadata.fieldNoteId,
          spaceId: metadata.spaceId,
          isAnonymous: metadata.isAnonymous !== false,
          displayName: metadata.displayName,
        });
        after(async () => {
          try {
            await publishSlackAppHome({ teamId, slackUserId });
          } catch (error) {
            console.error("Slack App Home refresh after publish failed", { message: error.message, slackError: error.slack?.error });
          }
        });
        return ok({ response_action: "update", view: slackFieldNotePublishedModalView(result) });
      } catch (error) {
        return ok({ response_action: "update", view: slackFieldNoteDraftErrorModalView(error.message || "couldn't publish that draft.") });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "unpin_pinned_space_confirm") {
      const teamId = slackTeamId(payload);
      const slackUserId = cleanString(payload.user?.id, 80);
      const metadata = parseViewMetadata(payload.view?.private_metadata);
      try {
        await unpinSlackPinnedSpace({ teamId, slackUserId, pinId: metadata.pinId });
        after(async () => {
          try {
            await publishSlackAppHome({ teamId, slackUserId });
          } catch (error) {
            console.error("Slack App Home refresh after unpin failed", { message: error.message, slackError: error.slack?.error });
          }
        });
        return ok({ response_action: "update", view: await slackPinnedSpacesView({ teamId, slackUserId }) });
      } catch (error) {
        return ok({ response_action: "update", view: slackFieldNoteDraftErrorModalView(error.message || "couldn't unpin that space.") });
      }
    }

    if (payload.type === "view_submission" && payload.view?.callback_id === "create_mumbl_room") {
      const teamId = slackTeamId(payload);
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
        after(async () => {
          try {
            await publishSlackAppHome({ teamId, slackUserId });
          } catch (error) {
            console.error("Slack App Home refresh after room creation failed", { message: error.message, slackError: error.slack?.error });
          }
        });
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

function slackTeamId(payload) {
  return cleanString(payload.team?.id || payload.user?.team_id, 80);
}

function slackModalViewId(payload) {
  return payload.view?.type === "modal" ? cleanString(payload.view?.id, 120) : "";
}

async function showLoadingThenReplace({ payload, title, message, buildView, logLabel }) {
  const teamId = slackTeamId(payload);
  const slackUserId = cleanString(payload.user?.id, 80);
  let viewId = slackModalViewId(payload);

  if (viewId) {
    await updateSlackView({
      teamId,
      viewId,
      view: slackLoadingModalView({ title, message }),
    });
  } else {
    const result = await openSlackLoadingModal({
      teamId,
      triggerId: cleanString(payload.trigger_id, 200),
      title,
      message,
    });
    viewId = cleanString(result.view?.id, 120);
  }

  try {
    await updateSlackView({
      teamId,
      viewId,
      view: await buildView({ teamId, slackUserId }),
    });
  } catch (error) {
    console.error(logLabel, { message: error.message, slackError: error.slack?.error, slackResponse: error.slack });
    if (viewId) {
      try {
        await updateSlackView({
          teamId,
          viewId,
          view: slackFieldNoteDraftErrorModalView(error.message || "Slack could not load that view yet."),
        });
      } catch (updateError) {
        console.error("Slack error modal update failed", { message: updateError.message, slackError: updateError.slack?.error });
      }
    }
  }
}

function selectedSlackOptionValues(options) {
  return Array.isArray(options) ? options.map((option) => cleanString(option?.value, 64)).filter(Boolean) : [];
}

function parseViewMetadata(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
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
