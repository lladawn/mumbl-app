# Agent Presence — Stage 1

Stage 1 of the agent-collaborator prototype: get **real** agent state out of the
tools a team already runs and into a database, deterministically.

No world, no realtime, no MCP yet. This stage exists to answer one question
before anything expensive gets built:

> Does seeing agent state beat reading it?

If the answer is no, nothing downstream is worth building.

---

## Why hooks and not MCP first

Mumbl will ship an MCP server — it is the breadth play, one protocol instead of
one integration per framework, and it is the line in the pitch.

But an MCP tool only reports **when the model chooses to call it.** That is
unreliable, costs tokens, and degrades during long tasks — exactly when you most
want to see what is happening.

Claude Code hooks fire **deterministically**, outside the model's control. In
particular `Notification` fires when Claude is waiting on a human, which is the
`blocked` state — the one a terminal buries and a room can surface.

So both are adapters onto one ingest endpoint. Hooks make it real today; MCP
makes it broad later.

---

## Pieces

| Piece | Path |
|---|---|
| Schema | `supabase/migrations/0004_agent_presence.sql`, `0005_agent_event_occurred_at.sql` |
| Write path | `app/api/agents/ingest/route.js` |
| Server helpers | `src/server/agentPresence.js` |
| Reporter | `scripts/mumbl-report.mjs` |
| Provisioning | `scripts/agent-space-create.mjs` |

`agents` is *where a collaborator is now* (what the world will render).
`agent_events` is *what it has been doing* (what a side panel will read). Both
are written together, so the world can never show a state with no trail.

---

## Setup

**1. Apply migrations**

```bash
npm run db:push
```

**2. Create a space and keep the token**

```bash
node scripts/agent-space-create.mjs my-team "My Team"
```

The ingest token is printed once. Only its HMAC is stored, so it cannot be
recovered — create a new space if it is lost.

**3. Point Claude Code at it**

In `~/.claude/settings.json` (or a project `.claude/settings.json`):

```json
{
  "env": {
    "MUMBL_INGEST_TOKEN": "<token from step 2>"
  },
  "hooks": {
    "SessionStart":  [{ "hooks": [{ "type": "command", "command": "node /abs/path/scripts/mumbl-report.mjs" }] }],
    "PreToolUse":    [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node /abs/path/scripts/mumbl-report.mjs" }] }],
    "Notification":  [{ "hooks": [{ "type": "command", "command": "node /abs/path/scripts/mumbl-report.mjs" }] }],
    "Stop":          [{ "hooks": [{ "type": "command", "command": "node /abs/path/scripts/mumbl-report.mjs" }] }]
  }
}
```

Set `MUMBL_INGEST_URL` to `http://127.0.0.1:3000/api/agents/ingest` to test
against a local dev server.

---

## The contract

```
POST /api/agents/ingest
Authorization: Bearer <space ingest token>

{
  "agent":  { "id": "claude-code:<session>", "name": "...", "role": "...", "source": "claude-code" },
  "status": "idle" | "working" | "blocked" | "done",
  "task":   "Refactoring the auth module",
  "kind":   "PreToolUse",
  "detail": "Edit · auth/session.ts",
  "occurredAt": "2026-08-07T12:00:00.000Z"
}
```

Any new runtime is a new adapter onto this endpoint, not a new pipeline.

### Event ordering

`occurredAt` is stamped by the reporter, not the server. Hooks fire faster than
the round-trip: in testing, five concurrent hooks were inserted in an order that
put `Stop` **first**. Order the activity log by `occurred_at`, never
`created_at`. Implausible client clocks (>5 min future, >24 h past) fall back to
server time.

### Privacy

`current_task` and event `detail` carry repo, branch and command detail, so both
are encrypted at rest via the existing `encryptContentFields` path — the same
one posts use. Rows are readable only through the service role; RLS is on with
no policies.

---

## Known limits

- **Agent status is last-write-wins by arrival, not by `occurred_at`.** Real
  hooks fire sequentially per session so this is fine in practice, but two
  concurrent reports for one agent can settle on the older status. Fix with a
  conditional update when it starts mattering.
- **No read path yet.** Nothing renders this. That is the next piece.
- **Rate limit is per space** (`agent_ingest`, 300/min), so one noisy agent
  consumes the space's budget.
- **Realtime is not wired.** Stage 2 needs RLS read policies before a browser
  can subscribe — do that deliberately rather than loosening stage 1's.
- This breaks the posture in `free-tier-compromises.md` on purpose; see that
  doc's "future improvements" note.
