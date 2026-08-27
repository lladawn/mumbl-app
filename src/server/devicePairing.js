import { createToken, hashToken } from "./hash";
import { cleanString } from "./validation";

/**
 * Device pairing — the server half of the desktop helper's "Connect my office".
 *
 * The contract is desktop/src-tauri/src/pairing.rs (see `REQUIRED_BACKEND`);
 * this module implements it and nothing more. The shape:
 *
 *   1. the app mints a random code locally and opens /pair?code=…&name=…
 *   2. a SIGNED-IN human on that page authorizes it  → authorizePairingCode()
 *   3. the app polls /api/agents/pair/claim          → claimPairingCode()
 *
 * Two properties do the security work, and both are deliberate:
 *
 * UNAUTHENTICATED CLAIM. The desktop app cannot authenticate — it has no
 * credentials yet; acquiring one is the entire point of the flow. So possession
 * of a fresh code IS the proof. That is only sound because the code is
 * short-lived, single-use, and useless until a signed-in human has bound a
 * space to it. A code on its own authorizes nothing.
 *
 * THE TOKEN THAT TRAVELS IS NEVER THE SPACE'S OWN. Authorizing mints a new
 * device token scoped to one machine. The space-wide ingest token is never read
 * here and never leaves the server. This is the hard requirement in pairing.rs,
 * and it is why pairing is worth building rather than telling people to paste.
 */

// Long enough that the human can find the browser window, short enough that a
// code sitting in shell history or a log line is worthless by the time anyone
// reads it. pairing.rs documents ~10 minutes; this is that number.
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

const MAX_CODE = 64;
const MAX_DEVICE_NAME = 80;

export function normalizePairingCode(value) {
  // The client formats codes as XXXX-XXXX from an uppercased uuid with
  // ambiguous glyphs stripped (pairing.rs::new_code). Normalising case and
  // stray whitespace here means a code that got retyped by hand still works.
  return cleanString(value, MAX_CODE).toUpperCase().replace(/\s+/g, "");
}

export function normalizeDeviceName(value) {
  return cleanString(value, MAX_DEVICE_NAME) || "Unknown device";
}

/**
 * Record a pending code so the authorize page can look up what is asking.
 *
 * Called by the /pair page rather than by the desktop app: the app never talks
 * to us until it claims. Idempotent on the code — reopening the authorize URL
 * (a refresh, a second tab) must not orphan the first row or reset the clock.
 */
