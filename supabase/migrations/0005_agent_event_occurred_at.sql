-- Order agent events by when they happened, not when they landed.
--
-- Hooks fire faster than the ingest round-trip, so concurrent posts arrive out
-- of order: in the first scaffold test a PreToolUse event was inserted before
-- the SessionStart that preceded it. created_at is therefore wrong for the
-- activity log. The reporter now sends its own timestamp.
--
-- Separate from 0004 because 0004 is already applied to staging; editing an
-- applied migration would leave the two databases silently divergent.

alter table agent_events
  add column if not exists occurred_at timestamptz not null default now();

-- backfill the scaffold rows so ordering is consistent for existing data
update agent_events set occurred_at = created_at where occurred_at is null;

drop index if exists agent_events_space_idx;
drop index if exists agent_events_agent_idx;

create index agent_events_space_idx on agent_events (space_id, occurred_at desc);
create index agent_events_agent_idx on agent_events (agent_id, occurred_at desc);
