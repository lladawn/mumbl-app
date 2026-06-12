import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { assertSlackEnv, getServerEnv } from "./env";
import { processSavedPrivateDump } from "./dumpPatterns";
import { draftFieldNote } from "./fieldNotes";
import { createToken, hashToken } from "./hash";
import { enforceRateLimit } from "./rateLimit";
import { getSupabaseAdmin } from "./supabase";
import { cleanString, slugify } from "./validation";

const SLACK_OAUTH_SCOPES = ["commands", "users:read", "users:read.email", "im:write", "chat:write"];
const SLACK_TEAM_READS_SCOPES = ["groups:write", "groups:read"];
const TOKEN_ALGORITHM = "aes-256-gcm";
const MAX_SLACK_AGE_SECONDS = 60 * 5;
const MAX_SLACK_DRAFT_DUMPS = 10;

export function slackInstallUrl() {
  const { appUrl, slackClientId } = assertSlackEnv();
  const params = new URLSearchParams({
    client_id: slackClientId,
    scope: SLACK_OAUTH_SCOPES.join(","),
    redirect_uri: `${appUrl}/api/slack/oauth/callback`,
    state: createSlackState(),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export function slackTeamReadsInstallUrl({ setupId, setupToken }) {
  const { appUrl, slackClientId } = assertSlackEnv();
  const params = new URLSearchParams({
    client_id: slackClientId,
    scope: [...SLACK_OAUTH_SCOPES, ...SLACK_TEAM_READS_SCOPES].join(","),
    redirect_uri: `${appUrl}/api/slack/team-reads/oauth/callback`,
    state: createSlackState({ setupId, setupToken }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code) {
  const { appUrl, slackClientId, slackClientSecret } = assertSlackEnv();
  const body = new URLSearchParams({
    client_id: slackClientId,
    client_secret: slackClientSecret,
    code,
    redirect_uri: `${appUrl}/api/slack/oauth/callback`,
  });
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Slack OAuth failed.");
  }
  return result;
}

export async function exchangeSlackTeamReadsCode(code) {
  const { appUrl, slackClientId, slackClientSecret } = assertSlackEnv();
  const body = new URLSearchParams({
    client_id: slackClientId,
    client_secret: slackClientSecret,
    code,
    redirect_uri: `${appUrl}/api/slack/team-reads/oauth/callback`,
  });
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Slack team reads OAuth failed.");
  }
  return result;
}

export async function storeSlackInstallation(oauthResult) {
  const teamId = cleanString(oauthResult.team?.id, 80);
  const accessToken = cleanString(oauthResult.access_token, 4096);
  if (!teamId || !accessToken) throw new Error("Slack OAuth response was missing workspace access.");

  const supabase = getSupabaseAdmin();
  const { data: current } = await supabase
    .from("slack_installations")
    .select("scopes")
    .eq("slack_team_id", teamId)
    .maybeSingle();
  const nextScopes = mergeScopes(current?.scopes, oauthResult.scope);
  const encryptedToken = encryptSlackToken(accessToken);
  const { error } = await supabase.from("slack_installations").upsert(
    {
      slack_team_id: teamId,
      slack_team_name: cleanString(oauthResult.team?.name, 120),
      bot_user_id: cleanString(oauthResult.bot_user_id, 80),
      bot_access_token_ciphertext: encryptedToken.ciphertext,
      bot_access_token_iv: encryptedToken.iv,
      bot_access_token_tag: encryptedToken.tag,
      scopes: nextScopes,
      beta_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slack_team_id" },
  );
  if (error) throw error;
}

export async function parseVerifiedSlackForm(request) {
  const rawBody = await request.text();
  verifySlackRequest(request, rawBody);
  return new URLSearchParams(rawBody);
}

export async function parseVerifiedSlackJson(request) {
  const rawBody = await request.text();
  verifySlackRequest(request, rawBody);
  return rawBody ? JSON.parse(rawBody) : {};
}

export function verifySlackRequest(request, rawBody) {
  const { slackSigningSecret } = assertSlackEnv();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!timestamp || !signature || !Number.isFinite(ageSeconds) || ageSeconds > MAX_SLACK_AGE_SECONDS) {
    const error = new Error("Slack request could not be verified.");
    error.status = 401;
    throw error;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", slackSigningSecret).update(baseString).digest("hex")}`;
  if (!safeEqual(signature, expected)) {
    const error = new Error("Slack request could not be verified.");
    error.status = 401;
    throw error;
  }
}

export async function getSlackInstallation(teamId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("slack_installations").select("*").eq("slack_team_id", teamId).single();
  if (error) throw error;
  return data;
}

export async function createTeamReadsSetup({ spaceId }) {
  const setupToken = createToken();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_team_read_setups")
    .insert({
      space_id: spaceId,
      setup_token_hash: hashToken(setupToken),
    })
    .select("id")
    .single();
  if (error) throw error;

  return { setupId: data.id, setupToken };
}

export async function consumeTeamReadsSetup({ setupId, setupToken }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: setup, error } = await supabase
    .from("slack_team_read_setups")
    .select("*, spaces(id, slug, name)")
    .eq("id", setupId)
    .eq("setup_token_hash", hashToken(setupToken))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .single();
  if (error) throw error;

  const { error: updateError } = await supabase.from("slack_team_read_setups").update({ consumed_at: now }).eq("id", setup.id);
  if (updateError) throw updateError;
  return setup;
}

export async function createSlackSpaceChannel({ oauthResult, setup }) {
  const teamId = cleanString(oauthResult.team?.id, 80);
  const accessToken = cleanString(oauthResult.access_token, 4096);
  if (!teamId || !accessToken) throw new Error("Slack team reads install was missing workspace access.");

  const channel = await createPrivateChannel({
    token: accessToken,
    name: channelNameForSpace(setup.spaces),
  });
  const createdBy = cleanString(oauthResult.authed_user?.id, 80);
  if (createdBy) {
    await inviteUserToSlackChannel({ token: accessToken, channelId: channel.id, slackUserId: createdBy });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_space_channels")
    .upsert(
      {
        space_id: setup.space_id,
        slack_team_id: teamId,
        slack_channel_id: channel.id,
        slack_channel_name: channel.name,
        posting_enabled: true,
        is_private: true,
        created_by_slack_user_id: createdBy || null,
        last_post_error: null,
        last_post_error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  if (createdBy) {
    const connection = await findSlackConnectionForAutoPin({ teamId, slackUserId: createdBy });
    if (connection) await pinSlackSpace({ connection, spaceId: setup.space_id });
  }
  await postSlackChannelIntro({ token: accessToken, channel: data, space: setup.spaces });
  return data;
}

export async function createSlackStartedSpace({ teamId, slackUserId, name }) {
  const supabase = getSupabaseAdmin();
  const connection = await findSlackConnectionForAutoPin({ teamId, slackUserId });
  const creatorToken = createToken();
  const cleanName = cleanString(name, 80).toLowerCase();
  const baseSlug = slugify(cleanName) || "team-mumbl";
  let slug = baseSlug;
  let insertedSpace;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("spaces")
      .insert({
        slug,
        name: cleanName,
        vibe: "chill",
        creator_token_hash: hashToken(creatorToken),
        ...(connection?.mumbl_user_id ? { creator_user_id: connection.mumbl_user_id } : {}),
      })
      .select("*")
      .single();

    if (!error) {
      insertedSpace = data;
      break;
    }

    if (error.code !== "23505") throw error;
    slug = `${baseSlug}-${attempt + 2}`;
  }

  if (!insertedSpace) throw new Error("could not create a unique mumbl room");

  await supabase.from("slack_started_spaces").insert({
    space_id: insertedSpace.id,
    slack_team_id: teamId,
    created_by_slack_user_id: slackUserId,
  });
  if (connection) {
    await pinSlackSpace({ connection, spaceId: insertedSpace.id });
  }

  const handoff = await createCreatorHandoff({ spaceId: insertedSpace.id, creatorToken });
  const teamReadsSetup = await createTeamReadsSetup({ spaceId: insertedSpace.id });
  return {
    space: insertedSpace,
    creatorToken,
    creatorLinked: Boolean(connection?.mumbl_user_id),
    pinned: Boolean(connection),
    openUrl: slackSpaceHandoffUrl(handoff),
    roomUrl: `${getServerEnv().appUrl}/r/${insertedSpace.slug}/reads`,
    teamReadsUrl: slackTeamReadsInstallUrl(teamReadsSetup),
  };
}

export async function createSlackStartedSpacePayload({ teamId, slackUserId, name }) {
  const result = await createSlackStartedSpace({ teamId, slackUserId, name });
  return slackRoomCreatedPayload(result);
}

export async function createSlackStartedSpaceModalView({ teamId, slackUserId, name }) {
  const result = await createSlackStartedSpace({ teamId, slackUserId, name });
  return slackRoomCreatedModalView(result);
}

export async function createCreatorHandoff({ spaceId, creatorToken }) {
  const handoffToken = createToken();
  const encrypted = encryptSlackSecret(creatorToken);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_space_handoffs")
    .insert({
      space_id: spaceId,
      creator_token_hash: hashToken(creatorToken),
      creator_token_ciphertext: encrypted.ciphertext,
      creator_token_iv: encrypted.iv,
      creator_token_tag: encrypted.tag,
      handoff_token_hash: hashToken(handoffToken),
    })
    .select("id")
    .single();
  if (error) throw error;

  return { handoffId: data.id, handoffToken };
}

export async function consumeCreatorHandoff({ handoffId, handoffToken, mumblUserId = "" }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: handoff, error } = await supabase
    .from("slack_space_handoffs")
    .select("*, spaces(slug, name)")
    .eq("id", handoffId)
    .eq("handoff_token_hash", hashToken(handoffToken))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .single();
  if (error) throw error;

  const creatorToken = decryptSlackSecret({
    ciphertext: handoff.creator_token_ciphertext,
    iv: handoff.creator_token_iv,
    tag: handoff.creator_token_tag,
  });
  const { error: updateError } = await supabase.from("slack_space_handoffs").update({ consumed_at: now }).eq("id", handoff.id);
  if (updateError) throw updateError;

  const cleanedMumblUserId = cleanString(mumblUserId, 80);
  if (cleanedMumblUserId) {
    const { error: claimError } = await supabase
      .from("spaces")
      .update({ creator_user_id: cleanedMumblUserId })
      .eq("id", handoff.space_id)
      .is("creator_user_id", null);
    if (claimError) throw claimError;
  }

  return {
    slug: handoff.spaces.slug,
    name: handoff.spaces.name,
    creatorToken,
    creatorLinked: Boolean(cleanedMumblUserId),
  };
}

export async function findSlackSpaceChannel(spaceId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("slack_space_channels").select("*").eq("space_id", spaceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSlackSpacePosting({ spaceId, postingEnabled }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_space_channels")
    .update({ posting_enabled: postingEnabled, updated_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function postTeamReadToSlack({ space, post }) {
  const channel = await findSlackSpaceChannel(space.id);
  if (!channel?.posting_enabled) return { posted: false, reason: "not_enabled" };

  const installation = await getSlackInstallation(channel.slack_team_id);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  const payload = teamReadMessage({ space, post, channel });
  const result = await slackApi("chat.postMessage", token, payload);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("slack_space_channels")
    .update({
      last_posted_at: new Date().toISOString(),
      last_post_error: null,
      last_post_error_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channel.id);
  if (error) throw error;
  return { posted: true, result };
}

export async function recordSlackTeamReadFailure({ spaceId, error }) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("slack_space_channels")
    .update({
      last_post_error: cleanString(error?.message || "couldn't post to Slack", 500),
      last_post_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("space_id", spaceId);
}

export async function publishSlackAppHome({ teamId, slackUserId }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });
  const blocks = await slackAppHomeBlocks({ teamId, slackUserId });

  return slackApi("views.publish", token, {
    user_id: slackUserId,
    view: {
      type: "home",
      callback_id: "mumbl_home",
      blocks,
    },
  });
}

export async function sendSlackPatternNotification({ teamId, slackUserId, patternId }) {
  let installation;
  try {
    installation = await getSlackInstallation(teamId);
  } catch (error) {
    if (isMissingSlackInstallationError(error)) {
      console.warn("Slack pattern notification skipped: no installation for workspace", { teamId });
      return { notified: false, reason: "missing_installation" };
    }
    throw error;
  }

  const missingScopes = missingSlackScopes(installation.scopes, ["im:write", "chat:write"]);
  if (missingScopes.length) {
    console.warn("Slack pattern notification skipped: installation is missing scopes", {
      teamId,
      missingScopes,
      provided: installation.scopes || [],
    });
    return { notified: false, reason: "missing_scope", needed: missingScopes.join(",") };
  }

  let token;
  try {
    token = decryptSlackToken({
      ciphertext: installation.bot_access_token_ciphertext,
      iv: installation.bot_access_token_iv,
      tag: installation.bot_access_token_tag,
    });
  } catch (error) {
    console.warn("Slack pattern notification skipped: installation token could not be decrypted", {
      teamId,
      message: error.message,
    });
    return { notified: false, reason: "token_decrypt_failed" };
  }

  const { appUrl } = getServerEnv();
  let dm;
  try {
    dm = await slackApi("conversations.open", token, { users: slackUserId });
    await slackApi("chat.postMessage", token, {
      channel: dm.channel.id,
      text: "Mumbl noticed a private work pattern. Open Mumbl to read it.",
      blocks: [
        section("*mumbl noticed a private pattern*\nOpen Mumbl to read it. Slack only gets this pointer, not the pattern itself."),
        actions([{ text: "view private pattern", url: `${appUrl}/patterns?pattern=${encodeURIComponent(patternId)}` }]),
        context("Only your logged-in Mumbl account can read the insight."),
      ],
    });
  } catch (error) {
    if (error.slack?.error === "missing_scope") {
      console.warn("Slack pattern notification skipped: missing Slack scope", {
        teamId,
        needed: error.slack?.needed,
        provided: error.slack?.provided,
      });
      return { notified: false, reason: "missing_scope", needed: error.slack?.needed };
    }
    throw error;
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from("patterns")
    .update({ delivered_slack: true, delivered_at: new Date().toISOString() })
    .eq("id", patternId);
  return { notified: true, channelId: dm.channel.id };
}

export async function openSlackRoomModal({ teamId, triggerId, initialName = "" }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  return slackApi("views.open", token, {
    trigger_id: triggerId,
    view: slackRoomModal({ initialName }),
  });
}

export async function openSlackDumpModal({ teamId, triggerId }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  return slackApi("views.open", token, {
    trigger_id: triggerId,
    view: slackDumpModal(),
  });
}

export async function openSlackFieldNoteDraftModal({ teamId, slackUserId, triggerId }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  let view;
  try {
    const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
    const dumps = await recentSlackPrivateDumps(connection);
    view = dumps.length ? slackFieldNoteDraftModal({ dumps }) : slackFieldNoteNoDumpsModal();
  } catch (error) {
    view = slackFieldNoteDraftUnavailableModal(error.message || "save a private dump first, then come back here.");
  }

  return slackApi("views.open", token, {
    trigger_id: triggerId,
    view,
  });
}

export async function openSlackLoadingModal({ teamId, triggerId, title = "loading", message = "opening mumbl..." }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  return slackApi("views.open", token, {
    trigger_id: triggerId,
    view: slackLoadingModal({ title, message }),
  });
}

export function slackLoadingModalView({ title = "loading", message = "opening mumbl..." } = {}) {
  return slackLoadingModal({ title, message });
}

export function slackRoomModalView({ initialName = "" } = {}) {
  return slackRoomModal({ initialName });
}

export function slackDumpModalView() {
  return slackDumpModal();
}

export async function slackFieldNoteDraftPickerView({ teamId, slackUserId }) {
  try {
    const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
    const dumps = await recentSlackPrivateDumps(connection);
    return dumps.length ? slackFieldNoteDraftModal({ dumps }) : slackFieldNoteNoDumpsModal();
  } catch (error) {
    return slackFieldNoteDraftUnavailableModal(error.message || "save a private dump first, then come back here.");
  }
}

export async function slackFieldNoteReviewPickerView({ teamId, slackUserId }) {
  try {
    const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
    const fieldNotes = await recentSlackFieldNoteDrafts(connection);
    return fieldNotes.length ? slackFieldNoteReviewModal({ fieldNotes }) : slackNoFieldNoteDraftsModal();
  } catch (error) {
    return slackFieldNoteDraftUnavailableModal(error.message || "connect mumbl first.");
  }
}

export async function slackPublishedReadsView({ teamId, slackUserId }) {
  try {
    const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
    const fieldNotes = await recentSlackPublishedFieldNotes(connection);
    return fieldNotes.length ? slackPublishedReadsModal({ fieldNotes }) : slackNoPublishedReadsModal();
  } catch (error) {
    return slackFieldNoteDraftUnavailableModal(error.message || "connect mumbl first.");
  }
}

export async function slackPinnedSpacesView({ teamId, slackUserId }) {
  const connection = await findSlackConnection({ teamId, slackUserId });
  if (!connection) return slackPinnedSpacesEmptyModal({ connected: false });
  const pinnedSpaces = await listSlackPinnedSpaces(connection);
  return pinnedSpaces.length ? await slackPinnedSpacesModal({ pinnedSpaces }) : slackPinnedSpacesEmptyModal({ connected: true });
}

export async function openSlackFieldNoteReviewModal({ teamId, slackUserId, triggerId }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  let view;
  try {
    const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
    const fieldNotes = await recentSlackFieldNoteDrafts(connection);
    view = fieldNotes.length ? slackFieldNoteReviewModal({ fieldNotes }) : slackNoFieldNoteDraftsModal();
  } catch (error) {
    view = slackFieldNoteDraftUnavailableModal(error.message || "connect mumbl first.");
  }

  return slackApi("views.open", token, {
    trigger_id: triggerId,
    view,
  });
}

export async function updateSlackView({ teamId, viewId, view }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });

  return slackApi("views.update", token, {
    view_id: viewId,
    view,
  });
}

export async function getSlackUserEmail({ teamId, slackUserId }) {
  const installation = await getSlackInstallation(teamId);
  const token = decryptSlackToken({
    ciphertext: installation.bot_access_token_ciphertext,
    iv: installation.bot_access_token_iv,
    tag: installation.bot_access_token_tag,
  });
  const response = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "couldn't read Slack user profile.");
  }
  return cleanString(result.user?.profile?.email, 320).toLowerCase();
}

export async function findMumblUserByEmail(email) {
  if (!email) return "";
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("mumbl_auth_user_id_by_email", { p_email: email });
  if (error) throw error;
  return cleanString(data, 80);
}

export async function findSlackConnection({ teamId, slackUserId }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_connections")
    .select("*")
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findOrCreateSlackConnectionByEmail({ teamId, slackUserId }) {
  const existingConnection = await findSlackConnection({ teamId, slackUserId });
  if (existingConnection) return existingConnection;

  const email = await getSlackUserEmail({ teamId, slackUserId });
  const mumblUserId = await findMumblUserByEmail(email);
  if (!mumblUserId) {
    throw new Error("connect mumbl once by saving a private dump from Slack first.");
  }
  return connectSlackUser({ teamId, slackUserId, mumblUserId });
}

async function findSlackConnectionForAutoPin({ teamId, slackUserId }) {
  try {
    return await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  } catch {
    return null;
  }
}

export async function connectSlackUser({ teamId, slackUserId, mumblUserId }) {
  const supabase = getSupabaseAdmin();
  const sessionTokenHash = hashToken(`slack:${teamId}:${slackUserId}`);
  const { data, error } = await supabase
    .from("slack_connections")
    .upsert(
      {
        slack_team_id: teamId,
        slack_user_id: slackUserId,
        mumbl_user_id: mumblUserId,
        slack_session_token_hash: sessionTokenHash,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "slack_team_id,slack_user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  await reconcileSlackStartedSpacesForConnection(data);
  return data;
}

export async function saveSlackDump({ connection, content, sourceMeta = {} }) {
  const supabase = getSupabaseAdmin();
  const cleanedContent = cleanString(content, 4000);
  if (!cleanedContent) throw new Error("dump content is required.");

  const { data: dump, error } = await supabase
    .from("dumps")
    .insert({
      user_id: connection.mumbl_user_id,
      session_token_hash: connection.slack_session_token_hash,
      content: cleanedContent,
      visibility: "private",
      source: "slack",
      source_meta: sourceMeta,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  if (connection.mumbl_user_id) {
    after(async () => {
      await processSavedPrivateDump({
        supabase,
        dumpId: dump.id,
        userId: connection.mumbl_user_id,
        content: cleanedContent,
        source: "slack",
      });
    });
  }

  await supabase
    .from("slack_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", connection.id);

  return dump;
}

export async function createPendingSlackDump({ teamId, slackUserId, content, sourceMeta = {} }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_pending_dumps")
    .insert({
      slack_team_id: teamId,
      slack_user_id: slackUserId,
      content: cleanString(content, 4000),
      source_meta: sourceMeta,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function consumePendingSlackDump({ pendingId, mumblUserId }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: pending, error } = await supabase
    .from("slack_pending_dumps")
    .select("*")
    .eq("id", pendingId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .single();
  if (error) throw error;

  const connection = await connectSlackUser({
    teamId: pending.slack_team_id,
    slackUserId: pending.slack_user_id,
    mumblUserId,
  });
  const dump = await saveSlackDump({ connection, content: pending.content, sourceMeta: pending.source_meta || {} });
  const { error: updateError } = await supabase.from("slack_pending_dumps").update({ consumed_at: now }).eq("id", pending.id);
  if (updateError) throw updateError;
  return { connection, dump };
}

export async function recentSlackPrivateDumps(connection) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dumps")
    .select("id, content, created_at")
    .eq("user_id", connection.mumbl_user_id)
    .eq("visibility", "private")
    .order("created_at", { ascending: false })
    .limit(MAX_SLACK_DRAFT_DUMPS);
  if (error) throw error;
  return data || [];
}

export async function recentSlackFieldNoteDrafts(connection) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("field_notes")
    .select("id, title, created_at")
    .eq("user_id", connection.mumbl_user_id)
    .eq("is_published", false)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function recentSlackPublishedFieldNotes(connection) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("field_notes")
    .select("id, title, published_at, spaces:team_room_id(id,slug,name)")
    .eq("user_id", connection.mumbl_user_id)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function getSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("field_notes")
    .select("id, title, content, created_at, source_dump_ids")
    .eq("user_id", connection.mumbl_user_id)
    .eq("is_published", false)
    .eq("id", cleanString(fieldNoteId, 64))
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId, title, content }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const cleanedTitle = cleanString(title, 120);
  const cleanedContent = cleanString(content, 4000);
  if (!cleanedTitle) throw new Error("field note title is required.");
  if (!cleanedContent) throw new Error("field note content is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("field_notes")
    .update({ title: cleanedTitle, content: cleanedContent })
    .eq("user_id", connection.mumbl_user_id)
    .eq("is_published", false)
    .eq("id", cleanString(fieldNoteId, 64))
    .select("id, title, content")
    .single();
  if (error) throw error;
  return {
    fieldNote: data,
    url: `${getServerEnv().appUrl}/dump?fieldNote=${encodeURIComponent(data.id)}`,
  };
}

export async function pinSlackSpaceBySlug({ teamId, slackUserId, slug }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const space = await findSpaceForSlackPin(slug);
  await pinSlackSpace({ connection, spaceId: space.id });
  const channelJoin = await inviteSlackUserToSpaceChannel({ teamId, slackUserId, spaceId: space.id });
  return { space, channelJoin };
}

export async function pinSlackSpaceForMumblUser({ mumblUserId, spaceId }) {
  const supabase = getSupabaseAdmin();
  const { data: connection, error } = await supabase
    .from("slack_connections")
    .select("*")
    .eq("mumbl_user_id", mumblUserId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!connection) throw new Error("connect Slack once before pinning this room.");
  await pinSlackSpace({ connection, spaceId });
  await inviteSlackUserToSpaceChannel({
    teamId: connection.slack_team_id,
    slackUserId: connection.slack_user_id,
    spaceId,
  });
  return connection;
}

async function reconcileSlackStartedSpacesForConnection(connection) {
  if (!connection?.mumbl_user_id || !connection?.slack_team_id || !connection?.slack_user_id) return { claimed: 0, pinned: 0 };

  const supabase = getSupabaseAdmin();
  const { data: startedSpaces, error } = await supabase
    .from("slack_started_spaces")
    .select("space_id, spaces(id,creator_user_id)")
    .eq("slack_team_id", connection.slack_team_id)
    .eq("created_by_slack_user_id", connection.slack_user_id);
  if (error) throw error;

  let claimed = 0;
  let pinned = 0;
  for (const startedSpace of startedSpaces || []) {
    const spaceId = startedSpace.space_id;
    if (!spaceId) continue;

    if (!startedSpace.spaces?.creator_user_id) {
      const { count, error: claimError } = await supabase
        .from("spaces")
        .update({ creator_user_id: connection.mumbl_user_id }, { count: "exact" })
        .eq("id", spaceId)
        .is("creator_user_id", null);
      if (claimError) throw claimError;
      claimed += count || 0;
    }

    await pinSlackSpace({ connection, spaceId });
    pinned += 1;
    await inviteSlackUserToSpaceChannel({
      teamId: connection.slack_team_id,
      slackUserId: connection.slack_user_id,
      spaceId,
    });
  }

  return { claimed, pinned };
}

export async function pinSlackSpaceForChannelMember({ teamId, slackUserId, channelId }) {
  const cleanedTeamId = cleanString(teamId, 80);
  const cleanedSlackUserId = cleanString(slackUserId, 80);
  const cleanedChannelId = cleanString(channelId, 80);
  if (!cleanedTeamId || !cleanedSlackUserId || !cleanedChannelId) {
    return { pinned: false, reason: "missing_event_data" };
  }

  const supabase = getSupabaseAdmin();
  const { data: channel, error } = await supabase
    .from("slack_space_channels")
    .select("space_id, slack_team_id, slack_channel_id, spaces(id,slug,name)")
    .eq("slack_team_id", cleanedTeamId)
    .eq("slack_channel_id", cleanedChannelId)
    .maybeSingle();
  if (error) throw error;
  if (!channel?.space_id) return { pinned: false, reason: "channel_not_linked" };

  const connection = await findSlackConnectionForAutoPin({
    teamId: cleanedTeamId,
    slackUserId: cleanedSlackUserId,
  });
  if (!connection) return { pinned: false, reason: "mumbl_account_not_connected" };

  await pinSlackSpace({ connection, spaceId: channel.space_id });
  return { pinned: true, space: channel.spaces };
}

export async function unpinSlackPinnedSpace({ teamId, slackUserId, pinId }) {
  const cleanedPinId = cleanString(pinId, 64);
  const cleanedTeamId = cleanString(teamId, 80);
  const cleanedSlackUserId = cleanString(slackUserId, 80);
  if (!cleanedPinId || !cleanedTeamId || !cleanedSlackUserId) throw new Error("pinned space is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_pinned_spaces")
    .delete()
    .eq("id", cleanedPinId)
    .eq("slack_team_id", cleanedTeamId)
    .eq("slack_user_id", cleanedSlackUserId)
    .select("id,space_id,spaces(id,slug,name)")
    .single();
  if (error?.code === "PGRST116") throw new Error("that pinned space is already gone.");
  if (error) throw error;
  return data;
}

export async function removeSlackUserFromPinnedSpaceChannel({ teamId, slackUserId, spaceId }) {
  const cleanedTeamId = cleanString(teamId, 80);
  const cleanedSlackUserId = cleanString(slackUserId, 80);
  const cleanedSpaceId = cleanString(spaceId, 64);
  if (!cleanedTeamId || !cleanedSlackUserId || !cleanedSpaceId) {
    return { removed: false, reason: "missing_channel_data" };
  }

  const supabase = getSupabaseAdmin();
  const { data: channel, error } = await supabase
    .from("slack_space_channels")
    .select("slack_channel_id, slack_channel_name")
    .eq("slack_team_id", cleanedTeamId)
    .eq("space_id", cleanedSpaceId)
    .maybeSingle();
  if (error) throw error;
  if (!channel?.slack_channel_id) return { removed: false, reason: "no_slack_channel" };

  try {
    const installation = await getSlackInstallation(cleanedTeamId);
    const token = decryptSlackToken({
      ciphertext: installation.bot_access_token_ciphertext,
      iv: installation.bot_access_token_iv,
      tag: installation.bot_access_token_tag,
    });
    await slackApi("conversations.kick", token, {
      channel: channel.slack_channel_id,
      user: cleanedSlackUserId,
    });
    return { removed: true, channelName: channel.slack_channel_name };
  } catch (error) {
    if (["not_in_channel", "not_in_group", "user_not_found", "channel_not_found"].includes(error.slack?.error)) {
      return { removed: true, alreadyGone: true, channelName: channel.slack_channel_name };
    }
    console.error("Slack channel removal after unpin failed", {
      message: error.message,
      slackError: error.slack?.error,
      spaceId: cleanedSpaceId,
    });
    return { removed: false, reason: error.slack?.error || "remove_failed", channelName: channel.slack_channel_name };
  }
}

export async function slackUnpinPinnedSpaceConfirmView({ teamId, slackUserId, pinId }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_pinned_spaces")
    .select("id,spaces(id,slug,name)")
    .eq("id", cleanString(pinId, 64))
    .eq("slack_team_id", cleanString(teamId, 80))
    .eq("slack_user_id", cleanString(slackUserId, 80))
    .single();
  if (error?.code === "PGRST116") throw new Error("that pinned space is already gone.");
  if (error) throw error;
  return slackUnpinPinnedSpaceConfirmModal({ pin: data });
}

export async function slackPublishOptionsView({ teamId, slackUserId, fieldNoteId }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const [fieldNote, pinnedSpaces] = await Promise.all([
    getSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId }),
    listSlackPinnedSpaces(connection),
  ]);
  return pinnedSpaces.length ? slackFieldNotePublishOptionsModal({ fieldNote, pinnedSpaces }) : slackNoPinnedSpacesModal();
}

export async function slackPublishPreviewView({ teamId, slackUserId, fieldNoteId, spaceId, isAnonymous, displayName }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const [fieldNote, pinnedSpace] = await Promise.all([
    getSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId }),
    getPinnedSpace({ connection, spaceId }),
  ]);
  return slackFieldNotePublishPreviewModal({
    fieldNote,
    space: pinnedSpace.spaces,
    isAnonymous,
    displayName,
  });
}

export async function publishSlackFieldNoteDraft({ teamId, slackUserId, fieldNoteId, spaceId, isAnonymous, displayName }) {
  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const sessionToken = `slack:${teamId}:${slackUserId}`;
  const sessionTokenHash = hashToken(sessionToken);
  const supabase = getSupabaseAdmin();

  const [{ data: fieldNote, error: noteError }, pinnedSpace] = await Promise.all([
    supabase
      .from("field_notes")
      .select("*, spaces:team_room_id(id,slug,name)")
      .eq("user_id", connection.mumbl_user_id)
      .eq("id", cleanString(fieldNoteId, 64))
      .single(),
    getPinnedSpace({ connection, spaceId }),
  ]);
  if (noteError) throw noteError;

  if (fieldNote.is_published) {
    const space = fieldNote.spaces || pinnedSpace.spaces;
    return {
      fieldNote: { id: fieldNote.id, title: fieldNote.title },
      space,
      url: `${getServerEnv().appUrl}/r/${space.slug}/reads`,
    };
  }

  await enforceRateLimit({ supabase, action: "post", sessionToken });

  const space = pinnedSpace.spaces;
  const authorName = isAnonymous ? null : cleanString(displayName, 48) || "someone brave";
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      space_id: space.id,
      type: "field_note",
      field_note_title: fieldNote.title,
      content: fieldNote.content,
      is_anonymous: isAnonymous,
      display_name: authorName,
    })
    .select()
    .single();
  if (postError) throw postError;

  const { data: updatedNote, error: updateError } = await supabase
    .from("field_notes")
    .update({
      team_room_id: space.id,
      is_published: true,
      published_post_id: post.id,
      published_at: new Date().toISOString(),
    })
    .eq("id", fieldNote.id)
    .select("id,title")
    .single();
  if (updateError) throw updateError;

  if (isAnonymous) {
    await supabase.from("anon_audit").insert({ post_id: post.id, session_token_hash: sessionTokenHash });
  }

  await Promise.all([
    supabase.from("spaces").update({ first_post_done: true }).eq("id", space.id),
    supabase.from("slack_pinned_spaces").update({ last_used_at: new Date().toISOString() }).eq("id", pinnedSpace.id),
  ]);

  try {
    await postTeamReadToSlack({ space, post });
  } catch (slackError) {
    await recordSlackTeamReadFailure({ spaceId: space.id, error: slackError });
  }

  return {
    fieldNote: updatedNote,
    space,
    url: `${getServerEnv().appUrl}/r/${space.slug}/reads`,
  };
}

async function findSpaceForSlackPin(slug) {
  const cleanedSlug = cleanString(slug, 64);
  if (!cleanedSlug) throw new Error("space slug is required.");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("spaces").select("id,slug,name").eq("slug", cleanedSlug).single();
  if (error?.code === "PGRST116") throw new Error("couldn't find that Mumbl space.");
  if (error) throw error;
  return data;
}

async function pinSlackSpace({ connection, spaceId }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("slack_pinned_spaces").upsert(
    {
      mumbl_user_id: connection.mumbl_user_id,
      slack_team_id: connection.slack_team_id,
      slack_user_id: connection.slack_user_id,
      space_id: spaceId,
    },
    { onConflict: "slack_team_id,slack_user_id,space_id" },
  );
  if (error) throw error;
}

async function listSlackPinnedSpaces(connection) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_pinned_spaces")
    .select("id,space_id,last_used_at,created_at,spaces(id,slug,name)")
    .eq("slack_team_id", connection.slack_team_id)
    .eq("slack_user_id", connection.slack_user_id)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const pins = data || [];
  const spaceIds = pins.map((pin) => pin.space_id).filter(Boolean);
  if (!spaceIds.length) return pins;

  const { data: channels, error: channelsError } = await supabase
    .from("slack_space_channels")
    .select("space_id,slack_channel_id,slack_channel_name,posting_enabled")
    .eq("slack_team_id", connection.slack_team_id)
    .in("space_id", spaceIds);
  if (channelsError) throw channelsError;

  const channelsBySpaceId = new Map((channels || []).map((channel) => [channel.space_id, channel]));
  return pins.map((pin) => ({
    ...pin,
    slackTeamReads: channelsBySpaceId.get(pin.space_id) || null,
  }));
}

async function getPinnedSpace({ connection, spaceId }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("slack_pinned_spaces")
    .select("id,space_id,spaces(id,slug,name)")
    .eq("slack_team_id", connection.slack_team_id)
    .eq("slack_user_id", connection.slack_user_id)
    .eq("space_id", cleanString(spaceId, 64))
    .single();
  if (error?.code === "PGRST116") throw new Error("pin that Mumbl space before publishing from Slack.");
  if (error) throw error;
  return data;
}

async function inviteSlackUserToSpaceChannel({ teamId, slackUserId, spaceId }) {
  const supabase = getSupabaseAdmin();
  const { data: channel, error } = await supabase
    .from("slack_space_channels")
    .select("slack_channel_id, slack_channel_name, posting_enabled")
    .eq("slack_team_id", cleanString(teamId, 80))
    .eq("space_id", cleanString(spaceId, 64))
    .maybeSingle();
  if (error) throw error;
  if (!channel?.slack_channel_id) return { joined: false, reason: "no_slack_channel" };

  try {
    const installation = await getSlackInstallation(teamId);
    const token = decryptSlackToken({
      ciphertext: installation.bot_access_token_ciphertext,
      iv: installation.bot_access_token_iv,
      tag: installation.bot_access_token_tag,
    });
    await slackApi("conversations.invite", token, {
      channel: channel.slack_channel_id,
      users: cleanString(slackUserId, 80),
    });
    return { joined: true, channelName: channel.slack_channel_name };
  } catch (error) {
    if (error.slack?.error === "already_in_channel") {
      return { joined: true, alreadyInChannel: true, channelName: channel.slack_channel_name };
    }
    console.error("Slack channel invite after pin failed", {
      message: error.message,
      slackError: error.slack?.error,
      spaceId,
    });
    return { joined: false, reason: error.slack?.error || "invite_failed", channelName: channel.slack_channel_name };
  }
}

export async function createSlackFieldNoteDraft({ teamId, slackUserId, dumpIds }) {
  const cleanedDumpIds = Array.isArray(dumpIds) ? dumpIds.map((id) => cleanString(id, 64)).filter(Boolean) : [];
  if (!cleanedDumpIds.length) throw new Error("choose at least one dump.");
  if (cleanedDumpIds.length > MAX_SLACK_DRAFT_DUMPS) throw new Error(`choose ${MAX_SLACK_DRAFT_DUMPS} dumps or fewer.`);

  const connection = await findOrCreateSlackConnectionByEmail({ teamId, slackUserId });
  const supabase = getSupabaseAdmin();
  await enforceRateLimit({ supabase, action: "field_note", sessionToken: `slack:${teamId}:${slackUserId}` });

  const { data: dumps, error: dumpsError } = await supabase
    .from("dumps")
    .select("*")
    .eq("user_id", connection.mumbl_user_id)
    .in("id", cleanedDumpIds);
  if (dumpsError) throw dumpsError;
  if (!dumps?.length) throw new Error("no matching private dumps found.");

  const orderedDumps = [...cleanedDumpIds].reverse().map((id) => dumps.find((dump) => dump.id === id)).filter(Boolean);
  const draft = await draftFieldNote({ dumps: orderedDumps });

  const { data: fieldNote, error: noteError } = await supabase
    .from("field_notes")
    .insert({
      user_id: connection.mumbl_user_id,
      session_token_hash: connection.slack_session_token_hash,
      source_dump_ids: draft.sourceDumpIds,
      title: draft.title || "field note",
      content: draft.content,
    })
    .select("id, title, content")
    .single();
  if (noteError) throw noteError;

  return {
    fieldNote,
    visibilityReminder: draft.visibilityReminder,
    url: `${getServerEnv().appUrl}/dump?fieldNote=${encodeURIComponent(fieldNote.id)}`,
  };
}

export function slackConnectUrl(pendingId) {
  const { appUrl } = getServerEnv();
  return `${appUrl}/slack/connect?pending=${encodeURIComponent(pendingId)}`;
}

export function dumpUrl(dumpId) {
  const { appUrl } = getServerEnv();
  return `${appUrl}/dump?dump=${encodeURIComponent(dumpId)}`;
}

export function slackSpaceHandoffUrl({ handoffId, handoffToken }) {
  const { appUrl } = getServerEnv();
  const params = new URLSearchParams({ id: handoffId, token: handoffToken });
  return `${appUrl}/slack/space?${params.toString()}`;
}

export function ephemeralText(text) {
  return {
    response_type: "ephemeral",
    text,
  };
}

export function slackSavedDumpPayload({ url, shortcut = false, compact = false }) {
  if (compact) return ephemeralText("saved to mumbl privately.");

  return blockResponse({
    text: shortcut ? "saved to mumbl privately." : "saved. only you can see this.",
    blocks: [
      section(shortcut ? "*saved to mumbl privately.*\nthat Slack message is now in your private dump." : "*saved. only you can see this.*\nprivate dump first. team read only if you choose later."),
      actions([{ text: "open in mumbl", url }]),
    ],
  });
}

export function slackConnectPayload({ url, shortcut = false, replaceOriginal = false }) {
  return blockResponse({
    text: "connect your mumbl account to save from Slack.",
    replaceOriginal,
    blocks: [
      section(shortcut ? "*connect mumbl once.*\nthen this message can land in your private dump." : "*connect mumbl once.*\nthen `/mumbl` can save thoughts without leaving Slack."),
      actions([{ text: "connect mumbl", url }]),
    ],
  });
}

export function slackHelpPayload() {
  return blockResponse({
    text: "use /mumbl to save a private thought or create a room.",
    blocks: [
      section("*mumbl in Slack*\n`/mumbl the thing I want to keep` saves a private dump.\n`/mumbl room platform team` creates a Mumbl room from Slack.\n`/mumbl pin platform-team` adds a room to your Slack publish list."),
      context("Private dumps stay private. Team reads only post to Slack if you enable them."),
    ],
  });
}

export function slackRoomNeedsNamePayload() {
  return blockResponse({
    text: "name the team after /mumbl room.",
    blocks: [
      section("*create a mumbl room from Slack*\nTry `/mumbl room platform team` or `/mumbl room design squad`."),
      context("`/mumbl start platform team` still works too."),
    ],
  });
}

export function slackRoomCreatedPayload({ space, openUrl, roomUrl, teamReadsUrl, creatorLinked, pinned }) {
  const status = creatorLinked
    ? "linked to your Mumbl login and pinned in Slack."
    : "created from Slack. Connect once to claim creator access in Mumbl.";
  return blockResponse({
    text: `created a mumbl room for ${space.name}.`,
    blocks: [
      section(`*${escapeSlackText(space.name)} is ready.*\n${status}`),
      actions([
        { text: "create team reads channel", url: teamReadsUrl, style: "primary" },
        { text: creatorLinked ? "open team reads" : "claim room", url: openUrl },
      ]),
      context(
        pinned
          ? `Pinned for publishing. Invite link: <${roomUrl}|${roomUrl}>`
          : `Use /mumbl pin ${space.slug} after connecting Mumbl. Invite link: <${roomUrl}|${roomUrl}>`,
      ),
    ],
  });
}

export function slackRoomCreatedModalView({ space, openUrl, roomUrl, teamReadsUrl, creatorLinked, pinned }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "room created" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(
        creatorLinked
          ? `*${escapeSlackText(space.name)} is ready.*\nIt is linked to your Mumbl login and pinned in Slack.`
          : `*${escapeSlackText(space.name)} is ready.*\nConnect once to claim creator access in Mumbl.`,
      ),
      actions([
        { text: "create team reads channel", url: teamReadsUrl, style: "primary" },
        { text: creatorLinked ? "open team reads" : "claim room", url: openUrl },
      ]),
      context(
        pinned
          ? "Pinned for publishing. Slack reads channel is optional and only mirrors published team reads."
          : "After connecting, Mumbl can pin this space for publishing from Slack.",
      ),
    ],
  };
}

export function slackDumpSavedModalView({ url }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "saved" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*saved to mumbl privately.*"),
      actions([{ text: "open in mumbl", url }]),
      context("Private dump first. Team read only if you choose later."),
    ],
  };
}

export function slackDumpConnectModalView({ url }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "connect mumbl" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*connect mumbl once.*\nThen this thought can land in your private dump."),
      actions([{ text: "connect mumbl", url }]),
    ],
  };
}

