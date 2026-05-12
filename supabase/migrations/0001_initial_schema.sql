create extension if not exists pgcrypto;

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  vibe text not null default 'chill' check (vibe in ('chill', 'chaotic', 'professional', 'gremlin')),
  creator_token_hash text not null,
  first_post_done boolean not null default false,
  is_public boolean not null default false,
  public_name text,
  created_at timestamptz not null default now()
);

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_date date not null unique,
  prompt_text text not null check (char_length(prompt_text) between 1 and 180),
  tone text not null default 'daily' check (tone in ('daily', 'quiet', 'spicy', 'win', 'retro')),
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  prompt_id uuid references prompts(id) on delete set null,
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
create index if not exists posts_prompt_idx on posts (prompt_id);

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
  vibe_word text,
  top_theme text,
  energy_level int check (energy_level between 0 and 100),
  card_line text,
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

create table if not exists memory_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  heartbeat_id uuid references heartbeats(id) on delete set null,
  supermemory_key text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists memory_entries_space_idx on memory_entries (space_id, created_at desc);

create table if not exists space_plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'org')),
  billing_cycle text check (billing_cycle in ('monthly', 'annual') or billing_cycle is null),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id)
);

create table if not exists heartbeat_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  week_of date not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (space_id, week_of)
);

create index if not exists heartbeat_jobs_status_idx on heartbeat_jobs (status, created_at);

create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  session_token_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action, session_token_hash, window_start)
);

create index if not exists rate_limits_cleanup_idx on rate_limits (window_start);

create or replace function check_rate_limit(
  p_action text,
  p_session_token_hash text,
  p_window_start timestamptz,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_count int;
begin
  insert into rate_limits (action, session_token_hash, window_start, count)
  values (p_action, p_session_token_hash, p_window_start, 1)
  on conflict (action, session_token_hash, window_start)
  do update set
    count = rate_limits.count + 1,
    updated_at = now()
  returning count into request_count;

  return request_count <= p_limit;
end;
$$;


create or replace function claim_heartbeat_jobs(
  p_week_of date,
  p_limit int,
  p_max_attempts int default 3
)
returns table (id uuid, space_id uuid, attempts int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select heartbeat_jobs.id
    from heartbeat_jobs
    where heartbeat_jobs.week_of = p_week_of
      and heartbeat_jobs.status in ('queued', 'failed')
      and heartbeat_jobs.attempts < p_max_attempts
    order by heartbeat_jobs.created_at asc
    limit p_limit
    for update skip locked
  )
  update heartbeat_jobs
  set
    status = 'running',
    locked_at = now(),
    attempts = heartbeat_jobs.attempts + 1,
    last_error = null
  from next_jobs
  where heartbeat_jobs.id = next_jobs.id
  returning heartbeat_jobs.id, heartbeat_jobs.space_id, heartbeat_jobs.attempts;
end;
$$;

create table if not exists anon_audit (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now()
);

alter table spaces enable row level security;
alter table prompts enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table heartbeats enable row level security;
alter table heartbeat_jobs enable row level security;
alter table rate_limits enable row level security;
alter table anon_audit enable row level security;
alter table culture_snapshots enable row level security;
alter table memory_entries enable row level security;
alter table space_plans enable row level security;

-- The app uses Next.js route handlers with the Supabase service role key.
-- Do not add broad anon policies unless the client starts reading directly.
