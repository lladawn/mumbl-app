-- Release 2 privacy scrub: after encrypted_payload backfill is verified,
-- remove user-entered/user-derived plaintext from legacy compatibility columns.

do $$
declare
  missing_count integer := 0;
begin
  select count(*) into missing_count
  from (
    select id from spaces where not (encrypted_payload ? 'name' and encrypted_payload ? 'description' and encrypted_payload ? 'public_name')
    union all
    select id from posts where not (encrypted_payload ? 'content' and encrypted_payload ? 'display_name' and encrypted_payload ? 'field_note_title')
    union all
    select id from heartbeats where not (encrypted_payload ? 'vibe_read' and encrypted_payload ? 'digest' and encrypted_payload ? 'uplift' and encrypted_payload ? 'vibe_word' and encrypted_payload ? 'top_theme' and encrypted_payload ? 'card_line')
    union all
    select id from dumps where not (encrypted_payload ? 'content' and encrypted_payload ? 'ai_reflection' and encrypted_payload ? 'source_meta')
    union all
    select id from field_notes where not (encrypted_payload ? 'title' and encrypted_payload ? 'content')
    union all
    select id from dump_insights where not (encrypted_payload ? 'content')
    union all
    select id from public_profiles where not (encrypted_payload ? 'display_name' and encrypted_payload ? 'bio')
    union all
    select id from slack_pending_dumps where not (encrypted_payload ? 'content' and encrypted_payload ? 'source_meta')
    union all
    select id from patterns where not (encrypted_payload ? 'summary' and encrypted_payload ? 'question')
  ) missing;

  if missing_count > 0 then
    raise exception 'content encryption backfill incomplete: % rows missing encrypted_payload keys. Run npm run content-encryption:backfill before applying this migration.', missing_count;
  end if;
end $$;

update spaces
set
  name = case when encrypted_payload ? 'name' then '[encrypted]' else name end,
  description = case when encrypted_payload ? 'description' and description is not null then '[encrypted]' else description end,
  public_name = case when encrypted_payload ? 'public_name' and public_name is not null then '[encrypted]' else public_name end;

update posts
set
  content = case when encrypted_payload ? 'content' then '[encrypted]' else content end,
  display_name = case when encrypted_payload ? 'display_name' and display_name is not null then '[encrypted]' else display_name end,
  field_note_title = case when encrypted_payload ? 'field_note_title' and field_note_title is not null then '[encrypted]' else field_note_title end;

update heartbeats
set
  vibe_read = case when encrypted_payload ? 'vibe_read' then '[encrypted]' else vibe_read end,
  digest = case when encrypted_payload ? 'digest' then '[encrypted]' else digest end,
  uplift = case when encrypted_payload ? 'uplift' then '[encrypted]' else uplift end,
  vibe_word = case when encrypted_payload ? 'vibe_word' and vibe_word is not null then '[encrypted]' else vibe_word end,
  top_theme = case when encrypted_payload ? 'top_theme' and top_theme is not null then '[encrypted]' else top_theme end,
  card_line = case when encrypted_payload ? 'card_line' and card_line is not null then '[encrypted]' else card_line end;

update dumps
set
  content = case when encrypted_payload ? 'content' then '[encrypted]' else content end,
  ai_reflection = case when encrypted_payload ? 'ai_reflection' and ai_reflection is not null then '[encrypted]' else ai_reflection end,
  source_meta = case when encrypted_payload ? 'source_meta' then '{}'::jsonb else source_meta end;

update field_notes
set
  title = case when encrypted_payload ? 'title' then '[encrypted]' else title end,
  content = case when encrypted_payload ? 'content' then '[encrypted]' else content end;

update dump_insights
set content = case when encrypted_payload ? 'content' then '{"encrypted": true}'::jsonb else content end;

update public_profiles
set
  display_name = case when encrypted_payload ? 'display_name' and display_name is not null then '[encrypted]' else display_name end,
  bio = case when encrypted_payload ? 'bio' and bio is not null then '[encrypted]' else bio end;

update slack_pending_dumps
set
  content = case when encrypted_payload ? 'content' then '[encrypted]' else content end,
  source_meta = case when encrypted_payload ? 'source_meta' then '{}'::jsonb else source_meta end;

update patterns
set
  summary = case when encrypted_payload ? 'summary' then '[encrypted]' else summary end,
  question = case when encrypted_payload ? 'question' then '[encrypted]' else question end;
