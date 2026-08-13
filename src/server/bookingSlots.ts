/**
 * Availability -> concrete open slots.
 *
 * This module is the single source of truth for "is this time bookable". The
 * slots endpoint and the book endpoint both go through it, so the browser is
 * never trusted about availability: /book re-derives the set and rejects any
 * start that is not in it.
 */

import { getBusyBlocks, type BusyBlock } from "./calendarProvider";
import { dateKeysInRange, weekdayOfDateKey, zonedWallTimeToUtcMs } from "./timezones";

export type BookingHost = {
  id: string;
  slug: string;
  timezone: string;
};

export type BookingEventType = {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  location_note: string;
};

export type OpenSlot = { start: string; end: string };

type Interval = { startMs: number; endMs: number };

const MAX_WINDOW_DAYS = 62;

export async function listOpenSlots({
  supabase,
  host,
  eventType,
  fromMs,
  toMs,
  nowMs = Date.now(),
}: {
  supabase: any;
  host: BookingHost;
  eventType: BookingEventType;
  fromMs: number;
  toMs: number;
  nowMs?: number;
}): Promise<OpenSlot[]> {
  const earliest = nowMs + eventType.min_notice_minutes * 60_000;
  const latest = nowMs + eventType.max_days_ahead * 86_400_000;

  const windowStart = Math.max(fromMs, earliest);
  const windowEnd = Math.min(toMs, latest, fromMs + MAX_WINDOW_DAYS * 86_400_000);
  if (windowEnd <= windowStart) return [];

  const candidates = expandRules({
    rules: await fetchRules(supabase, host.id),
    host,
    eventType,
    windowStart,
    windowEnd,
  });
  if (!candidates.length) return [];

  // one padded fetch each rather than a query per slot
  const [booked, blackouts, busy] = await Promise.all([
    fetchConfirmedBookings(supabase, host.id, windowStart, windowEnd),
    fetchBlackouts(supabase, host.id, windowStart, windowEnd),
    getBusyBlocks(host, windowStart, windowEnd),
  ]);

  const taken = [...booked, ...blackouts, ...busy];

  return candidates
    .filter((slot) => !taken.some((block) => overlaps(slot, block)))
    .map((slot) => ({
      start: new Date(slot.startMs).toISOString(),
      end: new Date(slot.endMs).toISOString(),
    }));
}

/**
 * Whether an exact start is bookable right now. Used by /book — a slot listed
 * 20 minutes ago may not survive to submit time.
 */
export async function findOpenSlot({
  supabase,
  host,
  eventType,
  startMs,
  nowMs = Date.now(),
}: {
  supabase: any;
  host: BookingHost;
  eventType: BookingEventType;
  startMs: number;
  nowMs?: number;
}): Promise<OpenSlot | null> {
  const durationMs = eventType.duration_minutes * 60_000;
  const slots = await listOpenSlots({
    supabase,
    host,
    eventType,
    // pad by a day either side so the rule containing this start is expanded
    // even when the start sits at a window edge
    fromMs: startMs - 86_400_000,
    toMs: startMs + durationMs + 86_400_000,
    nowMs,
  });

  const wanted = new Date(startMs).toISOString();
  return slots.find((slot) => slot.start === wanted) || null;
}

function expandRules({
  rules,
  host,
  eventType,
  windowStart,
  windowEnd,
}: {
  rules: { weekday: number; start_minute: number; end_minute: number }[];
  host: BookingHost;
  eventType: BookingEventType;
  windowStart: number;
  windowEnd: number;
}): Interval[] {
  const durationMs = eventType.duration_minutes * 60_000;
  const stepMinutes = eventType.duration_minutes + eventType.buffer_minutes;
  const slots: Interval[] = [];

  // a rule can start on the day before the window in the host's zone and still
  // reach into it, so widen the day sweep by one on each side
  const dateKeys = dateKeysInRange(windowStart - 86_400_000, windowEnd + 86_400_000, host.timezone);

  for (const dateKey of dateKeys) {
    const weekday = weekdayOfDateKey(dateKey);

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;

      for (let minute = rule.start_minute; minute + eventType.duration_minutes <= rule.end_minute; minute += stepMinutes) {
        const startMs = zonedWallTimeToUtcMs(dateKey, minute, host.timezone);
        const endMs = startMs + durationMs;
        if (startMs < windowStart || endMs > windowEnd) continue;
        slots.push({ startMs, endMs });
      }
    }
  }

  // rules for the same day may overlap; a slot is one offer, not two
  const byStart = new Map<number, Interval>();
  for (const slot of slots) byStart.set(slot.startMs, slot);

  return [...byStart.values()].sort((a, b) => a.startMs - b.startMs);
}

async function fetchRules(supabase: any, hostId: string) {
  const { data, error } = await supabase
    .from("booking_rules")
    .select("weekday, start_minute, end_minute")
    .eq("host_id", hostId);
  if (error) throw error;
  return data || [];
}

async function fetchConfirmedBookings(
  supabase: any,
  hostId: string,
  fromMs: number,
  toMs: number,
): Promise<Interval[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("host_id", hostId)
    .eq("status", "confirmed")
    .lt("starts_at", new Date(toMs).toISOString())
    .gt("ends_at", new Date(fromMs).toISOString());
  if (error) throw error;

  return (data || []).map((row: { starts_at: string; ends_at: string }) => ({
    startMs: Date.parse(row.starts_at),
    endMs: Date.parse(row.ends_at),
  }));
}

async function fetchBlackouts(
  supabase: any,
  hostId: string,
  fromMs: number,
  toMs: number,
): Promise<Interval[]> {
  const { data, error } = await supabase
    .from("booking_blackouts")
    .select("starts_at, ends_at")
    .eq("host_id", hostId)
    .lt("starts_at", new Date(toMs).toISOString())
    .gt("ends_at", new Date(fromMs).toISOString());
  if (error) throw error;

  return (data || []).map((row: { starts_at: string; ends_at: string }) => ({
    startMs: Date.parse(row.starts_at),
    endMs: Date.parse(row.ends_at),
  }));
}

function overlaps(a: Interval, b: Interval | BusyBlock): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}
