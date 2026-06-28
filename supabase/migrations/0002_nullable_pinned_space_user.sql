-- Allow pinning a Slack space before the Slack user has a linked mumbl account.
-- Pins are keyed and read entirely by (slack_team_id, slack_user_id); the
-- mumbl_user_id column is denormalized and backfilled when the user connects.
-- Dropping NOT NULL lets `/mumbl join` pin a room in one step, with no Google
-- auth, for teammates who have never visited mumbl.
alter table slack_pinned_spaces
  alter column mumbl_user_id drop not null;
