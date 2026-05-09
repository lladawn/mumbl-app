create extension if not exists pgcrypto;

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  vibe text not null default 'chill' check (vibe in ('chill', 'chaotic', 'professional', 'gremlin')),
  creator_token_hash text not null,
  member_count int not null default 1 check (member_count >= 1),
  first_post_done boolean not null default false,
  is_public boolean not null default false,
  public_name text,
  created_at timestamptz not null default now()
);

create table if not exists posts (
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
    (is_anonymous = false and display_name is not null and char_length(display_name) between 1 and 48)
  )
);

create index if not exists posts_space_created_idx on posts (space_id, created_at desc);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 48),
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, session_token_hash, label)
);

create index if not exists reactions_post_idx on reactions (post_id);

create table if not exists heartbeats (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  week_of date not null,
  vibe_read text not null,
  digest text not null,
  uplift text not null,
  created_at timestamptz not null default now(),
  unique (space_id, week_of)
);

create index if not exists heartbeats_space_week_idx on heartbeats (space_id, week_of desc);

create table if not exists culture_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  total_public_spaces int not null default 0,
  total_posts int not null default 0,
  total_reactions int not null default 0,
  anon_percentage numeric(5,2) not null default 0,
  top_rant_theme text,
  top_win_theme text,
  most_active_day text,
  culture_pulse text,
  tweet_text text,
  created_at timestamptz not null default now()
);

create table if not exists anon_audit (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now()
);

alter table spaces enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table heartbeats enable row level security;
alter table anon_audit enable row level security;
alter table culture_snapshots enable row level security;

-- The app uses Next.js route handlers with the Supabase service role key.
-- Do not add broad anon policies unless the client starts reading directly.