export function slackFieldNoteDraftingModalView() {
  return {
    type: "modal",
    title: { type: "plain_text", text: "drafting" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*drafting a field note...*"),
      context("Keep this open for a moment. Publishing still happens in Mumbl after review."),
    ],
  };
}

export function slackFieldNoteDraftReadyModalView({ fieldNote, url, visibilityReminder }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "draft ready" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(fieldNote.title || "field note draft")}*`),
      section("A private field-note draft is ready in Mumbl. Review it there before anything reaches team reads."),
      actions([{ text: "open draft in mumbl", url }]),
      context(visibilityReminder || "Only publish this if it still feels true."),
    ],
  };
}

export function slackFieldNoteEditModalView(fieldNote) {
  const content = cleanString(fieldNote.content, 4000);
  const title = slackSingleLineInputValue(fieldNote.title, 120) || "field note";
  if (content.length > 3000) {
    const { appUrl } = getServerEnv();
    return {
      type: "modal",
      title: { type: "plain_text", text: "open in mumbl" },
      close: { type: "plain_text", text: "done" },
      blocks: [
        section("*this draft is too long for Slack editing.*\nOpen it in Mumbl to keep the whole thing intact."),
        actions([{ text: "open in mumbl", url: `${appUrl}/dump?fieldNote=${encodeURIComponent(fieldNote.id)}` }]),
      ],
    };
  }

  return {
    type: "modal",
    callback_id: "edit_field_note_draft",
    private_metadata: fieldNote.id,
    title: { type: "plain_text", text: "edit draft" },
    submit: { type: "plain_text", text: "save" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      {
        type: "input",
        block_id: "field_note_title",
        label: { type: "plain_text", text: "title" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          initial_value: title,
          max_length: 120,
        },
      },
      {
        type: "input",
        block_id: "field_note_content",
        label: { type: "plain_text", text: "field note" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          initial_value: content,
          multiline: true,
          max_length: 3000,
        },
      },
      context("Saving keeps this private. Publish to a pinned Mumbl space when it feels ready."),
    ],
  };
}

export function slackFieldNoteSavedModalView({ fieldNote, url }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "draft saved" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(fieldNote.title || "field note draft")}*`),
      section("Saved privately. Publish to a pinned Mumbl space when it feels ready."),
      actions([
        { text: "publish to team read", actionId: "publish_field_note_start", value: fieldNote.id },
        { text: "open in mumbl", url },
      ]),
    ],
  };
}

