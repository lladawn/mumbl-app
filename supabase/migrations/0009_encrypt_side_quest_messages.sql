alter table if exists side_quest_messages
  add column if not exists message_ciphertext text,
  add column if not exists message_iv text,
  add column if not exists message_tag text,
  add column if not exists message_version int not null default 1;

delete from side_quest_messages
where message_ciphertext is null
   or message_iv is null
   or message_tag is null;

alter table if exists side_quest_messages
  alter column message_ciphertext set not null,
  alter column message_iv set not null,
  alter column message_tag set not null;

alter table if exists side_quest_messages
  drop column if exists message;
