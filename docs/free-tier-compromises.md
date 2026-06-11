# Free-Tier Compromises

Mumbl is currently optimized to run on free-tier infrastructure where practical. That means we prefer simple request/response flows, daily or weekly scheduled work, and server-mediated Supabase access over paid background workers or always-on realtime services.

## Current Assumptions

- Vercel Hobby is the default deployment target.
- Supabase free tier is the default database target.
- Vercel Cron on Hobby should be treated as daily-or-less scheduling. The existing weekly heartbeat cron fits this.
- Features should work without paid queues, paid realtime, external schedulers, or long-running workers.

Sources checked on May 18, 2026:
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel limits](https://vercel.com/docs/v2/platform/limits)

## Side Quests

Current beta compromise:
- Uses polling instead of Supabase Realtime.
- Uses opportunistic cleanup on write actions instead of a frequent cleanup cron.
- Stores tiny-room messages encrypted at rest with `MUMBL_SIDE_QUEST_ENCRYPTION_KEY`, not true end-to-end encryption.
- Keeps only minimal report metadata and does not store plaintext transcripts for moderation.
- Rate-limits card creation, card pickup, and tiny-room messages through the existing Supabase `rate_limits` table.

Why:
- Frequent cleanup cron jobs do not fit the free-tier posture.
- Realtime adds complexity and may become a paid-tier pressure point.
- Server-side encryption protects raw database reads while keeping implementation and reporting manageable for beta.

Future improvements:
- Add a daily cleanup endpoint to the existing cron surface if expired Side Quest rows become noisy.
- Move tiny-room updates to Supabase Realtime or a managed websocket service if polling becomes visibly laggy or expensive.
- Add a creator-only report review workflow that shows metadata, not message bodies by default.
- Consider true end-to-end encryption only if Side Quests becomes a core private-chat surface and moderation tradeoffs are accepted.
- Add stronger automated coverage around race conditions once the feature graduates from beta.

## Heartbeats

Current compromise:
- One weekly Vercel cron generates heartbeats.
- No separate queue worker or frequent retry job.

Future improvements:
- Move heartbeat generation to a durable queue if the number of spaces grows beyond what one scheduled function can process reliably.
- Add retry/backoff workers on a paid tier.

## Explore

Current compromise:
- Explore reads aggregate data directly from Supabase on request.
- No separate materialized analytics pipeline.

Future improvements:
- Use daily culture snapshots once public-space volume grows.
- Generate public culture summaries in a scheduled job instead of on-demand reads.

## Dump

Current compromise:
- Per-entry AI reflection uses a deterministic local reflector in the route handler, not an external AI provider.
- Team field-note drafting uses OpenAI only when the user clicks draft, sends selected dumps only, caps selection size, and rate-limits drafts per session with `OPENAI_MAX_DAILY_DRAFTS`.
- The private map is rendered from the user's fetched dump text in the browser, with no weekly insight cron yet.
- Team reads reuse the existing posts infrastructure, but only for approved `field_note` posts. Raw dumps are blocked from reads.

Why:
- External AI calls and weekly insight jobs would add cost, secrets, and retry behavior before the core private dump loop is proven.
- The v1 promise is explicit visibility control and low-cost drafting, not model quality.

Future improvements:
- Add provider-backed reflection behind an opt-in toggle once budget and privacy copy are settled.
- Generate `dump_insights` weekly for users with enough dumps, using a daily-or-weekly cron posture compatible with the current free-tier lane.

## Slack Beta

Current compromise:
- Slack is free during beta. There is no 30-day countdown, no credit card, and no usage gate.
- The beta supports only explicit user actions: `/mumbl [text]` and the `save_to_mumbl` message shortcut.
- `/mumbl room [team name]` can create a Mumbl room from Slack with an expiring creator handoff link. `/mumbl start [team name]` remains an alias.
- App Home can create private dumps and draft a field note from selected recent private dumps. Drafting uses the existing field-note OpenAI daily limit, and publishing still requires review in Mumbl.
- The Slack app requests `commands`, `users:read`, and `users:read.email` only. It does not request channel history or message history scopes.
- Team-read posting to Slack is optional per room. When a creator enables it, Mumbl asks for an optional `chat:write` and `groups:write` permission upgrade only so it can create one private channel and post published team reads.
- Slack daily check-in reminders are deferred because a 15-minute scheduler does not fit the free-tier posture.

Future improvements:
- Add pricing and workspace plan gates after beta usage proves the integration is worth charging for.
- Add opt-in daily reminders only if the scheduling/cost tradeoff is explicitly approved.
