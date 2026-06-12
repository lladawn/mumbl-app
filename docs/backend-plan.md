# Backend Plan

Mumbl should use Next.js API routes with Supabase Postgres for v1. That keeps the frontend, API, and scheduled heartbeat work in one deployable app while still using a real relational database with constraints, unique indexes, and row-level security.

## Recommendation

Use:

- Next.js App Router for pages and route handlers
- Supabase Postgres for persistence
- Supabase client on the server only for privileged writes
- Browser-generated session token for reaction dedupe only. Do not use it for member, visit, or join tracking.
- Supabase Auth as an optional but central account layer for private data persistence
- Creator token stored in local storage as a recovery key for creator-only moderation actions
- A scheduled Next.js route or Vercel cron for Monday heartbeat generation

Login is not room identity. Spaces remain link-access and anonymous-first: people can read, react, and post anonymously without an account. Google/Supabase Auth exists so private dumps, field-note drafts, Slack connections, creator-owned rooms, and public-profile ownership do not get stranded in one browser.

## First Tables

```sql
create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  vibe text not null default 'chill',
  creator_token_hash text not null,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  type text not null check (type in ('find', 'thought', 'rant', 'win', 'lol')),
  content text not null check (char_length(content) between 1 and 420),
  is_anonymous boolean not null default true,
  display_name text,
  created_at timestamptz not null default now(),
  check (
    (is_anonymous = true and display_name is null)
    or
    (is_anonymous = false)
  )
);

create table reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  label text not null,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, session_token_hash, label)
);

create table heartbeats (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  week_of date not null,
  vibe_read text not null,
  digest text not null,
  uplift text not null,
  created_at timestamptz not null default now(),
  unique (space_id, week_of)
);

create table anon_audit (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now()
);
```

## Privacy Rules

- Anonymous posts store no display name.
- `posts` should not store `session_token`.
- Reaction dedupe stores only a server-side hash of the session token.
- `anon_audit` exists only for break-glass moderation and should never be queried by normal product views.
- Heartbeat prompts receive only anonymised published team-read rows: `{ type, content, reaction_count }` where `type = 'field_note'`.
- The creator gets no separate dashboard. Heartbeats are visible to everyone in the space.

## API Shape

- `POST /api/spaces` creates a space and returns `{ slug, creatorToken }`.
- `GET /api/spaces/:slug` returns space, posts, reaction counts, and heartbeat data.
- `POST /api/spaces/:slug/posts` creates a post. If anonymous, `display_name` must be null.
- New direct room posts also receive a one-time raw edit token in the response. Only its hash is stored in `post_edit_tokens`; the raw token stays in browser local storage for anonymous same-browser edit/delete.
- `PATCH /api/posts/:id` edits direct room post content when the matching edit token is presented, or when the logged-in user owns that edit-token row.
- `DELETE /api/posts/:id` deletes a post when the matching edit token, logged-in edit ownership, or creator access is presented. Team-read deletes unlink the author's field note instead of deleting it.
- `POST /api/posts/:id/reactions` toggles a phrase reaction using a hashed local session token, or a hashed auth principal for logged-in continuity across browsers.
- `DELETE /api/dumps` bulk-deletes selected private dumps for the current dump owner.
- `DELETE /api/spaces/:slug` lets a creator hard-delete a room, freeing the slug. User-owned field notes are kept and unlinked before the room row is deleted.
- `POST /api/spaces/:slug/first-post-dismissed` marks the creator-first prompt as dismissed.
- `POST /api/cron/heartbeats` generates weekly heartbeats from anonymised published team reads.
- `POST /api/waitlist` records an explicit landing-page email opt-in and returns success for duplicates.

## Waitlist

The landing-page waitlist stores only explicit email signups in `waitlist_signups`: normalized email, source, and creation time. It must not store IP address, user agent, session token, room slug, visitor data, or any other implicit tracking field.

Duplicate emails should be treated as success so people can resubmit harmlessly. The table is written only through the server route and has row-level security enabled.

## Dump V1

The dump feature keeps the no-signup model. Private dump entries are owned by the same browser session token pattern, but the database stores only `session_token_hash`, never the raw token. A dump is private on creation and cannot be posted directly into a room.

Team reads show only approved field notes. The flow is: select private dumps, request an OpenAI draft through a server route, save the draft in `field_notes`, let the author edit it, then publish it as `posts.type = 'field_note'`. The old raw-dump team endpoint is intentionally blocked so private dumps stay for dumping thoughts, not public reading.

