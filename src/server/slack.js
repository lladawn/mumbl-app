import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { assertSlackEnv, getServerEnv } from "./env";
import { createToken, hashToken } from "./hash";
import { getSupabaseAdmin } from "./supabase";
import { cleanString, slugify } from "./validation";

const SLACK_OAUTH_SCOPES = ["commands", "users:read", "users:read.email"];
const SLACK_TEAM_READS_SCOPES = ["chat:write", "groups:write"];
const TOKEN_ALGORITHM = "aes-256-gcm";
const MAX_SLACK_AGE_SECONDS = 60 * 5;

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
  await postSlackChannelIntro({ token: accessToken, channel: data, space: setup.spaces });
  return data;
}

export async function createSlackStartedSpace({ teamId, slackUserId, name }) {
  const supabase = getSupabaseAdmin();
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

  const handoff = await createCreatorHandoff({ spaceId: insertedSpace.id, creatorToken });
  const teamReadsSetup = await createTeamReadsSetup({ spaceId: insertedSpace.id });
  return {
    space: insertedSpace,
    creatorToken,
    openUrl: slackSpaceHandoffUrl(handoff),
    roomUrl: `${getServerEnv().appUrl}/r/${insertedSpace.slug}`,
    teamReadsUrl: slackTeamReadsInstallUrl(teamReadsSetup),
  };
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

export async function consumeCreatorHandoff({ handoffId, handoffToken }) {
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

  return {
    slug: handoff.spaces.slug,
    name: handoff.spaces.name,
    creatorToken,
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

  return slackApi("views.publish", token, {
    user_id: slackUserId,
    view: {
      type: "home",
      callback_id: "mumbl_home",
      blocks: slackAppHomeBlocks(),
    },
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

export function slackSavingPayload() {
  return blockResponse({
    text: "saving to mumbl...",
    blocks: [
      section("*saving to mumbl...*\nkeeping it private while mumbl files it away."),
    ],
  });
}

export function slackSavedDumpPayload({ url, shortcut = false }) {
  return blockResponse({
    text: shortcut ? "saved to mumbl privately." : "saved. only you can see this.",
    blocks: [
      section(shortcut ? "*saved to mumbl privately.*\nthat Slack message is now in your private dump." : "*saved. only you can see this.*\nprivate dump first. team read only if you choose later."),
      actions([{ text: "open in mumbl", url }]),
    ],
  });
}

export function slackConnectPayload({ url, shortcut = false }) {
  return blockResponse({
    text: "connect your mumbl account to save from Slack.",
    blocks: [
      section(shortcut ? "*connect mumbl once.*\nthen this message can land in your private dump." : "*connect mumbl once.*\nthen `/mumbl` can save thoughts without leaving Slack."),
      actions([{ text: "connect mumbl", url }]),
    ],
  });
}

export function slackStartNeedsNamePayload() {
  return blockResponse({
    text: "name the team after /mumbl start.",
    blocks: [
      section("*start a mumbl room from Slack*\nTry `/mumbl start platform team` or `/mumbl start design squad`."),
    ],
  });
}

export function slackRoomCreatedPayload({ space, openUrl, roomUrl, teamReadsUrl }) {
  return blockResponse({
    text: `created a mumbl room for ${space.name}.`,
    blocks: [
      section(`*created a mumbl room for ${escapeSlackText(space.name)}.*\nprivate dumps stay private. team reads only post to Slack if you enable them.`),
      actions([
        { text: "open room", url: openUrl },
        { text: "open invite link", url: roomUrl },
        { text: "enable Slack team reads", url: teamReadsUrl },
      ]),
      context(`invite link: <${roomUrl}|${roomUrl}>`),
    ],
  });
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
    error.slack = result;
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

function slackAppHomeBlocks() {
  const { appUrl } = getServerEnv();
  return [
    section("*mumbl*\nprivate dump first. team read only when you choose."),
    section("*save a private thought*\nType `/mumbl the thing you want to keep` anywhere in Slack."),
    section("*start a team space from Slack*\nType `/mumbl start platform team` to create the room without leaving Slack."),
    section("*team reads on Slack*\nAfter a room is created, use its `enable Slack team reads` button to create one private channel."),
    actions([
      { text: "open your dump", url: `${appUrl}/dump` },
      { text: "create on mumbl", url: `${appUrl}/create` },
    ]),
    context("No channel history. No member tracking. Only what you explicitly send or publish."),
  ];
}

function blockResponse({ text, blocks }) {
  return {
    response_type: "ephemeral",
    text,
    blocks,
  };
}

function section(text) {
  return {
    type: "section",
    text: { type: "mrkdwn", text },
  };
}

function actions(buttons) {
  return {
    type: "actions",
    elements: buttons.map((button) => ({
      type: "button",
      text: { type: "plain_text", text: button.text },
      url: button.url,
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
