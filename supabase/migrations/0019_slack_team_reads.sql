create table if not exists slack_space_channels (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id),
  unique (slack_team_id, slack_channel_id)
);

create index if not exists slack_space_channels_space_idx
  on slack_space_channels (space_id);

create table if not exists slack_team_read_setups (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  setup_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz
);

create index if not exists slack_team_read_setups_lookup_idx
  on slack_team_read_setups (id, setup_token_hash)
  where consumed_at is null;

alter table slack_space_channels enable row level security;
alter table slack_team_read_setups enable row level security;
