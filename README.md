# mumbl

Say the thing you've been mumbling all week.

Mumbl is an anonymous-first team room for engineers to share the thoughts that usually stay in side chats, heads, or dead Slack channels. The app uses Next.js App Router with modular React components and Supabase-backed API routes for spaces, posts, reactions, and heartbeats.

## Run It

```bash
npm install
npm run app
```

Then open:

```text
http://127.0.0.1:3000/
```

## Project Shape

- `app/` contains Next.js routes: landing, create, explore, room pages, and API handlers.
- `src/components/` contains reusable UI components.
- `src/components/space/` contains room-specific team reads, hidden legacy feed, share, and heartbeat pieces.
- `src/hooks/` contains client-side state hooks.
- `src/lib/` contains product constants, API helpers, storage helpers for session/creator tokens, and heartbeat logic.
- `docs/mumbl-product-context.md` and `docs/mumbl-extension-01.md` are the product source of truth. The extension wins on conflicts.
- `docs/backend-plan.md` is the recommended Supabase/Postgres backend path.

## What Exists

- Landing screen with Mumbl's core voice
- Create-space flow with vibe picker
- Real routes for `/create` and `/r/:slug/:tab`
- Optional creator-managed room note after creation
- Reads-first room view for published field notes, with legacy feed/wins routes kept for compatibility
- Slack/private-dump to field-note to team-read loop
- Private pattern graph for logged-in dumps, with pgvector-backed working map and private insight review
- Phrase-based reactions with local or logged-in dedupe
- Edit/delete for new room posts through per-post edit tokens, with optional logged-in continuity across browsers
- Private dump and field-note edit/delete, including bulk cleanup for selected private dumps
- Heartbeat tab with weekly history and vibe-over-time from anonymised published team reads
- Share-copy actions for link, Slack, X, and WhatsApp
- Aggregate-only `/explore` page for public-space culture pulse
- Public sample reads at `/r/it-works-on-my-machine/reads` for seeing Mumbl before adding it to Slack
- Side Quests: short-lived anonymous 2-person backchannels inside a room

## Product Principles

- Anonymous by default. Users opt into identity, not out of it.
- The heartbeat is for the team, not management.
- Reactions are signal, not decoration.
- Side Quests are same-room only, anonymous, temporary, and never a member or visitor count.
- The product should sound like a trusted engineer, not HR software.

## Backend Direction

Use Supabase Postgres behind Next.js route handlers. Keep writes server-mediated so Mumbl can enforce rate limits, hashed reaction dedupe tokens, anonymous post constraints, and heartbeat prompt stripping in one place. See `docs/backend-plan.md`.

## Public Spaces

Spaces are private by default. Creators can opt in from the room sidebar to contribute anonymised aggregate themes to Mumbl Explore. Individual posts are never shown publicly, and public names are optional.

The open demo room is the intentional exception: `/r/it-works-on-my-machine` is public by design so people can try the product without a team invite. Team spaces stay private by default, and `/explore` stays aggregate-only.

## Heartbeats

Weekly heartbeat generation is scheduled through Vercel Cron in `vercel.json` and runs every Monday at 09:00 UTC, which stays within Vercel Hobby cron limits. The endpoint is `GET /api/cron/heartbeats` and is protected by `CRON_SECRET`.

The current generator is deterministic/local and reads only published team-read posts (`posts.type = 'field_note'`). Private dumps, Slack history, hidden feed posts, and presence never feed the heartbeat. An AI provider can replace the generator later while keeping the anonymised published-read payload shape. Heartbeat history and vibe-over-time are displayed from stored heartbeat rows.

## Pattern Graph

Logged-in private dumps are processed asynchronously for private pattern features. OpenAI extracts signals and embeddings into Supabase pgvector-backed `dump_signals`; Anthropic generates milestone insights into `patterns`. Anonymous/session-only dumps are excluded. Pattern APIs are owner-scoped and must not expose source dump content.

Users can review insights at `/patterns` and explore the working map at `/dump/map`. Local and staging can enable `MUMBL_ENABLE_PATTERN_TEST_TOOLS=true` for manual QA controls; production should keep it disabled. See [docs/pattern-graph.md](/Users/dawn/Code/mumbl-app/docs/pattern-graph.md).

## Backend Setup

The frontend now uses these backend route handlers for spaces, posts, reactions, and room reads.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, `MUMBL_SIDE_QUEST_ENCRYPTION_KEY`, and `CRON_SECRET`.
   Pattern graph work also needs `OPENAI_API_KEY`, `OPENAI_SIGNAL_MODEL`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_INSIGHT_MODEL`.
4. Authenticate the Supabase CLI with `npx supabase login`.
5. Run `npm run db:link -- your-project-ref` or `npm run db:link -- https://your-project.supabase.co`.
   `npm run db:link:staging` reads `.env.local`; `npm run db:link:prod` reads `.env.production.local`.
6. Run `npm run db:push` to apply the migrations.
7. Restart `npm run app`.

