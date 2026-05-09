alter table spaces add column if not exists is_public boolean not null default false;
alter table spaces add column if not exists public_name text;

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

alter table culture_snapshots enable row level security;
