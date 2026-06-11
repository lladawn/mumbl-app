create table if not exists slack_started_spaces (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  slack_team_id text not null,
  created_by_slack_user_id text not null,
  created_at timestamptz not null default now(),
  unique (space_id)
);

create index if not exists slack_started_spaces_team_user_idx
  on slack_started_spaces (slack_team_id, created_by_slack_user_id, created_at desc);

create table if not exists slack_space_handoffs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  creator_token_hash text not null,
  creator_token_ciphertext text not null,
  creator_token_iv text not null,
  creator_token_tag text not null,
  handoff_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz
);

create index if not exists slack_space_handoffs_lookup_idx
  on slack_space_handoffs (id, handoff_token_hash)
  where consumed_at is null;

alter table slack_started_spaces enable row level security;
alter table slack_space_handoffs enable row level security;
