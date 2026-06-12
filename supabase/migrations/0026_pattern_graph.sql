create extension if not exists vector;

create table if not exists dump_signals (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references dumps(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  energy text check (energy in ('low', 'neutral', 'high')),
  emotions text[] default '{}',
  topics text[] default '{}',
  is_blocker boolean default false,
  signal_strength text check (signal_strength in ('strong', 'weak')),
  embedding vector(1536),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'done', 'failed')),
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dump_id)
);

create index if not exists dump_signals_embedding_idx
  on dump_signals
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists dump_signals_user_id_idx
  on dump_signals(user_id);

create index if not exists dump_signals_dump_id_idx
  on dump_signals(dump_id);

create table if not exists patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dump_ids uuid[] not null default '{}',
  summary text not null,
  question text not null,
  period_start timestamptz,
  period_end timestamptz,
  user_confirmed boolean,
  user_dismissed boolean,
  delivered_slack boolean not null default false,
  delivered_at timestamptz,
  triggered_at_count integer,
  created_at timestamptz not null default now()
);

create index if not exists patterns_user_id_idx
  on patterns(user_id, created_at desc);

create table if not exists user_dump_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_dumps integer not null default 0,
  last_insight_at_count integer not null default 0,
  updated_at timestamptz not null default now()
);

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
  returning user_dump_counts.total_dumps, user_dump_counts.last_insight_at_count
  into v_total_dumps, v_last_insight_at_count;

  total_dumps := v_total_dumps;
  last_insight_at_count := v_last_insight_at_count;
  return next;
end;
$$;

create or replace function search_dumps_by_embedding(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.75,
  match_count int default 10
)
returns table (
  dump_id uuid,
  content text,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    d.id as dump_id,
    d.content,
    d.created_at,
    1 - (ds.embedding <=> query_embedding) as similarity
  from dump_signals ds
  join dumps d on d.id = ds.dump_id
  where ds.user_id = match_user_id
    and ds.embedding is not null
    and 1 - (ds.embedding <=> query_embedding) > match_threshold
  order by ds.embedding <=> query_embedding
  limit match_count;
$$;

alter table dump_signals enable row level security;
alter table patterns enable row level security;
alter table user_dump_counts enable row level security;