export function slackFieldNoteDraftErrorModalView(message) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "draft failed" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*couldn't draft that field note yet.*"),
      context(cleanString(message, 180) || "Try fewer dumps or open Mumbl to draft there."),
    ],
  };
}

export function slackFieldNoteDraftSavedFallbackModalView({ fieldNote, url, message }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "draft saved" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(slackSingleLineInputValue(fieldNote?.title, 120) || "field note draft")}*`),
      section("The draft was saved, but Slack could not open the editor here."),
      actions([{ text: "open draft in mumbl", url }]),
      context(cleanString(message, 180) || "You can still edit and publish it from Mumbl."),
    ],
  };
}

export function slackFieldNotePublishedModalView({ fieldNote, space, url }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: "published" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(fieldNote.title || "team read")}*`),
      section(`Published to *${escapeSlackText(space.name)}* team reads.`),
      actions([{ text: "open team reads", url }]),
      context("If Slack team reads are enabled for that room, Mumbl posted one message in the linked channel."),
    ],
  };
}

export function slackFieldNotePublishingModalView() {
  return {
    type: "modal",
    title: { type: "plain_text", text: "publishing" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*publishing this team read...*"),
      context("Keep this open for a moment. Mumbl is posting it once, then this modal will update."),
    ],
  };
}

