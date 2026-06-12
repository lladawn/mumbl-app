create or replace function increment_user_dump_count(p_user_id uuid)
returns table (
  total_dumps integer,
  last_insight_at_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_dumps integer;
  v_last_insight_at_count integer;
begin
  insert into user_dump_counts as udc (user_id, total_dumps, updated_at)
  values (p_user_id, 1, now())
  on conflict (user_id)
  do update set
    total_dumps = udc.total_dumps + 1,
    updated_at = now()
  returning udc.total_dumps, udc.last_insight_at_count
  into v_total_dumps, v_last_insight_at_count;

  total_dumps := v_total_dumps;
  last_insight_at_count := v_last_insight_at_count;
  return next;
end;
$$;