For account/session continuity, enable Supabase Google OAuth and allow `/auth/callback` in the Supabase Auth redirect URLs for each environment, for example `http://127.0.0.1:3000/auth/callback` locally and `https://mumbl.wtf/auth/callback` in production. Login is optional but central: it keeps private dumps, field-note drafts, Slack connections, creator rooms, editable room posts, reactions, and public-profile ownership together across browsers. It is not room identity, and anonymous room posting still works without an account or `posts.user_id`. Email magic-link code is kept dormant for now; custom SMTP is recommended before exposing it again.

Creator access starts with the local room creator token. When a logged-in creator presents that token, or opens a Slack-created room handoff while logged in, Mumbl links the room to their auth account so creator controls survive across browsers without tracking normal room membership.

Creators can delete test or unused rooms from the room danger zone. Deleting a room hard-deletes the room reads/feed signal, frees the slug, and leaves user-owned field notes in the author's dump with their room/post linkage cleared.

Until those variables exist, API routes return a setup `503`.

## Slack Beta Setup

The Slack app is a free beta entry point for private dumps. It supports `/mumbl [text]`, `/mumbl room [team name]`, a `save_to_mumbl` message shortcut, App Home private dumping, and App Home field-note drafting/review from recent private dumps. It does not read channel history.

See `docs/slack-app-setup.md` for the full production Slack app setup, scope reasons, deployment steps, and smoke tests.

In Slack app settings:

- OAuth redirect URL: `https://mumbl.wtf/api/slack/oauth/callback`
- Slash command request URL: `https://mumbl.wtf/api/slack/commands`
- Interactivity request URL: `https://mumbl.wtf/api/slack/interactions`
- Event subscriptions request URL: `https://mumbl.wtf/api/slack/events`
- Core bot scopes: `commands`, `users:read`, `users:read.email`, `im:write`, `chat:write`
- Optional team-read bot scopes: `groups:write`, `groups:read`
- Subscribe to bot events: `app_home_opened`, `member_joined_channel`

Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, and `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY` in the deployment environment. Install through `/api/slack/install`.

`/mumbl room platform team` creates a Mumbl room from Slack and returns a one-time creator handoff link for opening the room in a browser. `/mumbl start platform team` remains an alias. Slack-created rooms are auto-pinned and linked to creator ownership when Mumbl can match or later connect the Slack user to a Mumbl login. `/mumbl pin platform-team` explicitly adds a Mumbl room to that Slack user's publish list without tracking room membership, and best-effort invites them into the room's Mumbl-created Slack reads channel when one exists. App Home can draft, review, edit, publish private field notes to pinned Mumbl spaces, and manage personal pinned spaces. Optional team-read Slack posting is creator-enabled per room. If a creator switches it on, Mumbl starts an optional Slack permission upgrade that asks for `groups:write` and `groups:read` so it can create one private channel, post published team reads there using the core `chat:write` scope, and auto-pin that Mumbl room when a connected user joins the Mumbl-created Slack channel. It still does not request Slack history scopes.

Beta default: Slack team-read channels are private. A future public workspace channel option can use admin-approved Slack permissions such as `channels:manage`, only for creating the reads channel and still without history scopes.

Slack reminders are intentionally not part of the beta because frequent scheduling does not fit the current free-tier posture.

## Branches And Environments

Use `main` for production and `dev` for shared staging / preview work.

- `main` -> Vercel Production -> production Supabase
- `dev` -> Vercel Preview -> staging Supabase
- local `.env.local` -> local or staging Supabase, never production

Analytics is environment-gated. Local development is off by default. See [docs/environments.md](/Users/dawn/Code/mumbl-app/docs/environments.md).
Release flow and safety checks live in [docs/release-checklist.md](/Users/dawn/Code/mumbl-app/docs/release-checklist.md).

## CI

GitHub Actions runs `npm ci` and `npm run build` on pushes and pull requests to `dev` and `main`. The workflow lives at `.github/workflows/ci.yml`.

## Scaling

Prompt rotation, heartbeat job queueing, rate limits, and pooler notes are documented in [docs/scaling.md](/Users/dawn/Code/mumbl-app/docs/scaling.md).
Free-tier tradeoffs and future upgrade paths are documented in [docs/free-tier-compromises.md](/Users/dawn/Code/mumbl-app/docs/free-tier-compromises.md).
Private pattern graph behavior, pgvector checks, and staging QA steps are documented in [docs/pattern-graph.md](/Users/dawn/Code/mumbl-app/docs/pattern-graph.md).

## Current Stack

- Next.js
- React
- Plain CSS
- Browser `localStorage` only for reaction dedupe session token, creator token, and recent room slug. It is not used for member or visit tracking.

## Domain

Canonical product domain: `https://mumbl.wtf`. Use `NEXT_PUBLIC_APP_URL=https://mumbl.wtf` in production once the domain is pointed at Vercel.


## Heartbeat testing

With the local app running, trigger a heartbeat batch with:

```bash
npm run heartbeat:test
```

Use `npm run heartbeat:test -- https://your-deployment-url` to test a deployed environment.
