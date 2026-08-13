import { badRequest, notFound, ok, rateLimited, serverError } from "../../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../../src/server/supabase";
import { getServerEnv } from "../../../../../src/server/env";
import { enforceRateLimit } from "../../../../../src/server/rateLimit";
import { cleanString } from "../../../../../src/server/validation";
import { createBooking, loadEventType, loadHostBySlug } from "../../../../../src/server/bookingDesk";
import { findOpenSlot } from "../../../../../src/server/bookingSlots";
import { isLikelyEmail } from "../../../../../src/server/email";
import { sendBookingConfirmation } from "../../../../../src/server/bookingEmails";
import { isValidTimeZone } from "../../../../../src/server/timezones";

/**
 * Hold a slot.
 *
 *   POST /api/cal/disha/book
 *   { eventType, start, name, email, note, timezone }
 *
 * The client is never trusted about availability: the open set is re-derived
 * here and any start outside it is refused, whatever the page was showing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const supabase = getSupabaseAdmin();

    const host = await loadHostBySlug(supabase, cleanString(handle, 64).toLowerCase());
    if (!host) return notFound("no booking desk at that handle");

    // before any of the real work, so an open link cannot be used to burn
    // database time or mail quota
    await enforceRateLimit({ supabase, action: "booking_create", sessionToken: `booking:${host.slug}` });

    const body = await request.json().catch(() => null);
    if (!body) return badRequest("body must be json");

    const eventType = await loadEventType(supabase, host.id, cleanString(body.eventType, 64) || undefined);
    if (!eventType) return notFound("no bookable call type");

    const name = cleanString(body.name, 80);
    const email = cleanString(body.email, 160).toLowerCase();
    const note = cleanString(body.note, 500) || null;
    const timezone = cleanString(body.timezone, 64);

    if (!name) return badRequest("name is required");
    if (!isLikelyEmail(email)) return badRequest("a reachable email is required");

    const startMs = Date.parse(cleanString(body.start, 40));
    if (!Number.isFinite(startMs)) return badRequest("start must be an ISO timestamp");

    const slot = await findOpenSlot({ supabase, host, eventType, startMs });
    if (!slot) return conflict("that time is no longer open");

    const endMs = Date.parse(slot.end);
    const created = await createBooking(supabase, {
      host,
      eventType,
      startMs,
      endMs,
      invitee: {
        name,
        email,
        note,
        timezone: isValidTimeZone(timezone) ? timezone : null,
      },
    });
    // lost the race against another visitor between the check and the insert
    if (!created) return conflict("that time was just taken");

    const cancelUrl = `${getServerEnv().appUrl}/cal/b/${created.cancelToken}`;

    // a confirmed booking stays confirmed even if the mail fails; the response
    // says so rather than pretending, and the slot is not given back
    const delivery = await sendBookingConfirmation({
      bookingId: created.id,
      host,
      invitee: { name, email, note: note || undefined, timezone: timezone || undefined },
      title: eventType.title,
      locationNote: eventType.location_note,
      startMs,
      endMs,
      cancelUrl,
    });

    return ok({
      booked: true,
      start: slot.start,
      end: slot.end,
      cancelUrl,
      emailed: delivery.invitee.sent,
      emailProblem: delivery.invitee.sent ? undefined : delivery.invitee.reason,
    });
  } catch (error: any) {
    if (error?.status === 429) return rateLimited("this desk is taking too many bookings right now");
    return serverError(error);
  }
}

function conflict(message: string) {
  return Response.json({ error: message, code: "slot_taken" }, { status: 409 });
}
