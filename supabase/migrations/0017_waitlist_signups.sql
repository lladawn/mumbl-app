create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_unique_idx
  on waitlist_signups (lower(email));

alter table waitlist_signups enable row level security;
