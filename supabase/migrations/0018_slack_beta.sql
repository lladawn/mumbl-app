alter table dumps
  add column if not exists source text not null default 'web' check (source in ('web', 'slack'));

alter table dumps
  add column if not exists source_meta jsonb not null default '{}'::jsonb;

create table if not exists slack_installations (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null unique,
  slack_team_name text,
  bot_user_id text,
  bot_access_token_ciphertext text not null,
  bot_access_token_iv text not null,
  bot_access_token_tag text not null,
  scopes text[] not null default '{}',
  beta_status text not null default 'active' check (beta_status in ('active', 'paused')),
  beta_started_at timestamptz not null default now(),
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists slack_connections (
  id uuid primary key default gen_random_uuid(),
  mumbl_user_id uuid not null references auth.users(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  slack_session_token_hash text not null,
  linked_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (slack_team_id, slack_user_id)
);

create index if not exists slack_connections_mumbl_user_idx
  on slack_connections (mumbl_user_id, linked_at desc);

create table if not exists slack_pending_dumps (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null,
  slack_user_id text not null,
  content text not null check (char_length(content) between 1 and 4000),
  source_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz
);

create index if not exists slack_pending_dumps_lookup_idx
  on slack_pending_dumps (id, slack_team_id, slack_user_id)
  where consumed_at is null;

create or replace function mumbl_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(p_email))
  order by created_at asc
  limit 1;
$$;

alter table slack_installations enable row level security;
alter table slack_connections enable row level security;
alter table slack_pending_dumps enable row level security;
