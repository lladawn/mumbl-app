#!/usr/bin/env node
/**
 * Regression test for src/server/timezones.ts.
 *
 * Everything the booking desk offers is derived from these functions: an
 * availability rule is host-local minutes, and turning that into a real instant
 * is the one place a subtle bug would quietly offer people the wrong hour twice
 * a year. Node runs the .ts file directly via type stripping.
 *
 * Scope note: this covers the timezone maths only. Slot generation itself
 * (src/server/bookingSlots.ts) imports its siblings extensionlessly for the
 * Next bundler, which plain Node ESM cannot resolve, so it is verified against
 * a running app instead — see docs/booking-desk.md.
 *
 *   npm run booking:test
 */

import {
  dateKeyInZone,
  dateKeysInRange,
  isValidTimeZone,
  weekdayOfDateKey,
  zoneOffsetMs,
  zonedWallTimeToUtcMs,
} from "../src/server/timezones.ts";

let failures = 0;

function check(label, actual, expected) {
  const passed = actual === expected;
  if (!passed) failures += 1;
  console.log(`${passed ? "  ok  " : "  FAIL"} ${label}${passed ? "" : `\n         got ${actual}\n         want ${expected}`}`);
}

const at = (dateKey, minutes, zone) => new Date(zonedWallTimeToUtcMs(dateKey, minutes, zone)).toISOString();

console.log("\noffsets");
check("Kolkata is +5:30 in August", zoneOffsetMs(Date.UTC(2026, 7, 11), "Asia/Kolkata"), 5.5 * 3600_000);
check("Kolkata is +5:30 in January too", zoneOffsetMs(Date.UTC(2026, 0, 11), "Asia/Kolkata"), 5.5 * 3600_000);
check("New York is -5 in winter", zoneOffsetMs(Date.UTC(2026, 0, 15, 17), "America/New_York"), -5 * 3600_000);
check("New York is -4 in summer", zoneOffsetMs(Date.UTC(2026, 6, 15, 17), "America/New_York"), -4 * 3600_000);

console.log("\ncalendar days follow the local clock, not UTC");
check("19:00 UTC is already tomorrow in Kolkata", dateKeyInZone(Date.UTC(2026, 7, 11, 19), "Asia/Kolkata"), "2026-08-12");
check("02:00 UTC is still yesterday in New York", dateKeyInZone(Date.UTC(2026, 7, 11, 2), "America/New_York"), "2026-08-10");
check("2026-08-11 is a Tuesday", weekdayOfDateKey("2026-08-11"), 2);
check(
  "a range spans local days",
  dateKeysInRange(Date.UTC(2026, 7, 11, 19), Date.UTC(2026, 7, 13, 19), "Asia/Kolkata").join(","),
  "2026-08-12,2026-08-13,2026-08-14",
);

console.log("\nwall clock to instant");
check("10:00 in Kolkata", at("2026-08-11", 600, "Asia/Kolkata"), "2026-08-11T04:30:00.000Z");
check("09:00 in Kathmandu (+5:45)", at("2026-08-11", 540, "Asia/Kathmandu"), "2026-08-11T03:15:00.000Z");

console.log("\nthe test that matters: 10:00 stays 10:00 across DST");
check("10:00 in New York, summer", at("2026-07-15", 600, "America/New_York"), "2026-07-15T14:00:00.000Z");
check("10:00 in New York, winter", at("2026-01-15", 600, "America/New_York"), "2026-01-15T15:00:00.000Z");
check("the day before spring forward", at("2026-03-07", 600, "America/New_York"), "2026-03-07T15:00:00.000Z");
check("the day after spring forward", at("2026-03-09", 600, "America/New_York"), "2026-03-09T14:00:00.000Z");
check("09:00 in Adelaide (+9:30), July", at("2026-07-15", 540, "Australia/Adelaide"), "2026-07-14T23:30:00.000Z");
check("09:00 in Adelaide (+10:30), January", at("2026-01-15", 540, "Australia/Adelaide"), "2026-01-14T22:30:00.000Z");

console.log("\nthe two hours that do not behave");
// 02:30 on 2026-03-08 never happens in New York; resolve forward like every
// other scheduling tool rather than silently landing an hour early
check("a time inside the spring-forward gap moves forward", at("2026-03-08", 150, "America/New_York"), "2026-03-08T07:30:00.000Z");
// 01:30 on 2026-11-01 happens twice; take the first
check("an ambiguous time takes the first pass", at("2026-11-01", 90, "America/New_York"), "2026-11-01T05:30:00.000Z");
check("the rest of the fall-back day is unaffected", at("2026-11-01", 600, "America/New_York"), "2026-11-01T15:00:00.000Z");

console.log("\nzone validation");
check("a real zone", isValidTimeZone("Europe/London"), true);
check("a made-up zone", isValidTimeZone("Middle/Earth"), false);

console.log(failures ? `\n${failures} failed\n` : "\nall passed\n");
process.exit(failures ? 1 : 0);