export async function postSlackResponse(responseUrl, payload) {
  const cleanedUrl = cleanString(responseUrl, 2000);
  if (!cleanedUrl) return;

  await fetch(cleanedUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function verifySlackState(state) {
  const decoded = decodeState(state);
  if (!decoded?.nonce || !decoded?.iat || Math.abs(Date.now() - decoded.iat) > 10 * 60 * 1000) {
    throw new Error("Slack install session expired. Try installing again.");
  }
  return decoded;
}

function createSlackState(extra = {}) {
  const payload = {
    nonce: randomBytes(16).toString("base64url"),
    iat: Date.now(),
    ...extra,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
}

function mergeScopes(existingScopes = [], nextScopeText = "") {
  const scopes = new Set(Array.isArray(existingScopes) ? existingScopes : []);
  cleanString(nextScopeText, 1000)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .forEach((scope) => scopes.add(scope));
  return [...scopes];
}

async function createPrivateChannel({ token, name }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix = attempt ? `-${randomBytes(2).toString("hex")}` : "";
    try {
      const result = await slackApi("conversations.create", token, {
        name: `${name}${suffix}`.slice(0, 80),
        is_private: true,
      });
      return result.channel;
    } catch (error) {
      if (error.slack?.error !== "name_taken") throw error;
    }
  }
  throw new Error("couldn't create a unique Slack channel name.");
}

async function inviteUserToSlackChannel({ token, channelId, slackUserId }) {
  try {
    await slackApi("conversations.invite", token, {
      channel: channelId,
      users: slackUserId,
    });
  } catch {
    // Channel creation still succeeds if Slack cannot invite the setup user.
  }
}

async function postSlackChannelIntro({ token, channel, space }) {
  try {
    await slackApi("chat.postMessage", token, {
      channel: channel.slack_channel_id,
      text: `mumbl team reads for ${space.name}`,
      blocks: [
        section(`*team reads for ${escapeSlackText(space.name)} live here now.*\nOnly field notes that someone explicitly publishes in Mumbl will show up. Anonymous stays anonymous; handles stay as chosen in Mumbl.`),
        actions([{ text: "open mumbl room", url: `${getServerEnv().appUrl}/r/${space.slug}/reads` }]),
      ],
    });
  } catch {
    // Channel setup should not fail just because the intro message missed.
  }
}

async function slackApi(method, token, body) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) {
    const error = new Error(result.error || `${method} failed`);
    console.error("Slack API failed", {
      method,
      status: response.status,
      slackError: result.error,
      messages: result.response_metadata?.messages,
      response: result,
    });
    error.slack = result;
    error.slackMethod = method;
    throw error;
  }
  return result;
}

