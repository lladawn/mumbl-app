# mumbl dump — feature spec

## what this is

a private-first space inside mumbl where anyone can dump what's on their mind about work — a thought, a process, a feeling, a realisation, a half-formed idea — at any point in the day. no pressure, no format, no audience unless you want one. over time it becomes a personal record of how you think and work. you can choose to share a dump with your team, or publish it publicly on your mumbl profile for anyone to read.

the core principle: **private by default, public by deliberate choice. never the other way around.**

the vibe: your dump is yours. messy is fine. one sentence is fine. a wall of text at 2am is fine. this is the place where you don't have to perform.

---

## the three layers

### 1. private dump (default)
- every entry is private by default. only you can see it.
- no signup required to start — works like the rest of mumbl, anonymous session first.
- write one sentence or five paragraphs. no format enforced. no title required.
- optional: AI reflection (not editing). after you write, AI can surface a thread — "you mentioned feeling stuck three times today — want to say more?" it reflects, it doesn't rewrite. ever.
- over time, AI builds a personal map of your dumps: recurring themes, emotional patterns, peak flow days, what you were working on and how it felt. shown as a private timeline only you can see.
- **nothing leaves your private dump without an explicit action from you.**

### 2. team dump
- from any private dump, you can choose to drop it into your mumbl team space.
- it appears in the team feed with a different visual treatment — labelled "dump", longer form, more personal tone than a rant/win/lol post.
- teammates can react (same reaction system as the rest of mumbl) but cannot publicly comment — keeps it from feeling exposed.
- still anonymous by default unless the user has explicitly chosen to attach their name.

### 3. team reads (the good part)
- inside every team room, a tab called **reads** surfaces dumps that team members have opted into sharing there.
- opt-in is per dump, not a global setting. you choose which dumps appear in reads.
- this is not a feed of everything — it's a curated window into how your teammates actually think.
- reading a senior engineer's dump on how they debug a hard problem, or how they felt about a rough sprint, is how coworkers stop being usernames and start being people.
- no reactions in the reads tab in v1 — just reading. keeps it feeling like a library not a performance stage.
- nothing appears in reads without an explicit opt-in action per dump.

### 4. public profile
- you can publish any dump to your public mumbl profile: `mumbl.wtf/@username`
- this requires creating an identity — either by logging in with github/google or creating a mumbl handle.
- once public, it's readable by anyone visiting your profile.
- your profile becomes a public record of how you actually think and work. not a portfolio. not a linkedin. not a blog. a dump.
- every published entry can be unpublished at any time. no questions asked.

Prototype note: before full auth exists, Mumbl supports a lighter version where an anonymous browser session claims a handle and adds selected published field notes to `mumbl.wtf/@handle`. This is still deliberate per-entry publishing. Drafts and private dumps stay out.

---

## identity and persistence model

this is the most important thing to get right. nothing is ever lost, nothing is ever exposed without explicit action.

```
anonymous session
      ↓
starts dumping (stored locally + server-side with anon session token)
      ↓
[optional] create mumbl handle OR link github/google
      → all previous dumps migrate to the account
      → nothing is lost
      ↓
[optional] choose to go public — per entry, never global
      → dumps remain private unless explicitly published one by one
```

- **anonymous users can dump and keep everything private.** entries persist via session token in localStorage + server.
- **creating an account changes nothing about visibility.** zero entries become public on signup.
- **public is always a per-entry deliberate action.** there is no "make all public" setting.

---

## data model additions

### dump table
```
id                  uuid primary key
session_id          string (anon session OR user id after account creation)
content             text
created_at          timestamp
updated_at          timestamp
visibility          enum: 'private' | 'team' | 'public'
team_room_id        uuid nullable (set when shared to team)
ai_reflection       text nullable (shown only to author, never auto-generated)
published_at        timestamp nullable
```

### user_profile table (new)
```
id                  uuid primary key
handle              string unique (e.g. 'disha')
display_name        string nullable
bio                 string nullable
auth_provider       enum: 'github' | 'google' | 'email' nullable
created_at          timestamp
```

### dump_insights table (new)
```
id                  uuid primary key
session_id          string
insight_type        enum: 'theme' | 'pattern' | 'streak' | 'graph_node'
content             jsonb
generated_at        timestamp
```

---

## routes

| route | description |
|---|---|
| `/dump` | private dump home — write, view past dumps, see your map |
| `/dump/new` | quick dump composer — open immediately, no friction |
| `/dump/map` | personal knowledge map — themes, patterns, timeline |
| `/room/:id/reads` | team reads tab — opt-in dumps from teammates |
| `/@:handle` | public profile — all published dumps |
| `/@:handle/:dump-id` | single published dump |

---

## UI behaviour

