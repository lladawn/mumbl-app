import { notFound } from "next/navigation";
import CancelBooking from "../../../../src/components/cal/CancelBooking";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import {
  loadBookingByCancelToken,
  loadEventTypeById,
  loadHostById,
} from "../../../../src/server/bookingDesk";
import { formatInstant } from "../../../../src/server/bookingEmails";
import { cleanString } from "../../../../src/server/validation";

export const dynamic = "force-dynamic";
// an unguessable token in the URL is the credential; keep it out of indexes
export const metadata = { title: "Your booking — mumbl", robots: { index: false, follow: false } };

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = cleanString(token, 200);

  const supabase = getSupabaseAdmin();
  const booking = await loadBookingByCancelToken(supabase, clean);
  if (!booking) notFound();

  const [host, eventType] = await Promise.all([
    loadHostById(supabase, booking.host_id),
    loadEventTypeById(supabase, booking.event_type_id),
  ]);
  if (!host || !eventType) notFound();

  // the invitee's own zone if they gave one at booking time, else the host's —
  // showing a time on nobody's clock is the classic booking-tool failure
  const zone = booking.invitee.timezone || host.timezone;

  return (
    <main className="cal-page pixel-screen">
      <header className="cal-header">
        <p className="cal-office">{host.office_name}</p>
        <h1>{eventType.title}</h1>
        <p className="cal-meta">
          with {host.display_name} · {eventType.duration_minutes} min · {eventType.location_note}
        </p>
      </header>

      <CancelBooking
        token={clean}
        when={formatInstant(Date.parse(booking.starts_at), zone)}
        alreadyCancelled={booking.status === "cancelled"}
      />
    </main>
  );
}
