-- Office-sim phase 1 — add the plaintext SHAPE columns.
--
-- The office renderer self-assembles from what actors are *doing*: a design
-- table exists iff something emits category 'design', a coding desk iff
-- something emits 'coding', and so on. Those signals — tool, category, object —
-- are deliberately plaintext: they are the shareable shape, the exact opposite
-- of current_task/detail, which stay encrypted (see 0004 + encryption.js).
--
-- Additive and nullable, so every existing Claude Code row keeps working with
-- no backfill. The write path sets category='agent' for Claude Code going
-- forward; the read path treats a null category as 'agent' for the same reason.
--
-- Separate migration, not an edit to 0004/0005, because those are already
-- applied to staging — editing an applied migration silently diverges the two
-- databases. RLS stays closed (no policies): the read path is service-role and
-- decrypts server-side, honouring 0004's deliberate posture.

alter table agents
  add column if not exists tool     text,   -- SHAPE  e.g. 'figma','github','claude-code'
  add column if not exists category text,   -- SHAPE  fixed vocab: coding|design|writing|call|music|review|browsing|focus|agent
  add column if not exists object   text;   -- SHAPE  office-object hint, nullable

alter table agent_events
  add column if not exists tool     text,   -- SHAPE
  add column if not exists category text,   -- SHAPE
  add column if not exists object   text;   -- SHAPE
