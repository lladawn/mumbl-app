# mumbl

Say the thing you've been mumbling all week.

Mumbl is an anonymous-first team room for engineers to share the thoughts that usually stay in side chats, heads, or dead Slack channels. The app now uses Next.js App Router with modular React components, while prototype data still lives in localStorage until the Supabase backend lands.

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
- `src/lib/` contains product constants, demo data, storage helpers, and heartbeat logic.
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

## Current Stack

- Next.js
- React
- Plain CSS
- Browser `localStorage` for prototype persistence
