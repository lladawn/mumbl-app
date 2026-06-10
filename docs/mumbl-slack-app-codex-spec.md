# mumbl slack app — codex spec

## context

mumbl is a private-first work journaling and team memory tool. the web app is built on next.js, supabase, and vercel. the core loop is: private dump → field note → team read. the slack app is an **entry point** into this loop — it should feel like the lowest friction way to save a thought without leaving slack.

the slack app does NOT read channel history. it does NOT surveil. every action is user-initiated. this is non-negotiable and must be reflected in the scopes requested.

---

## what we're building

a slack app with three interaction surfaces:

### 1. slash command — `/mumbl`
the primary interaction. user types a thought, it saves as a private dump in mumbl.

```
/mumbl the approach we picked today feels wrong but i couldn't say it in the meeting
```

→ saves immediately as a private dump tied to that user's mumbl account
→ slack responds with an ephemeral message (only visible to sender):
  *"saved to mumbl. only you can see this. [open in mumbl →]*"

no channel noise. no public confirmation. completely private.

---

### 2. message shortcut — "save to mumbl"
right-click (or long-press mobile) any slack message → "save to mumbl"

→ saves that message as a private dump with source context (channel name, timestamp)
→ same ephemeral confirmation to the user

use case: someone says something useful in a thread. engineer saves it privately before it gets buried.

---

### 3. daily check-in bot DM
opt-in only. user enables via `/mumbl remind` command.

every day at a user-configured time (default 5pm local), mumbl bot sends a private DM:

> *what's one thing worth remembering from today?*
> [ type your reply here ]

user replies directly in DM → saved as private dump.

opt out anytime: `/mumbl remind off`

---

## architecture

### slack app config

**scopes needed (bot token):**
- `commands` — for /mumbl slash command
- `chat:write` — to send ephemeral confirmations and DMs
- `im:write` — to open DM channels for daily check-in
- `users:read` — to get user timezone for scheduled reminders
- `users:read.email` — to match slack user to mumbl account on first use

**do NOT request:**
- `channels:history`
- `conversations:history`
- `channels:read` (broad)

keep scopes minimal. this is critical for marketplace approval and user trust.

**event subscriptions needed:**
- `message.im` — to receive replies to daily check-in DM

**slash commands:**
- `/mumbl [text]` — save a dump
- `/mumbl remind [time]` — enable daily check-in
- `/mumbl remind off` — disable daily check-in

---

### backend — new endpoints to add to mumbl api

all endpoints require mumbl auth token (passed via slack user identity linking flow).

#### `POST /api/slack/dump`
saves a dump from slack.

```json
request:
{
  "slack_user_id": "U012AB3CD",
  "text": "the thing i noticed but didn't say",
  "source": "slack",
  "source_meta": {
    "channel": "C012AB3CD",     // optional, only for message shortcut
    "channel_name": "eng-team", // optional
    "ts": "1234567890.123456"   // optional slack message timestamp
  }
}

response:
{
  "dump_id": "uuid",
  "created_at": "iso timestamp",
  "web_url": "https://mumbl.wtf/dumps/uuid"
}
```

#### `POST /api/slack/connect`
links a slack user id to a mumbl account. called during oauth install flow.

```json
request:
{
  "slack_user_id": "U012AB3CD",
  "slack_team_id": "T012AB3CD",
  "email": "user@company.com"
}

response:
{
  "mumbl_user_id": "uuid",
  "connected": true,
  "is_new_user": false
}
```

#### `POST /api/slack/reminder`
toggle daily check-in for a user.

```json
request:
{
  "slack_user_id": "U012AB3CD",
  "enabled": true,
  "time": "17:00",  // 24h local time
  "timezone": "Asia/Kolkata"
}
```

---

### account linking flow

first time a user runs `/mumbl`, check if their slack user id is linked to a mumbl account.

if not linked:
→ send ephemeral message:
*"looks like this is your first mumbl dump from slack. connect your account to save it: [connect mumbl →]"*
→ link opens mumbl web app oauth flow, connects slack_user_id to mumbl_user_id in supabase
→ after connecting, the dump they tried to save is automatically saved

if linked: save immediately, no friction.

store in supabase:
```sql
table: slack_connections
columns:
  id uuid primary key
  mumbl_user_id uuid references users(id)
  slack_user_id text not null
  slack_team_id text not null
  reminder_enabled boolean default false
  reminder_time time default '17:00'
  timezone text default 'UTC'
  created_at timestamptz default now()
```

---

### daily reminder scheduler

use vercel cron (or supabase pg_cron) to run every 15 minutes.

query users where:
- reminder_enabled = true
- current time in their timezone matches their reminder_time (within 15 min window)
- haven't received a reminder today

send DM via slack bot. store last_reminded_at to avoid duplicates.

---

## file structure suggestion

```
/slack
  /app.js          — bolt app init, registers commands + shortcuts + events
  /commands
    /mumbl.js      — handles /mumbl slash command
    /remind.js     — handles /mumbl remind subcommand
  /shortcuts
    /saveMessage.js — handles "save to mumbl" message shortcut
  /events
    /dmReply.js    — handles user reply to daily check-in DM
  /utils
    /linkAccount.js — checks and handles slack↔mumbl account linking
    /formatDump.js  — formats incoming slack content as a mumbl dump
```

---

## ux copy (keep mumbl's voice — lowercase, honest)

| trigger | response |
|---|---|
| `/mumbl [text]` success | *"saved. only you can see this. [open in mumbl →]"* |
| `/mumbl` no account | *"connect your mumbl account to start saving thoughts from slack. [connect →]"* |
| message shortcut success | *"saved to mumbl privately. [open →]"* |
| daily check-in DM | *"what's one thing worth remembering from today?"* |
| reminder enabled | *"i'll check in at [time] every day. `/mumbl remind off` to stop."* |
| reminder disabled | *"no more check-ins. you can always `/mumbl` a thought anytime."* |

all responses are ephemeral (only visible to the sender) except the daily DM.

---

## marketplace readiness notes

- minimal scopes — no history reading. this is the key trust signal for both users and slack's review team.
- all user actions are opt-in and initiated
- privacy policy must explicitly state: mumbl does not read slack channels, does not store slack messages beyond what users explicitly save, users can delete their data
- app listing copy should lead with "private by default" — this is the differentiator

---

## what this is NOT

- not a slack bot that reads and summarizes channels (that's a different product)
- not a surveillance tool for managers
- not a public posting surface
- not a replacement for slack — it's a private layer that lives alongside it

---

## open questions for disha to decide before build

1. **auth approach**: oauth2 (recommended, required for marketplace) or api key paste (faster to build, worse ux)?
2. **reminder default**: opt-in (safer, lower engagement) or opt-out (higher engagement, slightly aggressive)?
3. **team installs vs individual**: does a workspace admin install mumbl for the whole team, or does each person install individually? individual install is simpler and more aligned with the private-first ethos.
4. **free or gated**: is the slack integration available to all mumbl users or only paid teams?

---

## suggested build order

1. set up slack app in api.slack.com, configure scopes and slash command
2. build `/api/slack/dump` endpoint in existing mumbl next.js app
3. build account linking flow (the most complex part — do this early)
4. wire up `/mumbl` slash command end to end
5. add message shortcut
6. add daily reminder (scheduler last — it's the most infra-heavy)
7. submit to slack marketplace

estimated solo build time: 3–5 days for core (steps 1–5), another 2 days for reminder + marketplace prep.
