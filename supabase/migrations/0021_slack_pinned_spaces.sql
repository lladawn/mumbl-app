create table if not exists slack_pinned_spaces (
  id uuid primary key default gen_random_uuid(),
  mumbl_user_id uuid not null references auth.users(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  space_id uuid not null references spaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (slack_team_id, slack_user_id, space_id)
);

create index if not exists slack_pinned_spaces_user_idx
  on slack_pinned_spaces (mumbl_user_id, created_at desc);

create index if not exists slack_pinned_spaces_slack_user_idx
  on slack_pinned_spaces (slack_team_id, slack_user_id, created_at desc);

alter table slack_pinned_spaces enable row level security;
