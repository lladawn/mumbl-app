-- Office-sim privacy posture #2 ("ephemeral relay").
--
-- The office renders from the CURRENT shape of work (the `agents` upsert —
-- last-known status/task/category per collaborator), not from an ever-growing
-- history. agent_events is only the short activity trail the side panel types
-- out, and by default it is EPHEMERAL: each event carries a short TTL and
-- expired rows are purged on the next write and never read back.
--
-- This column is the retention clock. The app sets it to now + TTL when history
-- is OFF (the default posture) and leaves it null when MUMBL_OFFICE_HISTORY is
-- ON (durable retention, explicit opt-in). Reads filter out rows whose
-- expires_at is in the past, so an event is invisible the moment it lapses even
-- before the purge runs.
--
-- Additive and nullable, so existing Claude Code rows keep working with no
-- backfill (a null expires_at reads as "never expires" — i.e. legacy/retained).
-- Separate migration, not an edit to 0004/0005/0007, because those are already
-- applied to staging. RLS stays closed; the purge runs under the service role
-- in the write path.

alter table agent_events
  add column if not exists expires_at timestamptz;

-- Partial index: the read path filters "expires_at is null or expires_at > now"
-- and the purge deletes "expires_at < now", so only non-null rows matter here.
create index if not exists agent_events_expires_idx
  on agent_events (space_id, expires_at)
  where expires_at is not null;
