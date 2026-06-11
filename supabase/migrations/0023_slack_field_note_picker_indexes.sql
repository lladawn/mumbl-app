create index if not exists field_notes_user_unpublished_created_idx
  on field_notes (user_id, created_at desc)
  where user_id is not null and is_published = false;

create index if not exists field_notes_user_published_created_idx
  on field_notes (user_id, published_at desc)
  where user_id is not null and is_published = true;
