import { notFound, ok, serverError } from "../../../../../../src/server/http";
import { getSupabaseAdmin } from "../../../../../../src/server/supabase";
import { getServerEnv } from "../../../../../../src/server/env";
import { cleanString } from "../../../../../../src/server/validation";
import {
  cancelBooking,
  loadBookingByCancelToken,
  loadEventTypeById,
  loadHostById,
} from "../../../../../../src/server/bookingDesk";
import { sendBookingCancellation } from "../../../../../../src/server/bookingEmails";

/**
 * Call it off.
 *
 *   POST /api/cal/bookings/<cancel token>/cancel
 *
 * The token is the only credential — it is unguessable, stored as an HMAC, and
 * scoped to one booking. Cancelling frees the slot, because the unique index
 * that prevents double booking is partial on status = 'confirmed'.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const booking = await loadBookingByCancelToken(supabase, cleanString(token, 200));
    if (!booking) return notFound("that link does not match a booking");

    if (booking.status === "cancelled") {
      return ok({ cancelled: true, alreadyCancelled: true });
    }

    const changed = await cancelBooking(supabase, booking.id);
    if (!changed) return ok({ cancelled: true, alreadyCancelled: true });

    const [host, eventType] = await Promise.all([
      loadHostById(supabase, booking.host_id),
      loadEventTypeById(supabase, booking.event_type_id),
    ] as const);

    if (host && eventType) {
      await sendBookingCancellation({
        bookingId: booking.id,
        host,
        invitee: {
          name: booking.invitee.name,
          email: booking.invitee.email,
          timezone: booking.invitee.timezone || undefined,
        },
        title: eventType.title,
        locationNote: eventType.location_note,
        startMs: Date.parse(booking.starts_at),
        endMs: Date.parse(booking.ends_at),
        cancelUrl: `${getServerEnv().appUrl}/cal/b/${cleanString(token, 200)}`,
        cancelledBy: "invitee",
      });
    }

    return ok({ cancelled: true });
  } catch (error) {
    return serverError(error);
  }
}
