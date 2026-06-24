create table if not exists saved_room_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  read_token_hash text not null,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (user_id, space_id)
);

create index if not exists saved_room_access_user_idx
  on saved_room_access (user_id, last_opened_at desc nulls last, created_at desc);

alter table saved_room_access enable row level security;

notify pgrst, 'reload schema';
