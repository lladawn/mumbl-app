-- Squashed baseline schema (replaces migrations 0001–0036)
-- All tables, indexes, functions, and RLS enablement as of 2026-06-26.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- Core space / post tables
-- ─────────────────────────────────────────────────────────────────────────────

create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  vibe text not null default 'chill' check (vibe in ('chill', 'chaotic', 'professional', 'gremlin')),
  creator_token_hash text not null,
  first_post_done boolean not null default false,
  is_public boolean not null default false,
  creator_user_id uuid references auth.users(id) on delete set null,
  read_token_hash text,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index spaces_creator_user_idx
  on spaces (creator_user_id, created_at desc)
  where creator_user_id is not null;

create table prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_date date not null unique,
  prompt_text text not null check (char_length(prompt_text) between 1 and 180),
  tone text not null default 'daily' check (tone in ('daily', 'quiet', 'spicy', 'win', 'retro')),
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  prompt_id uuid references prompts(id) on delete set null,
  type text not null check (type in ('find', 'thought', 'rant', 'win', 'lol', 'dump', 'field_note')),
  is_anonymous boolean not null default true,
  dump_id uuid,  -- FK added after dumps table below
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index posts_space_created_idx on posts (space_id, created_at desc);
create index posts_prompt_idx on posts (prompt_id);

create table reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 48),
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, session_token_hash, label)
);

create index reactions_post_idx on reactions (post_id);

create table heartbeats (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  week_of date not null,
  energy_level int check (energy_level between 0 and 100),
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (space_id, week_of)
);

create index heartbeats_space_week_idx on heartbeats (space_id, week_of desc);

create table heartbeat_jobs (
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

create index heartbeat_jobs_status_idx on heartbeat_jobs (status, created_at);

create table rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  session_token_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action, session_token_hash, window_start)
);

create index rate_limits_cleanup_idx on rate_limits (window_start);

create table anon_audit (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Side quest tables
-- ─────────────────────────────────────────────────────────────────────────────

create table side_quest_cards (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  kind text not null check (kind in ('need', 'open')),
  context text check (context is null or char_length(context) <= 140),
  owner_session_token_hash text not null,
  owner_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'knocked', 'matched', 'cancelled')),
  knocked_by_session_token_hash text,
  knock_expires_at timestamptz,
  room_id uuid,  -- FK added after side_quest_rooms table below
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  check (knocked_by_session_token_hash is null or knocked_by_session_token_hash <> owner_session_token_hash)
);

create index side_quest_cards_active_idx
  on side_quest_cards (space_id, status, expires_at desc);
create index side_quest_cards_owner_idx
  on side_quest_cards (space_id, owner_session_token_hash, status);

create table side_quest_rooms (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references side_quest_cards(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  requester_session_token_hash text not null,
  responder_session_token_hash text not null,
  status text not null default 'open' check (status in ('open', 'dissolved', 'reported')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  dissolved_at timestamptz,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  check (requester_session_token_hash <> responder_session_token_hash)
);

create index side_quest_rooms_session_idx
  on side_quest_rooms (space_id, status, requester_session_token_hash, responder_session_token_hash, expires_at desc);

alter table side_quest_cards
  add constraint side_quest_cards_room_fk
  foreign key (room_id) references side_quest_rooms(id) on delete set null;

create table side_quest_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references side_quest_rooms(id) on delete cascade,
  sender_session_token_hash text not null,
  message_ciphertext text not null,
  message_iv text not null,
  message_tag text not null,
  message_version int not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index side_quest_messages_room_created_idx
  on side_quest_messages (room_id, created_at);
create index side_quest_messages_expiry_idx
  on side_quest_messages (expires_at);

create table side_quest_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references side_quest_rooms(id) on delete cascade,
  reporter_session_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (room_id, reporter_session_token_hash)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dumps, field notes, public profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table dumps (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  team_room_id uuid references spaces(id) on delete set null,
  published_at timestamptz,
  user_id uuid references auth.users(id) on delete cascade,
  source text not null default 'web' check (source in ('web', 'slack')),
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility = 'team' and team_room_id is not null)
    or
    (visibility <> 'team')
  )
);

create index dumps_session_created_idx on dumps (session_token_hash, created_at desc);
create index dumps_team_created_idx on dumps (team_room_id, created_at desc) where visibility = 'team';
create index dumps_user_created_idx on dumps (user_id, created_at desc) where user_id is not null;

