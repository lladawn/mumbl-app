-- Booking desk — the pixel reception at /cal/[handle].
--
-- Separate from `spaces` and `agent_spaces` for the same reason those two are
-- separate from each other: this is a public, identified surface (an invitee
-- gives a name and an email so a call can happen) sitting next to an
-- anonymous-first product. Entangling them would put invitee PII inside the
-- tables that exist to promise there is none.
--
-- Writes go through /api/cal/* with the service role. RLS is on with no
-- policies, so anon/authed clients cannot read bookings directly.

create table booking_hosts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  office_name text not null,
  receptionist_name text not null default 'Ada',
  -- IANA zone. Availability rules are stored as host-local minutes, so this is
  -- the only thing that makes them mean anything.
  timezone text not null default 'Asia/Kolkata',
  -- sprite palette for the receptionist, same shape as makePerson() opts
  look jsonb not null default '{}'::jsonb,
  notify_email text not null,
  manage_token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table booking_event_types (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references booking_hosts(id) on delete cascade,
  slug text not null,
  title text not null,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 480),
  -- gap left after each call; slots step by duration + buffer
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 240),
  min_notice_minutes int not null default 120 check (min_notice_minutes >= 0),
  max_days_ahead int not null default 30 check (max_days_ahead between 1 and 365),
  location_note text not null default 'Google Meet link in the invite',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (host_id, slug)
);

-- weekly recurring availability, in minutes from host-local midnight
create table booking_rules (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references booking_hosts(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1440),
  end_minute int not null check (end_minute between 0 and 1440),
  check (end_minute > start_minute)
);

create index booking_rules_host_idx on booking_rules (host_id, weekday);

-- one-off holds: holidays, travel, a week off
create table booking_blackouts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references booking_hosts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

create index booking_blackouts_host_idx on booking_blackouts (host_id, starts_at);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references booking_hosts(id) on delete cascade,
  event_type_id uuid not null references booking_event_types(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  -- invitee name / email / note live here: PII on a public endpoint, encrypted
  -- at rest like post content is
  encrypted_payload jsonb not null default '{}'::jsonb,
  cancel_token_hash text not null unique,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- The double-book guard. Two people can hit /book for the same slot in the same
-- millisecond, so this has to be a constraint rather than a read-then-write
-- check in the route. The route catches 23505 and returns 409.
-- Partial on 'confirmed' so cancelling genuinely frees the slot.
create unique index bookings_slot_idx
  on bookings (host_id, starts_at)
  where status = 'confirmed';

create index bookings_host_window_idx on bookings (host_id, starts_at, status);

alter table booking_hosts enable row level security;
alter table booking_event_types enable row level security;
alter table booking_rules enable row level security;
alter table booking_blackouts enable row level security;
alter table bookings enable row level security;