function channelNameForSpace(space) {
  return `mumbl-${slugify(space?.slug || space?.name || "team-reads")}`.slice(0, 80);
}

function teamReadMessage({ space, post, channel }) {
  const author = post.is_anonymous ? "anonymous team read" : cleanString(post.display_name, 48) || "someone brave";
  const title = cleanString(post.field_note_title, 120) || "team read";
  const preview = cleanString(post.content, 900);
  const url = `${getServerEnv().appUrl}/r/${space.slug}/reads`;
  return {
    channel: channel.slack_channel_id,
    text: `${author}: ${title}`,
    blocks: [
      section(`*${escapeSlackText(title)}*\n_${escapeSlackText(author)}_`),
      section(escapeSlackText(preview)),
      actions([{ text: "read in mumbl", url }]),
      context(`from ${space.name} on mumbl`),
    ],
  };
}

async function slackAppHomeBlocks({ teamId, slackUserId }) {
  const { appUrl } = getServerEnv();
  const connection = await findSlackConnection({ teamId, slackUserId });
  const [pinnedSpaces, pendingPattern] = connection
    ? await Promise.all([listSlackPinnedSpaces(connection), findPendingPattern(connection.mumbl_user_id)])
    : [[], null];
  const topPinnedSpaces = pinnedSpaces.slice(0, 5);
  const pinnedList = topPinnedSpaces
    .map((pin) => {
      const space = pin.spaces || {};
      return `- *${escapeSlackText(space.name || "Mumbl space")}*  \`${escapeSlackText(space.slug || "space")}\``;
    })
    .join("\n");

  const blocks = [
    section("*mumbl*\nCatch work thoughts privately. Shape the useful ones into team reads when they are ready."),
    actions([
      { text: "new private dump", actionId: "new_private_dump", style: "primary" },
      { text: "open your dump", url: `${appUrl}/dump` },
    ]),
    divider(),
    section("*drafts*\nTurn recent private dumps into a field-note draft, then edit and publish from Slack."),
    actions([
      { text: "draft team read", actionId: "draft_team_read" },
      { text: "review drafts", actionId: "review_field_note_drafts" },
      { text: "published reads", actionId: "review_published_reads" },
    ]),
    divider(),
    section(
      pinnedSpaces.length
        ? `*pinned teamspaces*\n${pinnedList}`
        : connection
          ? "*pinned teamspaces*\nNo pinned spaces yet. Create a team room here, or use `/mumbl pin space-slug`."
          : "*pinned teamspaces*\nConnect by saving a private dump, then pin a Mumbl space for team reads.",
    ),
    actions(
      pinnedSpaces.length
        ? [
            { text: "manage pinned spaces", actionId: "manage_pinned_spaces", style: "primary" },
            { text: "start a team room", actionId: "start_room_modal" },
          ]
        : [
            { text: "start a team room", actionId: "start_room_modal", style: "primary" },
            { text: "create on mumbl", url: `${appUrl}/create` },
          ],
    ),
    divider(),
    section("*team reads on Slack*\nIf a Mumbl room has Slack team reads enabled, published reads appear as one clean channel message. Replies stay in that Slack thread."),
    context("No channel history. No member tracking. Slack identity is never used for anonymous reads."),
  ];

  if (pendingPattern) {
    blocks.splice(
      2,
      0,
      section("*something private is ready*\nMumbl noticed a work pattern from your private dump."),
      actions([{ text: "view private pattern", url: `${appUrl}/patterns?pattern=${encodeURIComponent(pendingPattern.id)}` }]),
      context("Slack gets the pointer. The actual pattern stays in Mumbl."),
      divider(),
    );
  }

  return blocks;
}