alter table posts
  add constraint posts_dump_id_fk foreign key (dump_id) references dumps(id) on delete set null;
create index posts_dump_idx on posts (dump_id);

create table public_profiles (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  handle text unique not null check (handle ~ '^[a-z0-9][a-z0-9_-]{1,29}$'),
  user_id uuid references auth.users(id) on delete cascade,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_profiles_session_idx on public_profiles (session_token_hash);
create index public_profiles_handle_idx on public_profiles (handle);
create index public_profiles_user_idx on public_profiles (user_id) where user_id is not null;

create table field_notes (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  team_room_id uuid references spaces(id) on delete set null,
  source_dump_ids uuid[] not null default '{}',
  is_published boolean not null default false,
  published_post_id uuid references posts(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  public_profile_id uuid references public_profiles(id) on delete set null,
  is_public boolean not null default false,
  public_published_at timestamptz,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index field_notes_session_created_idx on field_notes (session_token_hash, created_at desc);
create index field_notes_team_idx on field_notes (team_room_id, published_at desc) where is_published = true;
create index field_notes_user_created_idx on field_notes (user_id, created_at desc) where user_id is not null;
create index field_notes_user_unpublished_created_idx
  on field_notes (user_id, created_at desc)
  where user_id is not null and is_published = false;
create index field_notes_user_published_created_idx
  on field_notes (user_id, published_at desc)
  where user_id is not null and is_published = true;
create index field_notes_public_profile_idx
  on field_notes (public_profile_id, public_published_at desc)
  where is_public = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern graph tables
-- ─────────────────────────────────────────────────────────────────────────────

create table dump_signals (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references dumps(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  energy text check (energy in ('low', 'neutral', 'high')),
  emotions text[] default '{}',
  topics text[] default '{}',
  is_blocker boolean default false,
  signal_strength text check (signal_strength in ('strong', 'weak')),
  embedding vector(1536),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'done', 'failed')),
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dump_id)
);

create index dump_signals_embedding_idx
  on dump_signals
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index dump_signals_user_id_idx on dump_signals (user_id);
create index dump_signals_dump_id_idx on dump_signals (dump_id);

create table patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dump_ids uuid[] not null default '{}',
  period_start timestamptz,
  period_end timestamptz,
  user_confirmed boolean,
  user_dismissed boolean,
  delivered_slack boolean not null default false,
  delivered_at timestamptz,
  triggered_at_count integer,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index patterns_user_id_idx on patterns (user_id, created_at desc);

create table user_dump_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_dumps integer not null default 0,
  last_insight_at_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Waitlist
-- ─────────────────────────────────────────────────────────────────────────────

create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

create unique index waitlist_signups_email_unique_idx on waitlist_signups (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- Post edit tokens
-- ─────────────────────────────────────────────────────────────────────────────

create table post_edit_tokens (
  post_id uuid primary key references posts(id) on delete cascade,
  edit_token_hash text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index post_edit_tokens_owner_user_idx
  on post_edit_tokens (owner_user_id, created_at desc)
  where owner_user_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Saved room access
-- ─────────────────────────────────────────────────────────────────────────────

create table saved_room_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  read_token_hash text not null,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (user_id, space_id)
);

create index saved_room_access_user_idx
  on saved_room_access (user_id, last_opened_at desc nulls last, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Slack tables
-- ─────────────────────────────────────────────────────────────────────────────

create table slack_installations (
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

create table slack_connections (
  id uuid primary key default gen_random_uuid(),
  mumbl_user_id uuid not null references auth.users(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  slack_session_token_hash text not null,
  linked_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (slack_team_id, slack_user_id)
);

create index slack_connections_mumbl_user_idx
  on slack_connections (mumbl_user_id, linked_at desc);

create table slack_pending_dumps (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null,
  slack_user_id text not null,
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index slack_pending_dumps_lookup_idx
  on slack_pending_dumps (id, slack_team_id, slack_user_id)
  where consumed_at is null;

create table slack_space_channels (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  slack_team_id text not null,
  slack_channel_id text not null,
  slack_channel_name text not null,
  posting_enabled boolean not null default true,
  is_private boolean not null default true,
  created_by_slack_user_id text,
  last_posted_at timestamptz,
  last_post_error text,
  last_post_error_at timestamptz,
  access_token_ciphertext text,
  access_token_iv text,
  access_token_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id),
  unique (slack_team_id, slack_channel_id)
);

create index slack_space_channels_space_idx on slack_space_channels (space_id);

create table slack_team_read_setups (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  setup_token_hash text not null,
  access_token_ciphertext text,
  access_token_iv text,
  access_token_tag text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz
);

create index slack_team_read_setups_lookup_idx
  on slack_team_read_setups (id, setup_token_hash)
  where consumed_at is null;

create table slack_started_spaces (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  slack_team_id text not null,
  created_by_slack_user_id text not null,
  created_at timestamptz not null default now(),
  unique (space_id)
);

create index slack_started_spaces_team_user_idx
  on slack_started_spaces (slack_team_id, created_by_slack_user_id, created_at desc);

create table slack_space_handoffs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  creator_token_hash text not null,
  creator_token_ciphertext text not null,
  creator_token_iv text not null,
  creator_token_tag text not null,
  handoff_token_hash text not null,
  access_token_ciphertext text,
  access_token_iv text,
  access_token_tag text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz
);

create index slack_space_handoffs_lookup_idx
  on slack_space_handoffs (id, handoff_token_hash)
  where consumed_at is null;

create table slack_pinned_spaces (
  id uuid primary key default gen_random_uuid(),
  mumbl_user_id uuid not null references auth.users(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  space_id uuid not null references spaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (slack_team_id, slack_user_id, space_id)
);

create index slack_pinned_spaces_user_idx
  on slack_pinned_spaces (mumbl_user_id, created_at desc);
create index slack_pinned_spaces_slack_user_idx
  on slack_pinned_spaces (slack_team_id, slack_user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table spaces enable row level security;
alter table prompts enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table heartbeats enable row level security;
alter table heartbeat_jobs enable row level security;
alter table rate_limits enable row level security;
alter table anon_audit enable row level security;
alter table side_quest_cards enable row level security;
alter table side_quest_rooms enable row level security;
alter table side_quest_messages enable row level security;
alter table side_quest_reports enable row level security;
alter table dumps enable row level security;
alter table field_notes enable row level security;
alter table public_profiles enable row level security;
alter table dump_signals enable row level security;
alter table patterns enable row level security;
alter table user_dump_counts enable row level security;
alter table waitlist_signups enable row level security;
alter table post_edit_tokens enable row level security;
alter table saved_room_access enable row level security;
alter table slack_installations enable row level security;
alter table slack_connections enable row level security;
alter table slack_pending_dumps enable row level security;
alter table slack_space_channels enable row level security;
alter table slack_team_read_setups enable row level security;
alter table slack_started_spaces enable row level security;
alter table slack_space_handoffs enable row level security;
alter table slack_pinned_spaces enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions
-- ─────────────────────────────────────────────────────────────────────────────

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

create or replace function claim_side_quest_card(
  p_space_id uuid,
  p_card_id uuid,
  p_picker_hash text,
  p_now timestamptz,
  p_active_after timestamptz,
  p_knock_expires_at timestamptz,
  p_room_expires_at timestamptz
)
returns table (opened boolean, room_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  quest side_quest_cards%rowtype;
  created_room_id uuid;
  requester_hash text;
  responder_hash text;
begin
  select *
  into quest
  from side_quest_cards
  where id = p_card_id
    and space_id = p_space_id
  for update;

  if not found then
    raise exception 'side quest not found';
  end if;

  if quest.owner_session_token_hash = p_picker_hash then
    raise exception 'you cannot pick up your own side quest';
  end if;

  if quest.expires_at <= p_now or quest.status not in ('open', 'knocked') then
    raise exception 'that side quest is gone';
  end if;

  if quest.status = 'knocked' and quest.knock_expires_at > p_now then
    raise exception 'someone already picked this up';
  end if;

  if quest.owner_seen_at >= p_active_after then
    requester_hash := case when quest.kind = 'need' then quest.owner_session_token_hash else p_picker_hash end;
    responder_hash := case when quest.kind = 'need' then p_picker_hash else quest.owner_session_token_hash end;

    insert into side_quest_rooms (
      card_id,
      space_id,
      requester_session_token_hash,
      responder_session_token_hash,
      expires_at
    )
    values (
      quest.id,
      quest.space_id,
      requester_hash,
      responder_hash,
      p_room_expires_at
    )
    returning id into created_room_id;

    update side_quest_cards
    set
      status = 'matched',
      knocked_by_session_token_hash = null,
      knock_expires_at = null,
      room_id = created_room_id
    where id = quest.id;

    return query select true, created_room_id;
  else
    update side_quest_cards
    set
      status = 'knocked',
      knocked_by_session_token_hash = p_picker_hash,
      knock_expires_at = p_knock_expires_at
    where id = quest.id;

    return query select false, null::uuid;
  end if;
end;
$$;

create or replace function accept_side_quest_knock(
  p_space_id uuid,
  p_card_id uuid,
  p_owner_hash text,
  p_now timestamptz,
  p_room_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quest side_quest_cards%rowtype;
  created_room_id uuid;
  requester_hash text;
  responder_hash text;
begin
  select *
  into quest
  from side_quest_cards
  where id = p_card_id
    and space_id = p_space_id
  for update;

  if not found then
    raise exception 'side quest not found';
  end if;

  if quest.owner_session_token_hash <> p_owner_hash then
    raise exception 'only the quest owner can summon this room';
  end if;

  if quest.status <> 'knocked' or quest.knocked_by_session_token_hash is null or quest.knock_expires_at <= p_now then
    raise exception 'that knock is gone';
  end if;

  requester_hash := case when quest.kind = 'need' then quest.owner_session_token_hash else quest.knocked_by_session_token_hash end;
  responder_hash := case when quest.kind = 'need' then quest.knocked_by_session_token_hash else quest.owner_session_token_hash end;

  insert into side_quest_rooms (
    card_id,
    space_id,
    requester_session_token_hash,
    responder_session_token_hash,
    expires_at
  )
  values (
    quest.id,
    quest.space_id,
    requester_hash,
    responder_hash,
    p_room_expires_at
  )
  returning id into created_room_id;

  update side_quest_cards
  set
    status = 'matched',
    knocked_by_session_token_hash = null,
    knock_expires_at = null,
    room_id = created_room_id
  where id = quest.id;

  return created_room_id;
end;
$$;

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

create or replace function increment_user_dump_count(p_user_id uuid)
returns table (
  total_dumps integer,
  last_insight_at_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_dumps integer;
  v_last_insight_at_count integer;
begin
  insert into user_dump_counts as udc (user_id, total_dumps, updated_at)
  values (p_user_id, 1, now())
  on conflict (user_id)
  do update set
    total_dumps = udc.total_dumps + 1,
    updated_at = now()
  returning udc.total_dumps, udc.last_insight_at_count
  into v_total_dumps, v_last_insight_at_count;

  total_dumps := v_total_dumps;
  last_insight_at_count := v_last_insight_at_count;
  return next;
end;
$$;

create or replace function cleanup_pattern_graph_after_dump_delete(
  p_user_id uuid,
  p_dump_ids uuid[]
)
returns table (
  deleted_patterns integer,
  total_dumps integer,
  last_insight_at_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_patterns integer := 0;
  v_total_dumps integer := 0;
  v_last_insight_at_count integer := 0;
begin
  if coalesce(array_length(p_dump_ids, 1), 0) > 0 then
    delete from patterns
    where user_id = p_user_id
      and dump_ids && p_dump_ids;

    get diagnostics v_deleted_patterns = row_count;
  end if;

  select count(*)::integer
  into v_total_dumps
  from dumps
  where user_id = p_user_id
    and visibility = 'private';

  insert into user_dump_counts as udc (
    user_id,
    total_dumps,
    last_insight_at_count,
    updated_at
  )
  values (
    p_user_id,
    v_total_dumps,
    0,
    now()
  )
  on conflict (user_id)
  do update set
    total_dumps = v_total_dumps,
    last_insight_at_count = least(udc.last_insight_at_count, v_total_dumps),
    updated_at = now()
  returning udc.last_insight_at_count
  into v_last_insight_at_count;

  deleted_patterns := v_deleted_patterns;
  total_dumps := v_total_dumps;
  last_insight_at_count := v_last_insight_at_count;
  return next;
end;
$$;

create or replace function search_dumps_by_embedding(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.75,
  match_count int default 10
)
returns table (
  dump_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    d.id as dump_id,
    d.created_at,
    1 - (ds.embedding <=> query_embedding) as similarity
  from dump_signals ds
  join dumps d on d.id = ds.dump_id
  where ds.user_id = match_user_id
    and ds.embedding is not null
    and 1 - (ds.embedding <=> query_embedding) > match_threshold
  order by ds.embedding <=> query_embedding
  limit match_count;
$$;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;

notify pgrst, 'reload schema';
