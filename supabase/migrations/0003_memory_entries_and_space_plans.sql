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

alter table memory_entries enable row level security;
alter table space_plans enable row level security;
