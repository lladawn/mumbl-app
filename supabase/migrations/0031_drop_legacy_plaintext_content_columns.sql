-- Release 3 privacy hardening: encrypted_payload is the only storage location
-- for user-entered/user-derived content. Run after 0029 backfill and 0030 scrub.

alter table posts drop constraint if exists posts_content_check;
alter table posts drop constraint if exists posts_field_note_title_check;
alter table posts drop constraint if exists posts_check;

alter table spaces
  drop column if exists name,
  drop column if exists description,
  drop column if exists public_name;

alter table posts
  drop column if exists content,
  drop column if exists display_name,
  drop column if exists field_note_title;

alter table heartbeats
  drop column if exists vibe_read,
  drop column if exists digest,
  drop column if exists uplift,
  drop column if exists vibe_word,
  drop column if exists top_theme,
  drop column if exists card_line;

alter table dumps
  drop column if exists content,
  drop column if exists ai_reflection,
  drop column if exists source_meta;

alter table field_notes
  drop column if exists title,
  drop column if exists content;

alter table dump_insights
  drop column if exists content;

alter table public_profiles
  drop column if exists display_name,
  drop column if exists bio;

alter table slack_pending_dumps
  drop column if exists content,
  drop column if exists source_meta;

alter table patterns
  drop column if exists summary,
  drop column if exists question;

drop function if exists search_dumps_by_embedding(vector(1536), uuid, float, int);

create or replace function search_dumps_by_embedding(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.75,
  match_count int default 10
)
returns table (
  dump_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    d.id as dump_id,
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

notify pgrst, 'reload schema';
