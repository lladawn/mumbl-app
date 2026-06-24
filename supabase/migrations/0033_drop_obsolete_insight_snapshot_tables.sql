-- Drop obsolete pre-pattern insight and explore snapshot tables.
drop table if exists dump_insights;
drop table if exists culture_snapshots;

notify pgrst, 'reload schema';
