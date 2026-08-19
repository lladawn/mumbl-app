-- Daily activity aggregate — posture #2 compliant.
--
-- Raw agent_events are EPHEMERAL (short TTL, purged on write) — they are a thin
-- relay of the *current* shape of work, not a durable log. But a day-recap
-- needs day-level totals that survive the ephemeral window. This table is the
-- durable rollup that bridges the two: it stores only SHAPE (tool, category,
-- seconds, sessions) — never window titles, repo names, task text, or any
-- content field. It is strictly additive and incrementally updated on each
-- ingest so the cost per write is one upsert.
--
-- Privacy posture: shape-only. The same plaintext vocabulary as agents.tool /
-- agents.category (enforced in the app layer). The actor is identified only by
-- external_id (opaque string the desktop helper chooses — typically a machine
-- hostname or UUID, never an email or full name) so the row carries no PII
-- beyond what is already in the `agents` current-state table.
--
-- RLS: closed (no policies). All reads go through the service-role server path
-- (src/server/dayRecap.js), consistent with every other office table.

create table if not exists daily_app_totals (
  space_id          uuid        not null references agent_spaces(id) on delete cascade,
  actor_external_id text        not null,
  day               date        not null,  -- UTC calendar day at ingest time
  tool              text        not null,  -- SHAPE e.g. 'vscode','figma','zoom'
  category          text        not null,  -- SHAPE fixed vocab (see ACTIVITY_CATEGORIES)
  seconds           integer     not null default 0,   -- cumulative active seconds today
  sessions          integer     not null default 0,   -- number of distinct focus events
  updated_at        timestamptz not null default now(),

  primary key (space_id, actor_external_id, day, tool, category)
);

-- Composite index for the recap read path:
-- "give me today's rows for this space + actor, ordered by seconds desc"
create index if not exists daily_app_totals_recap_idx
  on daily_app_totals (space_id, actor_external_id, day)
  include (tool, category, seconds, sessions);

-- ── Atomic increment RPC ─────────────────────────────────────────────────────
--
-- Called from the ingest path (src/server/agentPresence.js) with the elapsed
-- seconds since the actor's last event and a sessions bump when starting a
-- new block of focus. Using a server-side function keeps the increment atomic
-- and avoids the read-modify-write race that would occur if the app did a
-- SELECT then UPDATE.
--
-- Parameters are prefixed p_ to avoid collision with column names inside the
-- function body (common Postgres gotcha with SET search_path).

create or replace function upsert_daily_app_total(
  p_space_id          uuid,
  p_actor_external_id text,
  p_day               date,
  p_tool              text,
  p_category          text,
  p_delta_sec         integer,
  p_new_session       integer  -- 1 = bump sessions, 0 = don't
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into daily_app_totals
    (space_id, actor_external_id, day, tool, category, seconds, sessions, updated_at)
  values
    (p_space_id, p_actor_external_id, p_day, p_tool, p_category,
     p_delta_sec, p_new_session, now())
  on conflict (space_id, actor_external_id, day, tool, category)
  do update set
    seconds    = daily_app_totals.seconds    + excluded.seconds,
    sessions   = daily_app_totals.sessions   + excluded.sessions,
    updated_at = now();
end;
$$;

-- No RLS policies: service-role only, consistent with agent_spaces / agents /
-- agent_events posture. The read path (dayRecap.js) runs server-side and never
-- hands raw rows to the browser.
