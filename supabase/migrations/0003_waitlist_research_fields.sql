-- Waitlist research fields.
--
-- Email alone teaches us nothing. The agent-collaborator landing asks two extra
-- questions so a signup doubles as research: who the team is, and which agent
-- tools they already run (which tells us the first integration to build).
--
-- All nullable: the existing landing form posts email only, and must keep working.

alter table waitlist_signups
  add column if not exists company text,
  add column if not exists team_size text,
  add column if not exists agent_tools text;
