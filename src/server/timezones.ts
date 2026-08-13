/**
 * IANA timezone maths on top of Intl, because this repo has no date library
 * and is not adding one.
 *
 * The whole booking desk depends on one idea: availability rules are stored as
 * *host-local* minutes (Mon 10:00–18:00 means 10:00 for Disha, whatever the
 * offset happens to be that week). So every rule expansion has to convert
 * wall-clock time in a named zone to a real UTC instant, and stay right across
 * DST transitions on both the host's side and the visitor's.
 */

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock reading of a UTC instant in the given zone. */
export function wallPartsInZone(utcMs: number, timeZone: string): WallParts {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Offset of the zone at that instant, in ms (positive east of UTC).
 *
 * Trick: re-read the zone's wall clock as if it were UTC. The difference from
 * the real instant is the offset, DST included, with no table lookups.
 */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = wallPartsInZone(utcMs, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  // seconds are exact on both sides, so the remainder is whole-ms offset
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-08-11" for the zone-local calendar day containing the instant. */
export function dateKeyInZone(utcMs: number, timeZone: string): string {
  const { year, month, day } = wallPartsInZone(utcMs, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 0 = Sunday, matching booking_rules.weekday and Date#getUTCDay. */
export function weekdayOfDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

/**
 * A wall-clock time in a zone -> the UTC instant it names.
 *
 * Two passes: guess with the offset at the naive instant, then correct with the
 * offset at the guess. Then round-trip to check the answer really does read
 * back as the requested wall time — inside a spring-forward gap it cannot,
 * because the named time does not exist, and the correction pass would
 * otherwise silently land an hour *before* what was asked for. There we fall
 * back to the pre-jump offset, which resolves forward across the gap (02:30
 * becomes 03:30) the way every scheduling tool does.
 */
export function zonedWallTimeToUtcMs(dateKey: string, minutesFromMidnight: number, timeZone: string): number {
  const naive = new Date(`${dateKey}T00:00:00.000Z`).getTime() + minutesFromMidnight * 60_000;
  const firstGuess = naive - zoneOffsetMs(naive, timeZone);
  const corrected = naive - zoneOffsetMs(firstGuess, timeZone);

  const readBack = wallPartsInZone(corrected, timeZone);
  const readBackMinutes = readBack.hour * 60 + readBack.minute;
  const wantedMinutes = ((minutesFromMidnight % 1440) + 1440) % 1440;

  return readBackMinutes === wantedMinutes ? corrected : firstGuess;
}

/** Inclusive list of zone-local date keys covering [fromMs, toMs]. */
export function dateKeysInRange(fromMs: number, toMs: number, timeZone: string): string[] {
  const keys: string[] = [];
  let cursor = new Date(`${dateKeyInZone(fromMs, timeZone)}T00:00:00.000Z`).getTime();
  const last = new Date(`${dateKeyInZone(toMs, timeZone)}T00:00:00.000Z`).getTime();

  // walking the key in UTC-day steps is safe: keys are calendar labels here,
  // not instants, so DST cannot shorten one of these iterations
  while (cursor <= last) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }

  return keys;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
