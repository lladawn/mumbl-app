import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { assertSlackEnv, getServerEnv } from "./env";
import { hashToken } from "./hash";
import { getSupabaseAdmin } from "./supabase";
import { cleanString } from "./validation";

const SLACK_OAUTH_SCOPES = ["commands", "users:read", "users:read.email"];
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

export async function storeSlackInstallation(oauthResult) {
  const teamId = cleanString(oauthResult.team?.id, 80);
  const accessToken = cleanString(oauthResult.access_token, 4096);
  if (!teamId || !accessToken) throw new Error("Slack OAuth response was missing workspace access.");

  const encryptedToken = encryptSlackToken(accessToken);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("slack_installations").upsert(
    {
      slack_team_id: teamId,
      slack_team_name: cleanString(oauthResult.team?.name, 120),
      bot_user_id: cleanString(oauthResult.bot_user_id, 80),
      bot_access_token_ciphertext: encryptedToken.ciphertext,
      bot_access_token_iv: encryptedToken.iv,
      bot_access_token_tag: encryptedToken.tag,
      scopes: cleanString(oauthResult.scope, 1000)
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
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

export function ephemeralText(text) {
  return {
    response_type: "ephemeral",
    text,
  };
}

export function ephemeralLink({ text, url, label }) {
  return {
    response_type: "ephemeral",
    text: `${text} <${url}|${label}>`,
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

function createSlackState() {
  const payload = {
    nonce: randomBytes(16).toString("base64url"),
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
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

function slackTokenKey() {
  const { slackTokenEncryptionKey } = assertSlackEnv();
  return createHash("sha256").update(slackTokenEncryptionKey).digest();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
