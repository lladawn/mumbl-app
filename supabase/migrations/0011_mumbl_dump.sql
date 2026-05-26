alter table posts drop constraint if exists posts_type_check;
alter table posts add constraint posts_type_check check (type in ('find', 'thought', 'rant', 'win', 'lol', 'dump', 'field_note'));

alter table posts drop constraint if exists posts_content_check;
alter table posts add constraint posts_content_check check (
  (type in ('dump', 'field_note') and char_length(content) between 1 and 4000)
  or
  (type not in ('dump', 'field_note') and char_length(content) between 1 and 420)
);

create table if not exists dumps (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  content text not null check (char_length(content) between 1 and 4000),
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  team_room_id uuid references spaces(id) on delete set null,
  ai_reflection text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility = 'team' and team_room_id is not null)
    or
    (visibility <> 'team')
  )
);

create index if not exists dumps_session_created_idx on dumps (session_token_hash, created_at desc);
create index if not exists dumps_team_created_idx on dumps (team_room_id, created_at desc) where visibility = 'team';

alter table posts add column if not exists dump_id uuid references dumps(id) on delete set null;
alter table posts add column if not exists field_note_title text check (field_note_title is null or char_length(field_note_title) between 1 and 120);
create index if not exists posts_dump_idx on posts (dump_id);

create table if not exists field_notes (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  team_room_id uuid references spaces(id) on delete set null,
  source_dump_ids uuid[] not null default '{}',
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 4000),
  is_published boolean not null default false,
  published_post_id uuid references posts(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists field_notes_session_created_idx on field_notes (session_token_hash, created_at desc);
create index if not exists field_notes_team_idx on field_notes (team_room_id, published_at desc) where is_published = true;

create table if not exists dump_insights (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  insight_type text not null check (insight_type in ('theme', 'pattern', 'streak', 'graph_node')),
  content jsonb not null,
  generated_at timestamptz not null default now()
);

create index if not exists dump_insights_session_idx on dump_insights (session_token_hash, generated_at desc);

alter table dumps enable row level security;
alter table field_notes enable row level security;
alter table dump_insights enable row level security;
