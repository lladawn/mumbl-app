create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_date date not null unique,
  prompt_text text not null check (char_length(prompt_text) between 1 and 180),
  tone text not null default 'daily' check (tone in ('daily', 'quiet', 'spicy', 'win', 'retro')),
  created_at timestamptz not null default now()
);

alter table posts add column if not exists prompt_id uuid references prompts(id) on delete set null;
create index if not exists posts_prompt_idx on posts (prompt_id);

alter table heartbeats add column if not exists vibe_word text;
alter table heartbeats add column if not exists top_theme text;
alter table heartbeats add column if not exists energy_level int check (energy_level between 0 and 100);
alter table heartbeats add column if not exists card_line text;

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

alter table prompts enable row level security;
alter table heartbeat_jobs enable row level security;
alter table rate_limits enable row level security;
