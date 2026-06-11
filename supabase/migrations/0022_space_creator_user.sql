alter table spaces
  add column if not exists creator_user_id uuid references auth.users(id) on delete set null;

create index if not exists spaces_creator_user_idx
  on spaces (creator_user_id, created_at desc)
  where creator_user_id is not null;