export async function registerPairingCode(supabase, { code, deviceName }) {
  const codeHash = hashToken(code);
  const { data: existing, error: readError } = await supabase
    .from("agent_pairing_codes")
    .select("id, device_name, expires_at, authorized_at, claimed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("agent_pairing_codes")
    .insert({
      code_hash: codeHash,
      device_name: normalizeDeviceName(deviceName),
      expires_at: new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString(),
    })
    .select("id, device_name, expires_at, authorized_at, claimed_at")
    .single();
  if (error) throw error;
  return data;
}

/**
 * A human said yes. Mint the device token and bind it to the code.
 *
 * The caller MUST have already established that `userId` is entitled to
 * `spaceId` — this function does not re-check, because it has no way to; it is
 * the route's job (app/api/agents/pair/authorize) and it does it before calling.
 */
export async function authorizePairingCode(supabase, { code, spaceId, userId, deviceName }) {
  const codeHash = hashToken(code);

  const { data: row, error: readError } = await supabase
    .from("agent_pairing_codes")
    .select("id, device_name, expires_at, authorized_at, claimed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return { status: "unknown" };
  if (row.claimed_at) return { status: "spent" };
  if (Date.parse(row.expires_at) <= Date.now()) return { status: "expired" };
  // Authorizing twice is a double-click or a second tab, not an error. Re-using
  // the existing binding avoids minting a second device token for one pairing.
  if (row.authorized_at) return { status: "ok", alreadyAuthorized: true };

  const token = createToken();
  const { data: deviceToken, error: tokenError } = await supabase
    .from("agent_device_tokens")
    .insert({
      space_id: spaceId,
      token_hash: hashToken(token),
      device_name: normalizeDeviceName(deviceName || row.device_name),
      created_by_user_id: userId || null,
    })
    .select("id")
    .single();
  if (tokenError) throw tokenError;

  const { error: bindError } = await supabase
    .from("agent_pairing_codes")
    .update({
      authorized_at: new Date().toISOString(),
      authorized_by_user_id: userId || null,
      space_id: spaceId,
      device_token_id: deviceToken.id,
    })
    .eq("id", row.id)
    .is("claimed_at", null);
  if (bindError) throw bindError;

  // The plaintext token is returned ONCE, here, and immediately stashed for the
  // claim. It is never stored and never recoverable — same posture as
  // scripts/agent-space-create.mjs printing the ingest token exactly once.
  return { status: "ok", token, deviceTokenId: deviceToken.id };
}

/**
 * The desktop app collecting its token. Unauthenticated by design.
 *
 * Returns one of the three states pairing.rs polls for:
 *   { state: "authorized", token, slug }  → 200
 *   { state: "pending" }                  → 202
 *   { state: "invalid" }                  → 404 (unknown / expired / spent)
 *
 * The plaintext token is not in the database, so authorize() has to hand it
 * over out-of-band. `stashAuthorizedToken` holds it in memory between the two
 * requests; see the note there for why that is acceptable and where it breaks.
 */
export async function claimPairingCode(supabase, { code }) {
  const codeHash = hashToken(code);

  const { data: row, error } = await supabase
    .from("agent_pairing_codes")
    .select("id, expires_at, authorized_at, claimed_at, space_id, device_token_id")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;

  if (!row) return { state: "invalid", reason: "unknown" };
  if (row.claimed_at) return { state: "invalid", reason: "already used" };
  if (Date.parse(row.expires_at) <= Date.now()) return { state: "invalid", reason: "expired" };
  if (!row.authorized_at) return { state: "pending" };

  const token = takeAuthorizedToken(codeHash);
  if (!token) {
    // Authorized, but the plaintext is gone — the process that minted it has
    // restarted, or another instance served the authorize call. We cannot
    // reconstruct it (only the HMAC is stored), so the honest move is to burn
    // the pairing and make the user click Connect again rather than leave the
    // app polling a code that can never produce a token.
    await burnPairing(supabase, row);
    return { state: "invalid", reason: "authorization could not be completed — pair again" };
  }

  // Single-use: stamp claimed_at, and only if it is still null, so two racing
  // polls cannot both walk away with the token.
  const { data: claimed, error: claimError } = await supabase
    .from("agent_pairing_codes")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("claimed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { state: "invalid", reason: "already used" };

  const { data: space, error: spaceError } = await supabase
    .from("agent_spaces")
    .select("slug")
    .eq("id", row.space_id)
    .maybeSingle();
  if (spaceError) throw spaceError;

  return { state: "authorized", token, slug: space?.slug || "" };
}

async function burnPairing(supabase, row) {
  await supabase
    .from("agent_pairing_codes")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (row.device_token_id) {
    await supabase
      .from("agent_device_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", row.device_token_id);
  }
}

/**
 * The plaintext device token, held between authorize and claim.
 *
 * Only the HMAC goes to the database (the whole schema works this way), so the
 * one-time plaintext has to survive the gap between the browser authorizing and
 * the desktop app's next poll — a few seconds. It is deliberately NOT persisted:
 * writing it down would defeat hashing it in the first place.
 *
 * The cost is that authorize and claim must be served by the same instance.
 * That holds for local dev and for a single-region deployment; it does NOT hold
 * across a multi-instance deploy, where a claim can land on a different node —
 * which is exactly the case claimPairingCode() handles by burning the pairing
 * and asking the user to click Connect again. If that ever becomes common, the
 * fix is a short-TTL shared cache (or storing an encrypted-at-rest copy on the
 * row), not lengthening this map's life.
 */
const pendingTokens = new Map();
const STASH_TTL_MS = PAIRING_CODE_TTL_MS;

export function stashAuthorizedToken(code, token) {
  const key = hashToken(code);
  sweepStash();
  pendingTokens.set(key, { token, expiresAt: Date.now() + STASH_TTL_MS });
}

function takeAuthorizedToken(codeHash) {
  sweepStash();
  const entry = pendingTokens.get(codeHash);
  if (!entry) return "";
  pendingTokens.delete(codeHash);
  return entry.token;
}

function sweepStash() {
  const now = Date.now();
  for (const [key, entry] of pendingTokens) {
    if (entry.expiresAt <= now) pendingTokens.delete(key);
  }
}

/** Housekeeping: drop codes that can never be used again. Best-effort. */
export async function purgeDeadPairingCodes(supabase) {
  const cutoff = new Date(Date.now() - PAIRING_CODE_TTL_MS).toISOString();
  await supabase.from("agent_pairing_codes").delete().lt("expires_at", cutoff);
}

/**
 * WHICH SPACE does this signed-in human connect their Mac to?
 *
 * ── THE AMBIGUITY, stated plainly, because it is a decision and not a detail.
 * `agent_spaces.owner_user_id` exists in migration 0004 but NOTHING HAS EVER
 * WRITTEN IT. Agent spaces are created by scripts/agent-space-create.mjs, which
 * does not set an owner. So today, "the signed-in user's office" is not a thing
 * the database can answer, and the authorize page has to decide.
 *
 * Three options, and why this one:
 *
 *   (a) owner_user_id only. Correct, and resolves to nothing for every space
 *       that exists right now — the human still cannot pair. Useless.
 *   (b) let the user type a slug. Any signed-in account could then mint an
 *       ingest token for anyone's office. Not shippable.
 *   (c) what this does. Prefer spaces the user already owns; otherwise ADOPT an
 *       unowned space whose slug equals the user's public_profiles.handle.
 *
 * The adoption rule leans on handles being globally unique and bound to one
 * account, and on /office/<handle> already being the address an office is
 * published under — so a space named after your handle is yours in every sense
 * the product already recognises. It only ever fires when the space has NO
 * owner, so it can never take a space from someone.
 *
 * This is the one judgement call in the card and it is deliberately a single
 * function: if the owner wants adoption gone, delete adoptSpaceByHandle() and
 * this falls back to (a). Flagged in the report.
 */
export async function resolvePairableSpace(supabase, { userId }) {
  if (!userId) return { status: "unauthenticated" };

  const { data: owned, error: ownedError } = await supabase
    .from("agent_spaces")
    .select("id, slug, name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (ownedError) throw ownedError;
  if (owned?.length) return { status: "ok", space: owned[0], spaces: owned };

  const adopted = await adoptSpaceByHandle(supabase, userId);
  if (adopted) return { status: "ok", space: adopted, spaces: [adopted], adopted: true };

  return { status: "no-space" };
}

/**
 * Claim an ownerless space whose slug is this user's handle.
 *
 * The `.is("owner_user_id", null)` on the UPDATE is the safety property, and it
 * is a condition of the write rather than a check before it: two tabs racing
 * cannot both adopt, and a space that gained an owner between the read and the
 * write is left alone.
 */
async function adoptSpaceByHandle(supabase, userId) {
  const { data: profile, error: profileError } = await supabase
    .from("public_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError || !profile?.handle) return null;

  const { data, error } = await supabase
    .from("agent_spaces")
    .update({ owner_user_id: userId })
    .eq("slug", profile.handle)
    .is("owner_user_id", null)
    .select("id, slug, name")
    .maybeSingle();
  if (error) return null;
  return data || null;
}

/** The paired machines on a space, for a "Disconnect this Mac" list. */
export async function listDeviceTokens(supabase, { spaceId }) {
  const { data, error } = await supabase
    .from("agent_device_tokens")
    .select("id, device_name, created_at, last_seen_at, revoked_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** REVOCABLE, the whole point: kills one machine and nothing else. */
export async function revokeDeviceToken(supabase, { deviceTokenId, spaceId }) {
  const { data, error } = await supabase
    .from("agent_device_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceTokenId)
    .eq("space_id", spaceId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