### dump composer
- dead simple. one text area, full width, no toolbar, no formatting options.
- placeholder rotates to keep it fresh. examples:
  - `what are you actually thinking about right now?`
  - `say the thing you didn't say in standup.`
  - `what happened today?`
  - `what's been sitting in your head all week?`
  - `dump it here.`
- character count optional, not enforced.
- below the text area, after writing: three soft action buttons
  - `keep it private` (default, always the first option)
  - `drop it in the team room` (only if user is in a room)
  - `publish to my profile` (only if user has a handle)
- optional AI reflection — a small toggle labelled "ask AI to reflect on this." off by default. if on, after saving, a short reflection appears below the dump in muted text. it never modifies the original entry.

### private dump feed
- chronological list, newest first.
- each dump shows: relative time ("3 hours ago"), first two lines, a small visibility pill (private / team / public).
- tap/click to expand.
- hover reveals: `share to team` and `publish` as ghost buttons — present but not pushy.

### dump map (`/dump/map`)
- visual timeline of dumps with recurring themes as coloured threads.
- AI summary at the top, refreshed weekly: "lately you've been dumping about deployment anxiety, the new project, and something good that happened on thursdays."
- feels like looking at your own brain from the outside. private only. never shareable.

### public profile (`/@handle`)
- clean reading experience. generous whitespace. no clutter.
- dumps listed newest first with the first line as the title and relative date.
- no reactions, no comments on public profiles in v1 — reading only.
- small "follow" placeholder button (UI only for now, no backend needed yet).
- bio at the top, short, written by the user. optional.

---

## AI integration

### 1. reflection (per dump, opt-in)
- triggered: user taps "ask AI to reflect on this" before or after saving.
- behaviour: reads the dump, identifies emotional texture and recurring threads, returns one short reflection — a question or an observation. does not summarise. does not rewrite. just listens and reflects back.
- shown inline below the dump in muted text, clearly labelled "ai reflection."
- can be dismissed or hidden.

### 2. dump map insights (private, weekly)
- triggered: background job, weekly, for users with 5+ dumps.
- generates: top recurring themes, emotional arc of the week, flow vs stuck ratio, notable patterns.
- stored in `dump_insights` table, rendered in `/dump/map`.
- never shared externally. never visible to the team or public.

### 3. heartbeat contribution (optional, future)
- if a user drops a dump into a team space, it can optionally contribute signal to the monday heartbeat alongside rant/win/lol posts.
- opt-in per dump. labelled separately in the heartbeat output as "from the dump."

---

## what NOT to build (keep this list)

- **no global explore or discover feed.** there is no browse-all-public-dumps feed for strangers. public profiles are visit-only via direct link.
- **no AI rewriting.** AI reflects and surfaces patterns. it never touches the content of a dump.
- **no forced signup.** anonymous dumping must work fully without an account. forever.
- **no public-by-default.** ever. not even as an option in settings.
- **no comments on public profiles in v1.** reactions and comments stay inside the team space only.
- **no notifications that feel like pressure.** no "you haven't dumped in 3 days!" no streaks. no guilt.

---

## copy and microcopy

get the words right — this is what makes it feel fun not clinical.

| element | copy |
|---|---|
| page title | `your dump` |
| empty state | `nothing here yet. what's been sitting in your head?` |
| save button | `keep it private` |
| share button | `drop it in the room` |
| publish button | `put it out there` |
| AI reflection label | `ai heard this` |
| map empty state | `dump more to see patterns form.` |
| public profile tagline | `how [name] actually thinks at work.` |
| reads tab label | `reads` |
| reads empty state | `no one has dropped anything here yet. share a dump with the team.` |
| reads opt-in button | `add to team reads` |
| after first dump | `it's in the dump. no one can see it but you.` |

---

## demo flow (for YC video)

1. open mumbl.wtf — no signup. tap "start your dump."
2. write something real about today. one paragraph. save privately.
3. AI reflection appears below — one line, honest, not cheesy.
4. show the dump map with a seeded demo state — themes forming, a small timeline.
5. drop one dump into the team room — it appears in the feed, longer form, different texture to the rant/win/lol posts.
6. publish one dump to a profile — `mumbl.wtf/@disha` loads. clean. human. real.
7. end on the profile. let it sit for a second. no voiceover needed.

---

## build order

1. dump composer + private entry storage (anon session)
2. private dump feed
3. account creation + entry migration
4. team drop action + feed integration
5. public profile + publish action
6. AI reflection (per entry, opt-in)
7. dump map + weekly insights

---

## the point

every feature in mumbl returns something human to the person who gave something honest. the dump is the most personal version of that. you write to understand yourself. the team layer helps your coworkers understand you. the public layer helps the world know how you actually think and work.

the mission is the same across all of it: make the biggest part of the day feel like a life, not something to get through.
