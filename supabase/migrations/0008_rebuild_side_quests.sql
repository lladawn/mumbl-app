drop function if exists claim_side_quest_card(uuid, uuid, text, timestamptz, timestamptz, timestamptz, timestamptz);
drop function if exists accept_side_quest_knock(uuid, uuid, text, timestamptz, timestamptz);

drop table if exists side_quest_reports;
drop table if exists side_quest_messages;
alter table if exists side_quest_cards drop constraint if exists side_quest_cards_room_fk;
drop table if exists side_quest_rooms;
drop table if exists side_quest_cards;

create table side_quest_cards (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  kind text not null check (kind in ('need', 'open')),
  context text check (context is null or char_length(context) <= 140),
  owner_session_token_hash text not null,
  owner_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'knocked', 'matched', 'cancelled')),
  knocked_by_session_token_hash text,
  knock_expires_at timestamptz,
  room_id uuid,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  check (knocked_by_session_token_hash is null or knocked_by_session_token_hash <> owner_session_token_hash)
);

create index side_quest_cards_active_idx
  on side_quest_cards (space_id, status, expires_at desc);
create index side_quest_cards_owner_idx
  on side_quest_cards (space_id, owner_session_token_hash, status);

create table side_quest_rooms (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references side_quest_cards(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  requester_session_token_hash text not null,
  responder_session_token_hash text not null,
  status text not null default 'open' check (status in ('open', 'dissolved', 'reported')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  dissolved_at timestamptz,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  check (requester_session_token_hash <> responder_session_token_hash)
);

create index side_quest_rooms_session_idx
  on side_quest_rooms (space_id, status, requester_session_token_hash, responder_session_token_hash, expires_at desc);

alter table side_quest_cards
  add constraint side_quest_cards_room_fk
  foreign key (room_id) references side_quest_rooms(id) on delete set null;

create table side_quest_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references side_quest_rooms(id) on delete cascade,
  sender_session_token_hash text not null,
  message_ciphertext text not null,
  message_iv text not null,
  message_tag text not null,
  message_version int not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index side_quest_messages_room_created_idx
  on side_quest_messages (room_id, created_at);
create index side_quest_messages_expiry_idx
  on side_quest_messages (expires_at);

create table side_quest_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references side_quest_rooms(id) on delete cascade,
  reporter_session_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (room_id, reporter_session_token_hash)
);

alter table side_quest_cards enable row level security;
alter table side_quest_rooms enable row level security;
alter table side_quest_messages enable row level security;
alter table side_quest_reports enable row level security;

create or replace function claim_side_quest_card(
  p_space_id uuid,
  p_card_id uuid,
  p_picker_hash text,
  p_now timestamptz,
  p_active_after timestamptz,
  p_knock_expires_at timestamptz,
  p_room_expires_at timestamptz
)
returns table (opened boolean, room_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  quest side_quest_cards%rowtype;
  created_room_id uuid;
  requester_hash text;
  responder_hash text;
begin
  select *
  into quest
  from side_quest_cards
  where id = p_card_id
    and space_id = p_space_id
  for update;

  if not found then
    raise exception 'side quest not found';
  end if;

  if quest.owner_session_token_hash = p_picker_hash then
    raise exception 'you cannot pick up your own side quest';
  end if;

  if quest.expires_at <= p_now or quest.status not in ('open', 'knocked') then
    raise exception 'that side quest is gone';
  end if;

  if quest.status = 'knocked' and quest.knock_expires_at > p_now then
    raise exception 'someone already picked this up';
  end if;

  if quest.owner_seen_at >= p_active_after then
    requester_hash := case when quest.kind = 'need' then quest.owner_session_token_hash else p_picker_hash end;
    responder_hash := case when quest.kind = 'need' then p_picker_hash else quest.owner_session_token_hash end;

    insert into side_quest_rooms (
      card_id,
      space_id,
      requester_session_token_hash,
      responder_session_token_hash,
      expires_at
    )
    values (
      quest.id,
      quest.space_id,
      requester_hash,
      responder_hash,
      p_room_expires_at
    )
    returning id into created_room_id;

    update side_quest_cards
    set
      status = 'matched',
      knocked_by_session_token_hash = null,
      knock_expires_at = null,
      room_id = created_room_id
    where id = quest.id;

    return query select true, created_room_id;
  else
    update side_quest_cards
    set
      status = 'knocked',
      knocked_by_session_token_hash = p_picker_hash,
      knock_expires_at = p_knock_expires_at
    where id = quest.id;

    return query select false, null::uuid;
  end if;
end;
$$;

create or replace function accept_side_quest_knock(
  p_space_id uuid,
  p_card_id uuid,
  p_owner_hash text,
  p_now timestamptz,
  p_room_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quest side_quest_cards%rowtype;
  created_room_id uuid;
  requester_hash text;
  responder_hash text;
begin
  select *
  into quest
  from side_quest_cards
  where id = p_card_id
    and space_id = p_space_id
  for update;

  if not found then
    raise exception 'side quest not found';
  end if;

  if quest.owner_session_token_hash <> p_owner_hash then
    raise exception 'only the quest owner can summon this room';
  end if;

  if quest.status <> 'knocked' or quest.knocked_by_session_token_hash is null or quest.knock_expires_at <= p_now then
    raise exception 'that knock is gone';
  end if;

  requester_hash := case when quest.kind = 'need' then quest.owner_session_token_hash else quest.knocked_by_session_token_hash end;
  responder_hash := case when quest.kind = 'need' then quest.knocked_by_session_token_hash else quest.owner_session_token_hash end;

  insert into side_quest_rooms (
    card_id,
    space_id,
    requester_session_token_hash,
    responder_session_token_hash,
    expires_at
  )
  values (
    quest.id,
    quest.space_id,
    requester_hash,
    responder_hash,
    p_room_expires_at
  )
  returning id into created_room_id;

  update side_quest_cards
  set
    status = 'matched',
    knocked_by_session_token_hash = null,
    knock_expires_at = null,
    room_id = created_room_id
  where id = quest.id;

  return created_room_id;
end;
$$;
