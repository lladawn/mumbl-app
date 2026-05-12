create or replace function claim_heartbeat_jobs(
  p_week_of date,
  p_limit int,
  p_max_attempts int default 3
)
returns table (id uuid, space_id uuid, attempts int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select heartbeat_jobs.id
    from heartbeat_jobs
    where heartbeat_jobs.week_of = p_week_of
      and heartbeat_jobs.status in ('queued', 'failed')
      and heartbeat_jobs.attempts < p_max_attempts
    order by heartbeat_jobs.created_at asc
    limit p_limit
    for update skip locked
  )
  update heartbeat_jobs
  set
    status = 'running',
    locked_at = now(),
    attempts = heartbeat_jobs.attempts + 1,
    last_error = null
  from next_jobs
  where heartbeat_jobs.id = next_jobs.id
  returning heartbeat_jobs.id, heartbeat_jobs.space_id, heartbeat_jobs.attempts;
end;
$$;
