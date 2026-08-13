-- Agent presence — stage 1 of the agent-collaborator prototype.
--
-- Deliberately separate from `spaces`: that table is the anonymous Slack/room
-- product (vibe, creator tokens, posts). This is a different product with a
-- different buyer, and entangling them would make both harder to change.
--
-- One write path only: everything here is written by /api/agents/ingest using
-- the service role. RLS is enabled with no policies, so anon/authed clients
-- cannot read or write directly — same posture as the rest of the schema.
-- Stage 2 (realtime subscriptions from the browser) will need read policies;
-- do that deliberately rather than by loosening these now.

create table agent_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  -- agents authenticate with a bearer token; only the HMAC is stored
  ingest_token_hash text not null unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references agent_spaces(id) on delete cascade,
  -- stable id from the reporting runtime, e.g. "claude-code:<session_id>"
  external_id text not null,
  name text not null,
  role text not null default 'General',
  status text not null default 'idle' check (status in ('idle', 'working', 'blocked', 'done')),
  source text not null default 'unknown',
  -- current_task lives here: task strings carry repo, branch and customer
  -- detail, so they are encrypted at rest like post content is
  encrypted_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (space_id, external_id)
);

create index agents_space_idx on agents (space_id, last_seen_at desc);

-- append-only; this is the activity log a collaborator's panel reads
create table agent_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references agent_spaces(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  kind text not null,
  status text,
  encrypted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index agent_events_space_idx on agent_events (space_id, created_at desc);
create index agent_events_agent_idx on agent_events (agent_id, created_at desc);

alter table agent_spaces enable row level security;
alter table agents enable row level security;
alter table agent_events enable row level security;
