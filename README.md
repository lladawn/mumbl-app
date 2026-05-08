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

- `app/` contains Next.js routes: landing, create, and room pages.
- `src/components/` contains reusable UI components.
- `src/components/space/` contains room-specific feed, compose, reaction, share, and heartbeat pieces.
- `src/hooks/` contains client-side state hooks.
- `src/lib/` contains product constants, API helpers, storage helpers for session/creator tokens, and heartbeat logic.
- `docs/product_context.md` is the product source of truth.
- `docs/backend-plan.md` is the recommended Supabase/Postgres backend path.

## What Exists

- Landing screen with Mumbl's core voice
- Create-space flow with vibe picker
- Real routes for `/create` and `/r/:slug/:tab`
- Creator-first post prompt before sharing
- Space feed with post types: `thought`, `rant`, `win`, `find`, `lol`
- Anonymous-first compose flow with optional display handle
- Phrase-based reactions with local session dedupe
- Wins tab with lightweight stats
- Heartbeat tab generated from local anonymised post data
- Share-copy actions for link, Slack, X, and WhatsApp

## Product Principles

- Anonymous by default. Users opt into identity, not out of it.
- The heartbeat is for the team, not management.
- Reactions are signal, not decoration.
- The product should sound like a trusted engineer, not HR software.

## Backend Direction

Use Supabase Postgres behind Next.js route handlers. Keep writes server-mediated so Mumbl can enforce rate limits, hashed session tokens, anonymous post constraints, and heartbeat prompt stripping in one place. See `docs/backend-plan.md`.

## Backend Setup

The frontend now uses these backend route handlers for spaces, posts, reactions, and room reads.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, and `CRON_SECRET`.
4. Authenticate the Supabase CLI with `npx supabase login`.
5. Run `npm run db:link`.
6. Run `npm run db:push` to apply `supabase/migrations/0001_initial_schema.sql`.
7. Restart `npm run app`.

Until those variables exist, API routes return a setup `503`.

## Current Stack

- Next.js
- React
- Plain CSS
- Browser `localStorage` only for session token, creator token, and recent room slug