During the Slack-native beta, `/r/:slug` opens to team reads. Legacy feed and wins routes remain available for compatibility, but they are not the primary room navigation and do not feed the heartbeat.

`OPENAI_API_KEY`, `OPENAI_MODEL_FIELD_NOTE`, and `OPENAI_MAX_DAILY_DRAFTS` are server-only. The default model should stay cost-sensitive, currently `gpt-5.4-nano`, and the draft route sends only selected dumps, capped at 10 per request. Field-note drafting should produce publishable working-process notes: specific, human, readable, and useful enough for team reads or a public profile, while staying grounded only in the selected dumps. Draft length is adaptive: tiny dumps should stay short and honest instead of becoming padded essays, while richer dump selections can become story-shaped reads with a real moment, tension, noticing, and takeaway.

Prototype public profiles now exist as a no-signup bridge: a browser session can claim one public handle and selectively add already-published field notes to `mumbl.wtf/@handle`. Private dumps and field-note drafts never appear there. This is intentionally per-note opt-in and should be replaced or migrated carefully when full identity arrives.

Google login is the primary production login path. Email magic-link code is dormant until custom SMTP is configured. Anonymous dumping still works without signup. When a user logs in, Mumbl links the current browser session's dumps, field-note drafts, public profile, dump insights, creator-token rooms, locally held room post edit tokens, and reaction dedupe hashes to the Supabase Auth user id. Visibility does not change. Anonymous room posts still leave `posts.user_id` empty; login only adds private continuity for edit access and reaction dedupe.

Creator-token room ownership can also be claimed by a logged-in creator. The local creator token remains the recovery/portable key, but once a logged-in user proves possession of it, `spaces.creator_user_id` lets creator controls survive across browsers. Slack-created rooms should set or reconcile `creator_user_id` whenever Mumbl can connect the Slack user to a Mumbl login. This must not become room membership tracking; only creator access is persisted.

Room post edit/delete uses per-post edit tokens rather than storing a reusable author/session hash on `posts`. Logged-in users can have `post_edit_tokens.owner_user_id` for cross-browser edit/delete, but the raw edit token is not saved to local storage for logged-in posts. Local edit tokens only unlock rows with no `owner_user_id`; logging out immediately removes account-owned edit controls from the feed. The post remains anonymous-facing and does not become a member record. Older posts without edit tokens are immutable to authors, though creators can remove posts from rooms they manage.

## Local Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Copy `.env.example` to `.env.local`.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, and `CRON_SECRET`.
5. Restart `npm run app`.

The service role key must stay server-only. It is used only in Next.js route handlers.

## Extension Schema

The old `memory_entries`/Supermemory runway is dormant. Private dump patterns now use Supabase pgvector through server routes, with `dump_signals`, `patterns`, and `user_dump_counts` owned by authenticated users.

The pattern graph is private user sensemaking, not room analytics:

- Logged-in private dumps are processed asynchronously after save.
- Anonymous/session-only dumps are not processed.
- OpenAI extracts structured signals and embeddings.
- Anthropic generates milestone insights.
- `/dump/map` uses local graph data plus pgvector search over the authenticated user's own signals.
- `/patterns` lets the authenticated owner confirm or dismiss generated insights.
- Pattern APIs must not expose source dump content, and Slack notifications must only link back to Mumbl without including private insight text.
- Deleting logged-in private dumps should clean up generated pattern rows that cite those dumps and reconcile the active private dump count.

See `docs/pattern-graph.md` for the operational flow, env vars, migrations, and staging QA steps.

## Public Space Runway

The schema now supports public opt-in with `spaces.is_public` and `spaces.public_name`, plus weekly `culture_snapshots` for a future `/explore` page. Public is off by default and can only be changed with the creator token.

V1 should show only the room badge and toggle. Do not show individual public posts. `/explore` is aggregate-only and should stay useful even when signal is thin.

## Why Supabase Fits

Supabase is a strong fit here because Mumbl needs relational integrity more than a document store: unique slugs, deduped reactions, weekly heartbeat uniqueness, and explicit privacy constraints. Postgres checks and unique indexes let us enforce product promises below the UI, which matters a lot for an anonymous-first product.

The main thing to be careful about is access control. Link-access rooms are intentionally open to anyone with the URL, so v1 should keep writes behind route handlers with rate limiting instead of exposing broad client-side Supabase writes.
