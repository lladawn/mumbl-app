alter table dumps add column if not exists supermemory_id text;
alter table dumps add column if not exists supermemory_status text;
alter table dumps add column if not exists supermemory_synced_at timestamptz;

create index if not exists dumps_supermemory_idx on dumps (supermemory_id) where supermemory_id is not null;

alter table field_notes add column if not exists supermemory_id text;
alter table field_notes add column if not exists supermemory_status text;
alter table field_notes add column if not exists supermemory_synced_at timestamptz;

create index if not exists field_notes_supermemory_idx on field_notes (supermemory_id) where supermemory_id is not null;
