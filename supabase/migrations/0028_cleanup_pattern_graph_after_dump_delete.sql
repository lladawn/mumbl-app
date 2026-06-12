create or replace function cleanup_pattern_graph_after_dump_delete(
  p_user_id uuid,
  p_dump_ids uuid[]
)
returns table (
  deleted_patterns integer,
  total_dumps integer,
  last_insight_at_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_patterns integer := 0;
  v_total_dumps integer := 0;
  v_last_insight_at_count integer := 0;
begin
  if coalesce(array_length(p_dump_ids, 1), 0) > 0 then
    delete from patterns
    where user_id = p_user_id
      and dump_ids && p_dump_ids;

    get diagnostics v_deleted_patterns = row_count;
  end if;

  select count(*)::integer
  into v_total_dumps
  from dumps
  where user_id = p_user_id
    and visibility = 'private';

  insert into user_dump_counts as udc (
    user_id,
    total_dumps,
    last_insight_at_count,
    updated_at
  )
  values (
    p_user_id,
    v_total_dumps,
    0,
    now()
  )
  on conflict (user_id)
  do update set
    total_dumps = v_total_dumps,
    last_insight_at_count = least(udc.last_insight_at_count, v_total_dumps),
    updated_at = now()
  returning udc.last_insight_at_count
  into v_last_insight_at_count;

  deleted_patterns := v_deleted_patterns;
  total_dumps := v_total_dumps;
  last_insight_at_count := v_last_insight_at_count;
  return next;
end;
$$;
