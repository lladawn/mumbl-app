# Booking desk (`/cal/[handle]`)

A Calendly-shaped booking link with a pixel office in front of it. A stranger
opens `mumbl.wtf/cal/disha`, walks into DUSK & DAWN, the receptionist offers the
times that are genuinely open, and both sides get an email with a calendar
invite.

It exists because the pixel world needed one job that is real. Everyone already
knows what a booking link does, so the room adds character without adding
confusion, and every visitor is someone completing an actual task rather than
skimming a marketing page.

## Shape

| Piece | Where |
| --- | --- |
| Schema | `supabase/migrations/0006_booking_desk.sql` |
| Timezone maths | `src/server/timezones.ts` |
| Slot generation | `src/server/bookingSlots.ts` |
| Calendar seam | `src/server/calendarProvider.ts` |
| Data access | `src/server/bookingDesk.ts` |
| Invite + mail | `src/server/ics.ts`, `src/server/email.ts`, `src/server/bookingEmails.ts` |
| API | `app/api/cal/[handle]/slots`, `app/api/cal/[handle]/book`, `app/api/cal/bookings/[token]/cancel` |
| Pages | `app/cal/[handle]/page.tsx`, `app/cal/b/[token]/page.tsx` |
| Room | `public/cal/office-scene.js`, `src/components/cal/OfficeScene.tsx` |
| Flow UI | `src/components/cal/SlotPicker.tsx`, `src/lib/cal/receptionist.ts` |
| Provisioning | `scripts/cal-host-create.mjs` |

## Decisions worth knowing

**Availability is two layers, and only one is built.** Calendly is (1) a
schedule you configure and (2) busy events subtracted from it by a connected
calendar. `booking_rules` is layer 1. Layer 2 lives behind
`calendarProvider.getBusyBlocks()`, which currently returns `[]` — slot
generation already subtracts it, so adding Google is a new implementation of one
function, not a reshape. See "Connecting a real calendar" below.

**The client is never trusted about availability.** `POST /book` re-derives the
open set through the same `listOpenSlots` the page used and refuses any start
that is not in it, whatever the browser was showing.

**Double booking is prevented by a constraint, not a check.** Two people can
submit the same slot in the same millisecond, so the guard is a partial unique
index on `(host_id, starts_at) where status = 'confirmed'`. The route catches
`23505` and returns 409. It is partial so that cancelling genuinely frees the
slot.

**Invitee details are encrypted at rest.** Name, email, note and timezone go
through `encryptContentFields` into `bookings.encrypted_payload`, the same way
post content and agent tasks do. This is PII arriving on a public endpoint.

**Mail never fails a booking.** A confirmed row stays confirmed even if Resend
is down; the API returns `emailed: false` with the reason and the page tells the
visitor the truth instead of silently dropping their slot.

**The receptionist is not a model.** Lines come from seeded pools in
`src/lib/cal/receptionist.ts`. A public URL that calls an LLM per visitor is a
cost centre and a prompt-injection surface, and a model cannot invent a time
that is not open if it is never asked.

**The room is optional; the booking is not.** Phaser is 1.18 MB vendored in
`public/`, loaded only after paint. `?classic=1`, `prefers-reduced-motion`, a
failed script load and any canvas-less browser all fall through to the plain
slot list, which is server-rendered and works with no JavaScript beyond the
form. The dialogue is HTML on top of the canvas, never drawn into it, so it is
selectable, focusable and screen-reader navigable.

**Mobile gets the same room, not a lesser one.** The visitor sprite auto-walks
to the desk on load, so touching nothing still opens the conversation; tapping
the floor walks there, which is one control scheme for mouse and touch alike;
below 768px the camera follows the visitor in a portrait viewport instead of
letterboxing a landscape room.

**Rate limiting is per link, not per session.** `booking_create` (20/hour) is
keyed on the host slug, because an unauthenticated public endpoint that sends
mail needs a ceiling that a visitor cannot reset by clearing storage.

## Setting one up

```bash
npm run db:status   # confirm which Supabase project is linked
npm run db:push
```

```bash
node scripts/cal-host-create.mjs --slug disha --name "Disha Agarwalla" --office "DUSK & DAWN" --email you@example.com --tz Asia/Kolkata --hours 10-18
```

That creates the host, a 30-minute "intro" call type, Mon–Fri availability, and
prints the booking link plus a manage token (shown once). Adjust hours, add
blackouts, or add more event types with SQL against `booking_rules`,
`booking_blackouts` and `booking_event_types` until there is an owner UI.

## Email setup

Add a domain in Resend, add the three DNS records it gives you for `mumbl.wtf`,
then set:

```
RESEND_API_KEY=...
MUMBL_BOOKING_FROM="DUSK & DAWN <desk@mumbl.wtf>"
```

Free tier is 3,000/month and 100/day, well above what a personal booking link
uses. There is no npm package: `src/server/email.ts` is a raw `fetch`, the same
posture as `src/server/insights.js` calling Anthropic.

## Testing

```bash
npm run booking:test
```

Covers `src/server/timezones.ts` — offsets, local calendar days, and the two
hours a year that misbehave (the spring-forward gap resolves forward; an
ambiguous fall-back hour takes the first pass). This is the module most likely
to be subtly wrong and hardest to eyeball.

Slot generation is not in that script: `bookingSlots.ts` imports its siblings
extensionlessly for the Next bundler, which plain Node ESM cannot resolve. Verify
it against a running app instead — book a slot, confirm it disappears from
`GET /api/cal/<handle>/slots`, replay the same POST and expect a 409, then cancel
and confirm it comes back.

## Custom domain

`mumbl.wtf/cal/disha` needs no DNS at all. `cal.mumbl.wtf` is also free — extra
subdomains are allowed on every Vercel plan (Hobby caps at 50 domains per
project) and would need one Vercel domain plus a host rewrite here. Only a
*wildcard* (`*.mumbl.wtf`, for per-person subdomains) requires Pro.

## Connecting a real calendar (not built)

Implement `getBusyBlocks` against Google's FreeBusy API and write the confirmed
call back with `calendar.events`. Store the refresh token on `booking_hosts`
encrypted via `src/server/encryption.js`.

The thing to decide before starting: a Google Cloud app left in *Testing* mode
issues refresh tokens that expire after 7 days, which is fine for development
and useless for a link left up. Either publish the app (verification review is
required for the calendar scope), restrict it to a Workspace org as an internal
app (no review), or accept reconnecting regularly.

Rejected: a calendar's secret iCal address needs no OAuth, but Google refreshes
that feed on its own slow schedule — sometimes hours — which makes it unsafe for
conflict checking.
