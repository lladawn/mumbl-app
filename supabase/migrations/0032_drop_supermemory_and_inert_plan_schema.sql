-- Remove dormant Supermemory runway and unused pre-product plan scaffolding.

drop index if exists dumps_supermemory_idx;
drop index if exists field_notes_supermemory_idx;
drop index if exists memory_entries_space_idx;

alter table dumps
  drop column if exists supermemory_id,
  drop column if exists supermemory_status,
  drop column if exists supermemory_synced_at;

alter table field_notes
  drop column if exists supermemory_id,
  drop column if exists supermemory_status,
  drop column if exists supermemory_synced_at;

drop table if exists memory_entries;
drop table if exists space_plans;

notify pgrst, 'reload schema';