async function findPendingPattern(mumblUserId) {
  if (!mumblUserId) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patterns")
    .select("id")
    .eq("user_id", mumblUserId)
    .or("user_dismissed.is.null,user_dismissed.eq.false")
    .is("user_confirmed", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (isMissingPatternTable(error)) return null;
  if (error) throw error;
  return data;
}

function isMissingPatternTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingSlackInstallationError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "PGRST116" || message.includes("cannot coerce") || message.includes("0 rows");
}

function missingSlackScopes(scopes, requiredScopes) {
  const installedScopes = new Set(Array.isArray(scopes) ? scopes : []);
  return requiredScopes.filter((scope) => !installedScopes.has(scope));
}

function slackRoomModal({ initialName = "" }) {
  const cleanedInitialName = cleanString(initialName, 80);

  return {
    type: "modal",
    callback_id: "create_mumbl_room",
    title: { type: "plain_text", text: "new mumbl room" },
    submit: { type: "plain_text", text: "create room" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      {
        type: "input",
        block_id: "room_name",
        label: { type: "plain_text", text: "team name" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          ...(cleanedInitialName ? { initial_value: cleanedInitialName } : {}),
          placeholder: { type: "plain_text", text: "platform team" },
          max_length: 80,
        },
      },
      context("Mumbl creates the room privately first. Team reads on Slack stay optional."),
    ],
  };
}

