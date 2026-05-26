create table if not exists public_profiles (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  handle text unique not null check (handle ~ '^[a-z0-9][a-z0-9_-]{1,29}$'),
  display_name text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_profiles_session_idx on public_profiles (session_token_hash);
create index if not exists public_profiles_handle_idx on public_profiles (handle);

alter table field_notes add column if not exists public_profile_id uuid references public_profiles(id) on delete set null;
alter table field_notes add column if not exists is_public boolean not null default false;
alter table field_notes add column if not exists public_published_at timestamptz;

create index if not exists field_notes_public_profile_idx
  on field_notes (public_profile_id, public_published_at desc)
  where is_public = true;

alter table public_profiles enable row level security;
