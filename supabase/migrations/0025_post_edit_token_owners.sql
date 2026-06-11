alter table post_edit_tokens
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

create index if not exists post_edit_tokens_owner_user_idx
  on post_edit_tokens (owner_user_id, created_at desc)
  where owner_user_id is not null;
