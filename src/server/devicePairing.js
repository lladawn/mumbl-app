import { decryptContentFields, encryptContentFields } from "./encryption";
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
      // Encrypted at rest, because the claim will be served by a DIFFERENT
      // Vercel lambda than this authorize. See the column comment in 0010.
      encrypted_payload: encryptContentFields("agent_pairing_codes", { device_token: token }),
    })
    .eq("id", row.id)
    .is("claimed_at", null);
  if (bindError) throw bindError;

  return { status: "ok", deviceTokenId: deviceToken.id };
}

/**
 * The desktop app collecting its token. Unauthenticated by design.
 *
 * Returns one of the three states pairing.rs polls for:
 *   { state: "authorized", token, slug }  → 200
 *   { state: "pending" }                  → 202
 *   { state: "invalid" }                  → 404 (unknown / expired / spent)
 *
 * The token comes off the row, decrypted. It is wiped in the same guarded
 * update that marks the code spent, so a successful claim both hands the token
 * over and destroys the only copy of it, atomically.
 */
export async function claimPairingCode(supabase, { code }) {
  const codeHash = hashToken(code);

  const { data: row, error } = await supabase
    .from("agent_pairing_codes")
    .select("id, expires_at, authorized_at, claimed_at, space_id, device_token_id, encrypted_payload")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;

  if (!row) return { state: "invalid", reason: "unknown" };
  if (row.claimed_at) return { state: "invalid", reason: "already used" };
  if (Date.parse(row.expires_at) <= Date.now()) return { state: "invalid", reason: "expired" };
  if (!row.authorized_at) return { state: "pending" };

  // Single-use AND wipe, in one guarded write: stamp claimed_at only if it is
  // still null, and blank the ciphertext at the same time. Two racing polls
  // cannot both win, and the loser never returns what it read.
  const { data: claimed, error: claimError } = await supabase
    .from("agent_pairing_codes")
    .update({ claimed_at: new Date().toISOString(), encrypted_payload: {} })
    .eq("id", row.id)
    .is("claimed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { state: "invalid", reason: "already used" };

  const token = decryptContentFields("agent_pairing_codes", row, ["device_token"]).device_token || "";
  if (!token) {
    // Authorized, but the row carries no token — a partially-applied write, or
    // a content key that has rotated since. Unrecoverable either way, so burn
    // the pairing rather than leave the helper polling a code that can never
    // produce anything.
    await burnPairing(supabase, row);
    return { state: "invalid", reason: "authorization could not be completed — pair again" };
  }

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
 * Housekeeping: drop codes that can never be used again, and revoke any device
 * token that was authorized but never collected.
 *
 * The second half matters. An authorized-but-unclaimed pairing leaves a live
 * device token that NOBODY holds the plaintext of — harmless in itself, but it
 * is a valid credential sitting in the table, and "valid credential nobody is
 * using" is exactly the thing a device list is supposed to never contain.
 */
export async function purgeDeadPairingCodes(supabase) {
  const cutoff = new Date(Date.now() - PAIRING_CODE_TTL_MS).toISOString();

  const { data: dead } = await supabase
    .from("agent_pairing_codes")
    .select("device_token_id")
    .lt("expires_at", cutoff)
    .is("claimed_at", null)
    .not("device_token_id", "is", null);

  const orphaned = (dead || []).map((r) => r.device_token_id).filter(Boolean);
  for (const id of orphaned) {
    await supabase
      .from("agent_device_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("revoked_at", null);
  }

  await supabase.from("agent_pairing_codes").delete().lt("expires_at", cutoff);
  return { codes: (dead || []).length, revoked: orphaned.length };
}

/**
 * WHICH SPACE does this signed-in human connect their Mac to?
 *
 * Spaces the user OWNS. Nothing else.
 *
 * ── WHY THERE IS NO FALLBACK, so nobody adds one back.
 * `agent_spaces.owner_user_id` has existed since migration 0004 and nothing has
 * ever written it — spaces come from scripts/agent-space-create.mjs, which does
 * not set an owner. That makes "no owned space" the common case today, which is
 * a strong pull towards inferring ownership from something else. Resist it.
 *
 * The obvious inference — adopt an ownerless space whose slug matches the
 * user's public_profiles.handle — was implemented here and REMOVED, because it
 * is a privilege escalation. app/api/public-profiles POST lets any signed-in
 * user pick an arbitrary handle, and its uniqueness check runs against
 * public_profiles only; it never consults agent_spaces.slug. So a stranger can
 * register the handle matching an unowned space's slug, click Connect, and walk
 * away with a working ingest token for someone else's office. Every unowned
 * space whose slug is not already a taken handle is squattable.
 *
 * Guarding the adoption UPDATE with `.is("owner_user_id", null)` does NOT fix
 * this — that guard stops two tabs racing, which is a different problem.
 *
 * Ownership is therefore established EXPLICITLY, out of band:
 * scripts/agent-space-bind-owner.mjs. An office that has not been bound shows
 * "no office yet" on /pair, which is the honest answer.
 */
export async function resolvePairableSpace(supabase, { userId }) {
  if (!userId) return { status: "unauthenticated" };

  const { data: owned, error } = await supabase
    .from("agent_spaces")
    .select("id, slug, name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (owned?.length) return { status: "ok", space: owned[0], spaces: owned };

  return { status: "no-space" };
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