function slackLoadingModal({ title, message }) {
  return {
    type: "modal",
    title: { type: "plain_text", text: truncatePlain(title, 24) },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(message)}*`),
    ],
  };
}

function slackDumpModal() {
  return {
    type: "modal",
    callback_id: "create_private_dump",
    title: { type: "plain_text", text: "new private dump" },
    submit: { type: "plain_text", text: "save" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      {
        type: "input",
        block_id: "dump_content",
        label: { type: "plain_text", text: "thought" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          max_length: 3000,
          placeholder: { type: "plain_text", text: "the thing worth keeping" },
        },
      },
      context("Only this text is saved. Mumbl does not read the channel around it."),
    ],
  };
}

function slackFieldNoteDraftModal({ dumps }) {
  return {
    type: "modal",
    callback_id: "draft_team_read",
    title: { type: "plain_text", text: "draft team read" },
    submit: { type: "plain_text", text: "draft" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      section("Choose recent private dumps. Mumbl creates a private draft; you review and publish in Mumbl."),
      {
        type: "input",
        block_id: "draft_dump_ids",
        label: { type: "plain_text", text: "private dumps" },
        element: {
          type: "checkboxes",
          action_id: "value",
          options: dumps.slice(0, MAX_SLACK_DRAFT_DUMPS).map((dump) => dumpOption(dump)),
        },
      },
      context("Nothing posts to team reads from Slack. This only creates an editable draft."),
    ],
  };
}

function slackFieldNoteReviewModal({ fieldNotes }) {
  return {
    type: "modal",
    callback_id: "review_field_note_drafts",
    title: { type: "plain_text", text: "review drafts" },
    submit: { type: "plain_text", text: "edit" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      {
        type: "input",
        block_id: "field_note_id",
        label: { type: "plain_text", text: "draft" },
        element: {
          type: "static_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "choose a draft" },
          options: fieldNotes.map((fieldNote) => fieldNoteOption(fieldNote)),
        },
      },
      context("Drafts stay private here. Publish from Slack or open the draft in Mumbl."),
    ],
  };
}

function slackNoFieldNoteDraftsModal() {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "no drafts" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*no private field-note drafts yet.*\nDraft one from recent dumps first."),
      actions([{ text: "open your dump", url: `${appUrl}/dump` }]),
    ],
  };
}

function slackPublishedReadsModal({ fieldNotes }) {
  const { appUrl } = getServerEnv();
  const blocks = [
    section("*published reads*\nField notes you have already published from Mumbl or Slack."),
  ];

  fieldNotes.slice(0, 10).forEach((fieldNote) => {
    const space = fieldNote.spaces || {};
    const destination = space.name ? `in ${escapeSlackText(space.name)}` : "published";
    blocks.push(
      section(`*${escapeSlackText(fieldNote.title || "team read")}*\n${destination}`),
      actions([{ text: "open read", url: space.slug ? `${appUrl}/r/${space.slug}/reads` : `${appUrl}/dump?fieldNote=${encodeURIComponent(fieldNote.id)}` }]),
    );
  });

  return {
    type: "modal",
    title: { type: "plain_text", text: "published reads" },
    close: { type: "plain_text", text: "done" },
    blocks,
  };
}

function slackNoPublishedReadsModal() {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "published reads" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*nothing published yet.*\nReview a draft when one feels ready for a team read."),
      actions([
        { text: "review drafts", actionId: "review_field_note_drafts", style: "primary" },
        { text: "open your dump", url: `${appUrl}/dump` },
      ]),
    ],
  };
}

function slackNoPinnedSpacesModal() {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "team space needed" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*choose where this team read should live.*\nCreate a Mumbl team space from Slack, or pin an existing room with `/mumbl pin space-slug`."),
      actions([
        { text: "create team space", actionId: "start_room_modal", style: "primary" },
        { text: "open mumbl", url: `${appUrl}/create` },
      ]),
      context("After a space is pinned, come back to this draft and publish it to team reads."),
    ],
  };
}

function slackPinnedSpacesEmptyModal({ connected }) {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "pinned spaces" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(
        connected
          ? "*no pinned teamspaces yet.*\nCreate one from Slack, or pin an existing room with `/mumbl pin space-slug`."
          : "*connect mumbl first.*\nSave a private dump from Slack once, then pin a teamspace for publishing.",
      ),
      actions(
        connected
          ? [
              { text: "start a team room", actionId: "start_room_modal", style: "primary" },
              { text: "create on mumbl", url: `${appUrl}/create` },
            ]
          : [
              { text: "new private dump", actionId: "new_private_dump", style: "primary" },
              { text: "open mumbl", url: `${appUrl}/dump` },
            ],
      ),
    ],
  };
}

async function slackPinnedSpacesModal({ pinnedSpaces }) {
  const blocks = [
    section("*your pinned teamspaces*\nThese are personal Slack publish destinations. Unpinning only removes your shortcut."),
  ];

  for (const pin of pinnedSpaces.slice(0, 10)) {
    const space = pin.spaces || {};
    const channel = pin.slackTeamReads;
    const channelText = channel?.slack_channel_name
      ? `slack reads channel: #${channel.slack_channel_name}${channel.posting_enabled ? "" : " (posting paused)"}`
      : "no slack reads channel yet.";
    const rowActions = [
      { text: "open team reads", url: `${getServerEnv().appUrl}/r/${space.slug}/reads` },
      { text: "publish a draft", actionId: "review_field_note_drafts" },
    ];
    if (!channel?.slack_channel_id) {
      const setup = await createTeamReadsSetup({ spaceId: space.id });
      rowActions.push({ text: "create team reads channel", url: slackTeamReadsInstallUrl(setup), style: "primary" });
    }
    rowActions.push({ text: "unpin", actionId: "unpin_pinned_space_start", value: pin.id, style: "danger" });

    blocks.push(
      section(`*${escapeSlackText(space.name || "Mumbl space")}*\n\`${escapeSlackText(space.slug || "space")}\`\n${escapeSlackText(channelText)}`),
      actions(rowActions),
    );
  }

  return {
    type: "modal",
    title: { type: "plain_text", text: "pinned spaces" },
    close: { type: "plain_text", text: "done" },
    blocks,
  };
}

