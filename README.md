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
- `src/components/space/` contains room-specific feed, compose, reaction, share, and heartbeat pieces.
- `src/hooks/` contains client-side state hooks.
- `src/lib/` contains product constants, API helpers, storage helpers for session/creator tokens, and heartbeat logic.
- `docs/mumbl-product-context.md` and `docs/mumbl-extension-01.md` are the product source of truth. The extension wins on conflicts.
- `docs/backend-plan.md` is the recommended Supabase/Postgres backend path.

## What Exists

- Landing screen with Mumbl's core voice
- Create-space flow with vibe picker
- Real routes for `/create` and `/r/:slug/:tab`
- Creator-first post prompt before sharing
- Optional creator-managed room note after creation
- Space feed with post types: `thought`, `rant`, `win`, `find`, `lol`
- Anonymous-first compose flow with optional display handle
- Phrase-based reactions with local session dedupe
- Wins tab with lightweight stats
- Heartbeat tab with weekly history and vibe-over-time from anonymised backend data
- Share-copy actions for link, Slack, X, and WhatsApp
- Aggregate-only `/explore` page for public-space culture pulse
- Open demo room at `/r/it-works-on-my-machine` for trying Mumbl before creating a team space
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

The current generator is deterministic/local; the AI provider can replace the generator later while keeping the anonymised payload shape. Heartbeat history and vibe-over-time are displayed from stored heartbeat rows.

## Backend Setup

The frontend now uses these backend route handlers for spaces, posts, reactions, and room reads.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, `MUMBL_SIDE_QUEST_ENCRYPTION_KEY`, and `CRON_SECRET`.
4. Authenticate the Supabase CLI with `npx supabase login`.
5. Run `npm run db:link -- your-project-ref` or `npm run db:link -- https://your-project.supabase.co`.
   `npm run db:link:staging` reads `.env.local`; `npm run db:link:prod` reads `.env.production.local`.
6. Run `npm run db:push` to apply the migrations.
7. Restart `npm run app`.

For dump login, enable Supabase Google OAuth and allow `/auth/callback` in the Supabase Auth redirect URLs for each environment, for example `http://127.0.0.1:3000/auth/callback` locally and `https://mumbl.wtf/auth/callback` in production. Email magic-link code is kept dormant for now; custom SMTP is recommended before exposing it again.

Until those variables exist, API routes return a setup `503`.

## Slack Beta Setup

The Slack app is a free beta entry point for private dumps. It supports `/mumbl [text]`, `/mumbl room [team name]`, a `save_to_mumbl` message shortcut, App Home private dumping, and App Home field-note drafting/review from recent private dumps. It does not read channel history.

In Slack app settings:

- OAuth redirect URL: `https://mumbl.wtf/api/slack/oauth/callback`
- Slash command request URL: `https://mumbl.wtf/api/slack/commands`
- Interactivity request URL: `https://mumbl.wtf/api/slack/interactions`
- Event subscriptions request URL: `https://mumbl.wtf/api/slack/events`
- Core bot scopes: `commands`, `users:read`, `users:read.email`
- Subscribe to bot event: `app_home_opened`

Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, and `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY` in the deployment environment. Install through `/api/slack/install`.

`/mumbl room platform team` creates a Mumbl room from Slack and returns a one-time creator handoff link for opening the room in a browser. `/mumbl start platform team` remains an alias. App Home can draft a private field note from selected recent dumps, but review and publishing still happen in Mumbl. Optional team-read Slack posting is creator-enabled per room. If a creator switches it on, Mumbl starts an optional Slack permission upgrade that asks for `chat:write` and `groups:write` so it can create one private channel and post published team reads there. It still does not request Slack history scopes.

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
