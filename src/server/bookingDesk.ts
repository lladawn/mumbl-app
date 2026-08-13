/**
 * Data access for the booking desk. Every write here runs with the service
 * role from a route handler — there are no client-side Supabase writes.
 */

import { createToken, hashToken } from "./hash";
import { decryptContentFields, encryptContentFields } from "./encryption";
import type { BookingEventType, BookingHost } from "./bookingSlots";

export type BookingHostRow = BookingHost & {
  display_name: string;
  office_name: string;
  receptionist_name: string;
  look: Record<string, string>;
  notify_email: string;
};

export type InviteeDetails = { name: string; email: string; note: string | null; timezone: string | null };

const HOST_COLUMNS = "id, slug, display_name, office_name, receptionist_name, timezone, look, notify_email";
const EVENT_TYPE_COLUMNS =
  "id, slug, title, duration_minutes, buffer_minutes, min_notice_minutes, max_days_ahead, location_note";

export async function loadHostBySlug(supabase: any, slug: string): Promise<BookingHostRow | null> {
  const { data, error } = await supabase
    .from("booking_hosts")
    .select(HOST_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** A cancel link knows the booking, not the handle, so it looks both up by id. */
export async function loadHostById(supabase: any, hostId: string): Promise<BookingHostRow | null> {
  const { data, error } = await supabase
    .from("booking_hosts")
    .select(HOST_COLUMNS)
    .eq("id", hostId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function loadEventTypeById(
  supabase: any,
  eventTypeId: string,
): Promise<BookingEventType | null> {
  const { data, error } = await supabase
    .from("booking_event_types")
    .select(EVENT_TYPE_COLUMNS)
    .eq("id", eventTypeId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function loadEventType(
  supabase: any,
  hostId: string,
  slug?: string,
): Promise<BookingEventType | null> {
  let query = supabase
    .from("booking_event_types")
    .select(EVENT_TYPE_COLUMNS)
    .eq("host_id", hostId)
    .eq("active", true);

  // no slug means "the default one", which is simply the first created — stage
  // 1 shows a single event type, so this stays a lookup rather than a picker
  query = slug ? query.eq("slug", slug).maybeSingle() : query.order("created_at").limit(1).maybeSingle();

  const { data, error } = await query;
  if (error) throw error;
  return data || null;
}

/**
 * Insert a confirmed booking.
 *
 * Returns null when the slot was taken between the availability check and this
 * write — the partial unique index on (host_id, starts_at) is what actually
 * prevents a double booking, so a 23505 here is an expected outcome, not a bug.
 */
export async function createBooking(
  supabase: any,
  {
    host,
    eventType,
    startMs,
    endMs,
    invitee,
  }: {
    host: BookingHostRow;
    eventType: BookingEventType;
    startMs: number;
    endMs: number;
    invitee: InviteeDetails;
  },
): Promise<{ id: string; cancelToken: string } | null> {
  const cancelToken = createToken();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      host_id: host.id,
      event_type_id: eventType.id,
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      status: "confirmed",
      encrypted_payload: encryptContentFields("bookings", {
        invitee_name: invitee.name,
        invitee_email: invitee.email,
        note: invitee.note,
        invitee_timezone: invitee.timezone,
      }),
      cancel_token_hash: hashToken(cancelToken),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }

  return { id: data.id, cancelToken };
}

export async function loadBookingByCancelToken(supabase: any, token: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, host_id, event_type_id, starts_at, ends_at, status, encrypted_payload")
    .eq("cancel_token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { ...data, invitee: readInvitee(data) };
}

export async function cancelBooking(supabase: any, bookingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");
  if (error) throw error;

  // empty means it was already cancelled; the caller treats that as success
  return (data || []).length > 0;
}

export function readInvitee(row: { encrypted_payload?: unknown }): InviteeDetails {
  const decrypted = decryptContentFields("bookings", row as any, [
    "invitee_name",
    "invitee_email",
    "note",
    "invitee_timezone",
  ]) as Record<string, string | null>;

  return {
    name: decrypted.invitee_name || "someone",
    email: decrypted.invitee_email || "",
    note: decrypted.note || null,
    timezone: decrypted.invitee_timezone || null,
  };
}
