import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../src/server/auth";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { cleanString } from "../../../../../src/server/validation";
import {
  authorizePairingCode,
  normalizeDeviceName,
  normalizePairingCode,
  registerPairingCode,
  resolvePairableSpace,
} from "../../../../../src/server/devicePairing";

/**
 * The browser half of pairing: "Connect <device> to <space>?" → yes.
 *
 *   GET  ?code=…&name=…   what is asking, and which space it would join.
 *                         Registers the pending code so a poll gets 202 rather
 *                         than 404 while the human is still reading the page.
 *   POST { code, name }   authorize it: mint a device-scoped token and bind it.
 *
 * BOTH REQUIRE A SIGNED-IN USER. This is the only point in the flow where a
 * human is present, so it is the only place entitlement can be established —
 * `resolvePairableSpace` decides which space this account may connect a machine
 * to, and the code is bound to that answer. The desktop app never names a space
 * and could not be believed if it did.
 *
 * Auth is the existing mechanism (resolveRequestOwner + a Supabase access token
 * as a bearer), so nothing new was invented for this.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = normalizePairingCode(url.searchParams.get("code"));
    const deviceName = normalizeDeviceName(url.searchParams.get("name"));
    if (!code) return badRequest("code is required");

    const owner = await resolveRequestOwner({ request, sessionToken: "" });
    if (!owner.userId) return unauthorized();

    const supabase = getSupabaseAdmin();
    const target = await resolvePairableSpace(supabase, { userId: owner.userId });
    if (target.status === "no-space") {
      return ok({ deviceName, space: null, reason: "no-space" });
    }

    // Register BEFORE the human decides. Otherwise the app polls a code the
    // server has never heard of and gets 404 → "expired" → it stops polling
    // while the authorize page is still sitting open in front of the user.
    const pending = await registerPairingCode(supabase, { code, deviceName });

    return ok({
      deviceName: pending.device_name || deviceName,
      expiresAt: pending.expires_at,
      alreadyAuthorized: Boolean(pending.authorized_at),
      alreadyClaimed: Boolean(pending.claimed_at),
      space: { slug: target.space.slug, name: target.space.name },
      adopted: Boolean(target.adopted),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest("body must be json");

    const code = normalizePairingCode(body.code);
    if (!code) return badRequest("code is required");
    const deviceName = normalizeDeviceName(cleanString(body.name, 80));

    const owner = await resolveRequestOwner({ request, sessionToken: "" });
    if (!owner.userId) return unauthorized();

    const supabase = getSupabaseAdmin();
    const target = await resolvePairableSpace(supabase, { userId: owner.userId });
    if (target.status === "no-space") {
      return Response.json({ error: "no office to connect to" }, { status: 409 });
    }

    // Registering here too: a POST can arrive without the GET having run (a
    // retry, a client that skipped the preflight) and authorize() needs a row.
    await registerPairingCode(supabase, { code, deviceName });

    const result = await authorizePairingCode(supabase, {
      code,
      spaceId: target.space.id,
      userId: owner.userId,
      deviceName,
    });

    if (result.status === "unknown") return Response.json({ error: "unknown code" }, { status: 404 });
    if (result.status === "expired") return Response.json({ error: "this code expired — click Connect again" }, { status: 410 });
    if (result.status === "spent") return Response.json({ error: "this code was already used" }, { status: 409 });

    // The token is already on the row, encrypted — the claim will be served by
    // a different lambda, so there is nothing to hand over in-process here.

    return ok({
      authorized: true,
      space: { slug: target.space.slug, name: target.space.name },
      deviceName,
    });
  } catch (error) {
    return serverError(error);
  }
}

function unauthorized() {
  return Response.json({ error: "sign in to connect a device" }, { status: 401 });
}

export const dynamic = "force-dynamic";
