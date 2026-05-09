# Backend Plan

Mumbl should use Next.js API routes with Supabase Postgres for v1. That keeps the frontend, API, and scheduled heartbeat work in one deployable app while still using a real relational database with constraints, unique indexes, and row-level security.

## Recommendation

Use:

- Next.js App Router for pages and route handlers
- Supabase Postgres for persistence
- Supabase client on the server only for privileged writes
- Browser-generated session token for reaction dedupe
- Creator token stored in local storage for creator-only moderation actions
- A scheduled Next.js route or Vercel cron for Monday heartbeat generation

I would not use Supabase Auth for v1. The product promise is no signup. Treat spaces as link-access rooms, and keep identity optional at the post level.

## First Tables

```sql
create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  vibe text not null default 'chill',
  creator_token_hash text not null,
  member_count int not null default 1,
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
- Heartbeat prompts receive only `{ type, content, reaction_count }`.
- The creator gets no separate dashboard. Heartbeats are visible to every member.

## API Shape

- `POST /api/spaces` creates a space and returns `{ slug, creatorToken }`.
- `GET /api/spaces/:slug` returns space, posts, reaction counts, and heartbeat data.
- `POST /api/spaces/:slug/posts` creates a post. If anonymous, `display_name` must be null.
- `POST /api/posts/:id/reactions` toggles a phrase reaction using a hashed session token.
- `POST /api/spaces/:slug/first-post-dismissed` marks the creator-first prompt as dismissed.
- `POST /api/cron/heartbeats` generates weekly heartbeats from anonymised post data.

## Local Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Copy `.env.example` to `.env.local`.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MUMBL_TOKEN_HASH_SECRET`, and `CRON_SECRET`.
5. Restart `npm run app`.

The service role key must stay server-only. It is used only in Next.js route handlers.

## Extension Schema

The extension adds `memory_entries` for future Supermemory sync tracking and `space_plans` for future flat pricing. These tables exist as runway only; there is no Supermemory or billing UI yet.

## Public Space Runway

The schema now supports public opt-in with `spaces.is_public` and `spaces.public_name`, plus weekly `culture_snapshots` for a future `/explore` page. Public is off by default and can only be changed with the creator token.

V1 should show only the room badge and toggle. Do not show individual public posts. `/explore` is aggregate-only and should stay useful even when signal is thin.

## Why Supabase Fits

Supabase is a strong fit here because Mumbl needs relational integrity more than a document store: unique slugs, deduped reactions, weekly heartbeat uniqueness, and explicit privacy constraints. Postgres checks and unique indexes let us enforce product promises below the UI, which matters a lot for an anonymous-first product.

The main thing to be careful about is access control. Link-access rooms are intentionally open to anyone with the URL, so v1 should keep writes behind route handlers with rate limiting instead of exposing broad client-side Supabase writes.