export function slackUnpinPinnedSpaceConfirmModal({ pin }) {
  const space = pin?.spaces || {};
  return {
    type: "modal",
    callback_id: "unpin_pinned_space_confirm",
    private_metadata: JSON.stringify({ pinId: pin?.id || "" }),
    title: { type: "plain_text", text: "unpin space?" },
    submit: { type: "plain_text", text: "unpin" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      section(`*Remove ${escapeSlackText(space.name || "this space")} from your Slack publish list?*`),
      context("This does not delete the Mumbl room or change posting for anyone else. If there is a linked Slack reads channel, Mumbl will remove you from it too."),
    ],
  };
}

function slackFieldNotePublishOptionsModal({ fieldNote, pinnedSpaces }) {
  const initialPin = pinnedSpaces.length === 1 ? pinnedSpaceOption(pinnedSpaces[0]) : null;
  return {
    type: "modal",
    callback_id: "publish_field_note_options",
    private_metadata: fieldNote.id,
    title: { type: "plain_text", text: "publish draft" },
    submit: { type: "plain_text", text: "preview" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      section(`*${escapeSlackText(fieldNote.title || "field note draft")}*`),
      {
        type: "input",
        block_id: "publish_space",
        label: { type: "plain_text", text: "Mumbl space" },
        element: {
          type: "static_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "choose a pinned space" },
          ...(initialPin ? { initial_option: initialPin } : {}),
          options: pinnedSpaces.map((pin) => pinnedSpaceOption(pin)),
        },
      },
      {
        type: "input",
        block_id: "publish_identity",
        label: { type: "plain_text", text: "identity" },
        element: {
          type: "static_select",
          action_id: "value",
          initial_option: identityOption("anonymous"),
          options: [identityOption("anonymous"), identityOption("handle")],
        },
      },
      {
        type: "input",
        block_id: "publish_handle",
        optional: true,
        label: { type: "plain_text", text: "handle, if using one" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          max_length: 48,
          placeholder: { type: "plain_text", text: "sam from infra" },
        },
      },
      context("Slack identity is never used. Anonymous stays anonymous; handle means only the text you choose."),
    ],
  };
}

function slackFieldNotePublishPreviewModal({ fieldNote, space, isAnonymous, displayName }) {
  const author = isAnonymous ? "anonymous team read" : cleanString(displayName, 48) || "someone brave";
  return {
    type: "modal",
    callback_id: "publish_field_note_confirm",
    private_metadata: JSON.stringify({
      fieldNoteId: fieldNote.id,
      spaceId: space.id,
      isAnonymous,
      displayName: isAnonymous ? "" : author,
    }),
    title: { type: "plain_text", text: "publish?" },
    submit: { type: "plain_text", text: "publish" },
    close: { type: "plain_text", text: "cancel" },
    blocks: [
      section(`*${escapeSlackText(fieldNote.title || "team read")}*\n_${escapeSlackText(author)}_`),
      section(escapeSlackText(truncatePlain(fieldNote.content, 900))),
      context(`Publishing to ${space.name}. This may also post one message in the linked Slack team-read channel.`),
    ],
  };
}

function slackFieldNoteNoDumpsModal() {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "no dumps yet" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section("*no private dumps to draft from yet.*\nSave a few thoughts first, then come back."),
      actions([{ text: "open your dump", url: `${appUrl}/dump` }]),
    ],
  };
}

function slackFieldNoteDraftUnavailableModal(message) {
  const { appUrl } = getServerEnv();
  return {
    type: "modal",
    title: { type: "plain_text", text: "connect first" },
    close: { type: "plain_text", text: "done" },
    blocks: [
      section(`*${escapeSlackText(cleanString(message, 180) || "connect mumbl first.")}*`),
      actions([{ text: "open mumbl", url: `${appUrl}/dump` }]),
    ],
  };
}

function dumpOption(dump) {
  const date = new Date(dump.created_at);
  return {
    text: { type: "plain_text", text: truncatePlain(firstLine(dump.content), 75) },
    value: dump.id,
    description: {
      type: "plain_text",
      text: truncatePlain(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 75),
    },
  };
}

function fieldNoteOption(fieldNote) {
  const date = new Date(fieldNote.created_at);
  return {
    text: { type: "plain_text", text: truncatePlain(fieldNote.title || firstLine(fieldNote.content) || "field note draft", 75) },
    value: fieldNote.id,
    description: {
      type: "plain_text",
      text: truncatePlain(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 75),
    },
  };
}

function pinnedSpaceOption(pin) {
  const space = pin.spaces || {};
  return {
    text: { type: "plain_text", text: truncatePlain(space.name || space.slug || "Mumbl space", 75) },
    value: space.id,
    description: { type: "plain_text", text: truncatePlain(space.slug || "space", 75) },
  };
}

function identityOption(value) {
  if (value === "handle") {
    return {
      text: { type: "plain_text", text: "publish with handle" },
      value: "handle",
    };
  }
  return {
    text: { type: "plain_text", text: "anonymous team read" },
    value: "anonymous",
  };
}

function blockResponse({ text, blocks, replaceOriginal = false }) {
  return {
    response_type: "ephemeral",
    text,
    blocks,
    ...(replaceOriginal ? { replace_original: true } : {}),
  };
}

function section(text) {
  return {
    type: "section",
    text: { type: "mrkdwn", text },
  };
}

function divider() {
  return { type: "divider" };
}

function actions(buttons) {
  return {
    type: "actions",
    elements: buttons.map((button) => ({
      type: "button",
      text: { type: "plain_text", text: button.text },
      ...(button.url ? { url: button.url } : {}),
      ...(button.actionId ? { action_id: button.actionId } : {}),
      ...(button.value ? { value: button.value } : {}),
      ...(button.style ? { style: button.style } : {}),
    })),
  };
}

function context(text) {
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  };
}

function escapeSlackText(text) {
  return cleanString(text, 3000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function firstLine(text) {
  return cleanString(text, 300).split(/\r?\n/).find(Boolean) || "private dump";
}

function truncatePlain(text, maxLength) {
  const cleaned = cleanString(text, maxLength + 20).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned || "private dump";
  const suffix = "...";
  if (maxLength <= suffix.length) return suffix.slice(0, Math.max(0, maxLength));
  return `${cleaned.slice(0, Math.max(0, maxLength - suffix.length)).trim()}${suffix}`;
}

function slackSingleLineInputValue(text, maxLength) {
  return cleanString(text, maxLength + 20).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function decodeState(state) {
  const [encoded, signature] = String(state || "").split(".");
  if (!encoded || !signature || !safeEqual(signature, signState(encoded))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function signState(encoded) {
  const { slackSigningSecret } = assertSlackEnv();
  return createHmac("sha256", slackSigningSecret).update(encoded).digest("base64url");
}

function encryptSlackToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(TOKEN_ALGORITHM, slackTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptSlackToken({ ciphertext, iv, tag }) {
  const decipher = createDecipheriv(TOKEN_ALGORITHM, slackTokenKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

function encryptSlackSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(TOKEN_ALGORITHM, slackTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptSlackSecret({ ciphertext, iv, tag }) {
  const decipher = createDecipheriv(TOKEN_ALGORITHM, slackTokenKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

function slackTokenKey() {
  const { slackTokenEncryptionKey } = assertSlackEnv();
  return createHash("sha256").update(slackTokenEncryptionKey).digest();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
