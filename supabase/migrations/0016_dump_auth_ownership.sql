alter table dumps
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table field_notes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table dump_insights
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists dumps_user_created_idx
  on dumps (user_id, created_at desc)
  where user_id is not null;

create index if not exists field_notes_user_created_idx
  on field_notes (user_id, created_at desc)
  where user_id is not null;

create index if not exists public_profiles_user_idx
  on public_profiles (user_id)
  where user_id is not null;

create index if not exists dump_insights_user_idx
  on dump_insights (user_id, generated_at desc)
  where user_id is not null;
