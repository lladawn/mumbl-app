# Mumbl — product context for Codex

> "say the thing you've been mumbling all week."

---

## what is mumbl

Mumbl is a lightweight, anonymous-first team space where engineers can actually
be honest at work. Not in a survey. Not in a town hall. In a living, breathing
feed that feels like a group chat — but built for the thoughts people never say
out loud.

The name is the product. Engineers mumble. They have takes, frustrations, wins,
and observations that never make it past their own head because the cost of
saying them feels unpredictable. Mumbl is where those thoughts go.

Core phrases that should feel natural:
- "let's mumbl together"
- "drop it on mumbl"
- "check the team vibe on mumbl"
- "what's mumbl saying this week?"

---

## the problem

Engineers spend most of their waking hours at work — doing it to support their
lives, their families. The least the workplace can do is give them a space to
actually be human inside it.

Most engagement tools are built for extroverts: town halls, open Q&As, mandatory
fun. Technical people stay quiet — not because they have nothing to say, but
because the cost of saying it feels uncertain. In remote and async teams this
gets worse. No watercooler. No hallway. The real thoughts go to WhatsApp or
Twitter instead of somewhere they could actually change something.

A good team culture is one of the strongest drivers of product quality and
company growth. Mumbl exists to make that culture possible, even for teams that
only see each other on a Zoom grid.

---

## why mumbl and not Slack

This is the right question. The honest answer is structural, not a feature list.

**The real competition isn't Slack. It's silence.**

Most teams don't have a channel for honest thoughts — they have a #general where
people post memes and a #random that died in 2022. The "just make a Slack
channel" option has existed for years and almost nobody does it, because Slack
is identity-first by design. Your name is on everything. Your manager is in the
workspace. The company admin can search messages. That's not a safe place to say
"sprint planning feels like theater" — it's a performance stage where everyone
already knows who you are.

**Mumbl is anonymous-first by design.** The default isn't "choose to go
anonymous" — it's "you already are; choose to opt out." That single structural
difference changes what people say. Not because people are dishonest — but
because deciding whether to speak carries a tax. Anonymity removes that tax
entirely.

**But beyond anonymity, three things make mumbl stick:**

1. **Reactions that speak for you.** Most engineers will never post. But they'll
   react. A post with 14 people reacting "i felt this" is real signal. The
   lurker who never posts still contributes, still feels heard, still comes back.
   Slack reactions on messages in a work channel feel performative. Mumbl
   reactions are a secret vote.

2. **The Monday digest.** Engineers are analytical — they want to see patterns,
   themes, aggregate truth. The digest gives them that: a warm, funny, honest
   summary of how the week actually went. Not what the standup said. What the
   team *felt*. It's shareable, which is how new spaces get created.

3. **The team gets something back.** Mumbl isn't just a place to vent. Every
   week it reads the room and gives the team a heartbeat — a vibe read, the
   digest, and one small uplift. This is what makes it worth returning to.

**The one thing Slack will never be able to copy:** an engineer who's been
quiet in every standup for six months drops something honest in the feed, 14
people react to it, and for the first time in their job they feel like their
thoughts matter. Slack cannot do that. It never will.

---

## the core insight

**Anonymity removes the tax of deciding whether to speak.** When the default is
anonymous, engineers don't have to make a judgment call every time — they just
post. The thought gets out. The team gets signal. Things improve.

Second insight: engineers engage through doing and reacting, not talking. A
reaction, a one-liner, a quick poll — that's participation. A 60-minute
retrospective is not.

Third insight: **teams need to receive, not just give.** A feed that only takes
thoughts will eventually feel like a void. Mumbl closes the loop — the team
puts in, and every Monday something comes back that makes the week feel like it
mattered.

---

## the team heartbeat — what mumbl gives back

This is the feature that separates mumbl from a venting space. The team gets
something back. Not surveillance. Not management insight. Something for
*everyone* in the team.

Every Monday, alongside the digest, mumbl generates a **team heartbeat**. Three
parts:

### 1. the vibe read
Not a number. Not an NPS score. A feeling, written the way a smart teammate
would say it.

Examples:
- "heavy week, but people showed up — there's grit in here"
- "chaotic energy, high output, two people clearly need a break"
- "quiet on the surface, a lot going on underneath"
- "genuinely solid week — don't let anyone tell you otherwise"

The vibe read should feel like something a respected senior engineer would say
at the end of a week, not a wellness metric.

### 2. the digest
(see weekly wrap section below — this is the funny, honest weekly summary)

### 3. the uplift
One small, specific, zero-effort thing the team can do based on what mumbl
noticed. Not a lecture. Not a wellness tip. Something genuinely useful, written
the way one human would say it to another.

Rules for the uplift:
- specific to what actually happened this week, not generic
- zero-effort — it should take less than two minutes to act on
- conversational, not prescriptive
- never preachy, never corporate

Examples:
- "three people mentioned being blocked this week — maybe someone drops a
  'stuck on anything?' in the feed today. takes five seconds."
- "it's been a grind. someone share a win — even a small one. the team needs to
  hear one."
- "a lot of 'i felt this' reactions and not many replies — people are listening.
  whoever posted the thing about deployment anxiety: people heard you."
- "genuinely good week. someone find the teammate who had the big win and
  actually tell them directly. mumbl noticed."

The uplift must feel like advice from a smart teammate who read the room — not
a productivity coach, not a bot, not HR.

### what the heartbeat is NOT for
- not for managers to track individual performance
- not for HR to identify "low engagement" employees
- not for the company to mine sentiment data
- it exists for the team. it reads the room for the team. that's it.

This must be stated clearly in the product — "your heartbeat is for you, not
for management" — and enforced architecturally. The heartbeat is generated from
anonymised post data and is visible to everyone in the space. The creator does not
get a separate "manager view" of the heartbeat.

---

## how it works — the full user journey

### 0. the creator posts first
Before the invite link goes out, mumbl should prompt: **"drop something honest
before you invite your team — they'll post when they see you already did."**

This is not optional UX. An empty space kills momentum. The first post seeds the
culture. Whatever the creator posts — a thought, a rant, a win — becomes the
proof that honesty is welcome here.

Implementation: after the space is created, the share link is shown but also a
compose box is foregrounded with the message: "you first. what's actually on
your mind this week?" The share flow doesn't close until the creator has either
posted or explicitly dismissed the prompt.

### 1. create a room (30 seconds)

Anyone can create a team space on mumbl.wtf with no signup required. They:
- type a name for their space (e.g. "backend team", "design squad")
- pick a vibe: `chill & honest` / `chaotic good` / `professional-ish` / `gremlin mode`
- get a unique shareable link instantly: `mumbl.wtf/r/backend-gremlins`

No email. No password. No waiting. The vibe setting shapes the tone of the
space — the copy, the placeholder text, the weekly digest personality.

Creators can add a short room note after the room exists. Do not put this in
the create flow; the first room should still take about 30 seconds. The note is
for lightweight context once someone opens the link, not for onboarding theater.

### 2. share the link

The creator shares the link directly with teammates via:
- a pre-filled tweet/X post ("just set up a space for our team on mumbl — where
  we can actually be honest at work (anonymously). join us: mumbl.wtf/r/...")
- a pre-copied Slack message
- WhatsApp
- plain copy-paste

This is the growth loop. Every new space shared on Twitter is a mumbl ad. The
tweet copy should be genuine and human, not marketing.

### 3. teammates open the link

Clicking the link opens the team space directly. No account needed to read or
react. To post, a person picks a display handle or stays anonymous. That's it.
Mumbl does not record visits; if the link opens, they are in.

### 4. the feed lives

The space is a running feed of posts from the team. It stays alive because:
- people have things to say every day
- reactions feel good and take one tap
- the weekly heartbeat makes it worth checking every Monday
- the vibe is fun enough that posting feels like a break, not a task

Posts are the identity of the space. A space with 3 honest posts is more alive
than one with 40 silent visitors. The feed is the only signal of whether a space
is alive; mumbl does not count members, visitors, or joins.

---

## post types

These are the five things people can post. The type appears as a small badge.
The placeholder text for each should match the vibe of the space.

| type | what it's for | example placeholder (gremlin mode) |
|------|--------------|-------------------------------------|
| **find** | interesting link, tool, paper, technique | "sharing something chaotic i found..." |
| **thought** | observation, opinion, half-formed take | "okay hear me out..." |
| **rant** | frustration, venting, something that needs saying | "i need to say this somewhere safe..." |
| **win** | brag, shoutout, team achievement | "okay i need to brag for one second..." |
| **lol** | something funny that happened at work | "this just happened and i cannot..." |

---

## anonymity — the most important feature

- **anonymous by default.** every post defaults to anonymous. the toggle to post
  with your name is available but not the default. never flip this.
- anonymous posts store no user identifier in the posts table. ever.
- a separate encrypted audit table exists for moderation only — accessible to
  the space creator with break-glass confirmation. never surfaced casually.
- the weekly digest and heartbeat AI calls receive posts with all identity info
  stripped before the API request.
- copy throughout the app should reinforce this casually, not defensively.
  "anonymous · always" not "your privacy is protected by enterprise-grade..."

---

## reactions

Reactions are not emoji. They are short phrases, specific to the post type and
vibe of the space. Examples:

- "same energy · 12"
- "i felt this · 8"
- "legend · 21"
- "therapy needed · 4"
- "sending help · 3"
- "we are not worthy · 6"

The reaction labels should feel like things a teammate would actually say. They
are part of the product's personality. They can vary by vibe setting.

---

## Daily Prompt, Room Vibe, And Heartbeat Cards

- The feed can show one optional daily mumbl prompt, rotated every 24 hours and stored in the backend. Responding is voluntary.
- The room vibe bar is a small aggregate signal from today's most-used reactions across the space. It shows labels only, not people counts.
- Weekly heartbeats should be shareable as a visual card with vibe word, top theme, energy level, and a one-liner.
- These features must reinforce the product rule that posts and resonance are the identity of a space, not member tracking.

## the weekly heartbeat (AI-generated, every Monday)

The full Monday output is three things generated in one AI call:

1. **vibe read** — one to two lines, how the week felt in the team's voice
2. **digest** — 3–5 sentences, themes and mood, screenshot-worthy
3. **uplift** — one small specific thing the team can do right now

All three are generated from anonymised post content only. No names, no
session tokens, no attribution.

### rules for the digest portion:
- written in a warm, slightly funny voice — like a smart friend summarising the
  week, not a corporate newsletter
- covers themes and mood, never individual posts
- no names, no quotes, no attribution
- should be screenshot-worthy — people will share it, which brings new spaces
- length: 3–5 sentences. dense but readable.

### rules for the vibe read:
- one feeling, stated plainly
- written the way a human would say it at end of day Friday
- never positive-spin. if the week was rough, say so. that's what makes it
  trustworthy.

### rules for the uplift:
- specific, not generic
- under two minutes to act on
- sounds like a teammate, not a tool

### example heartbeat output (gremlin mode, backend team):

**vibe this week:** "heavy but alive — the kind of week where a lot got done
and nobody's quite sure how"

**digest:** "the gremlins had a week. someone's ticket lied about being a small
UI change and the team collectively processed that grief through 19 reactions.
riya destroyed the test suite (in a good way) and achieved brief legendary
status. sprint planning remains deeply controversial — the vote is roughly 14 vs
2 vs 8-need-therapy. a 2009 Stack Overflow answer saved someone's afternoon and
they want it acknowledged. overall vibe: chaotic, productive, alive."

**uplift:** "three people reacted to the sprint planning rant and nobody replied.
might be worth someone dropping an actual 'should we talk about this?' in the
feed. not a meeting. just a question."

---

Generated via Claude API (`claude-sonnet-4-20250514`). Single API call per
space per week. Prompt strips all user info, passes post content, type, and
reaction counts only. System prompt specifies vibe setting so the voice matches
the space.

---

## screens / views

### landing page (`mumbl.wtf`)
- headline: "say the thing you've been mumbling all week."
- subline: one sentence, human, no jargon
- single CTA: "create your space →"
- secondary: "already have a link? join a space"
- no feature list, no pricing table, no screenshots — just the invite

### create flow (single screen)
- space name input
- vibe picker (4 options, pill buttons)
- create button
- immediately shows: compose box ("you first — what's actually on your mind?")
  foregrounded above the share link
- share link + share options visible but secondary until first post is dropped
  (or creator dismisses)

### space view (`mumbl.wtf/r/:slug`)
- space name + vibe setting + date created. no member counts, no visit tracking, no pip avatars
- tabs: feed / wins / heartbeat
- compose box at the top of feed (always visible)
- anonymous toggle (default on) as a small pill, not a checkbox
- feed of posts, newest first
- each post: avatar (initials or ?) + name/anon + time + type badge + text + reactions

### wins tab
- filtered view of win posts only
- no stat cards. wins are just the filtered win posts; reaction counts stay on posts only
- same post card format

### heartbeat tab (replaces "weekly wrap")
- three cards stacked: vibe read / digest / uplift
- vibe read: short text in a larger type, muted color accent
- digest: styled card with left border accent
- uplift: action-forward card, slightly warmer tone
- small note: "generated every monday · anonymous data only · this is for the
  team, not management"
- previous heartbeats accessible by week — small week picker at top

---

## voice & copy rules

This is where mumbl lives or dies. The copy must feel like it was written by a
slightly chaotic senior engineer, not a product marketer.

**do:**
- write in lowercase where it feels natural (labels, placeholders, taglines)
- use "you" not "your team"
- be specific and a little dry: "the ticket lied about its own size"
- let reactions have personality: "i felt this" not "agree"
- make the heartbeat feel like something you'd screenshot and send to a friend
- be honest even when the news is bad: "rough week" not "challenging but
  growth-oriented"

**don't:**
- use words like: engage, leverage, culture-first, empower, collaborate,
  wellness, sentiment, insights
- add exclamation marks to serious features
- over-explain anonymity — just say "anonymous · always" and move on
- make onboarding feel like a form
- make the uplift sound like a self-help tip

---

## tech stack

- **frontend:** Next.js (React) — fast, component-friendly, good for SEO on landing
- **backend:** Next.js API routes or a lightweight Node/Express server
- **database:** PostgreSQL
  - `spaces` table: slug, name, vibe, created_at, creator_token
  - `posts` table: id, space_id, type, content, is_anonymous, display_name (nullable), created_at
  - `reactions` table: id, post_id, label, session_token, created_at
  - `heartbeats` table: id, space_id, week_of, vibe_read, digest, uplift, created_at
  - `anon_audit` table: id, post_id, hashed_session (break-glass only, creator access)
- **auth:** no auth for v1. spaces are identified by slug + a creator token stored
  in localStorage. mumbl does not track visits or membership. session tokens
  are used only for reaction dedupe and moderation audit hashes.
- **AI heartbeat:** Claude API weekly cron — strips identity, passes post content
  + reaction counts, returns vibe_read + digest + uplift in vibe-matched voice
- **deployment:** Vercel (frontend + API routes) + Supabase or Railway (PostgreSQL)

---

## data model detail

```sql
-- spaces
create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- e.g. "backend-gremlins"
  name text not null,                 -- e.g. "backend gremlins"
  vibe text not null default 'chill', -- chill | chaotic | professional | gremlin
  creator_token text not null,        -- stored client-side, proves ownership
  created_at timestamptz default now()
);

-- posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id),
  type text not null,                 -- find | thought | rant | win | lol
  content text not null,
  is_anonymous boolean default true,
  display_name text,                  -- null if anonymous
  created_at timestamptz default now()
);

-- reactions
create table reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id),
  label text not null,                -- e.g. "i felt this"
  session_token text not null,        -- prevents double-reacting
  created_at timestamptz default now(),
  unique(post_id, session_token, label)
);

-- weekly heartbeats (replaces digests)
create table heartbeats (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id),
  week_of date not null,
  vibe_read text not null,           -- one-liner: how the week felt
  digest text not null,              -- 3-5 sentence weekly summary
  uplift text not null,              -- one specific small action
  created_at timestamptz default now()
);
```

Anonymity note: anonymous posts store no session token. Reaction session tokens
are random browser UUIDs used only to prevent duplicate reactions, and moderation
audit hashes exist only for safety break-glass. Mumbl never records who opened or
opened a space, never displays identity analytics, and never uses session tokens
for people counting.

---

## AI prompt design — the heartbeat call

The prompt to Claude for the weekly heartbeat. Vibe is injected dynamically.

```
system:
You are generating the weekly heartbeat for a team using Mumbl, a private
anonymous team space. The vibe setting for this space is: {vibe}.

You will receive a list of posts from the past week (type and content only —
no names, no identifiers) along with reaction counts per post.

Return ONLY a JSON object with three fields:
- vibe_read: one to two sentences. how the week felt. written plainly, like a
  trusted teammate would say it on Friday evening. don't spin it.
- digest: 3 to 5 sentences. themes and mood. funny where the week was funny.
  honest where it was rough. never mention names. never quote posts.
  screenshot-worthy.
- uplift: one specific, small, zero-effort thing the team could do right now.
  written the way a human would say it. never preachy, never corporate. 

Voice for vibe {vibe}:
  chill: calm, thoughtful, a little warm
  chaotic: fast, observational, slightly unhinged in a good way
  professional: still human, measured, honest
  gremlin: chaotic good, dry, loves a bit

user:
Posts this week:
{posts_json}
```

The `posts_json` is an array of `{ type, content, reaction_count }` objects.
No session tokens, no display names, nothing traceable. Ever.

---

## what to build first (v1 scope)

Build in this order. Stop when it feels alive.

1. **landing page** — headline, vibe picker, create → get link flow
2. **"you first" prompt** — foregrounded compose box before share link is surfaced
3. **space feed** — view posts, see reactions, newest first. posts are the only signal that a space is alive
4. **compose + post** — anonymous toggle, post types, submit
5. **reactions** — tap to react, count updates, session dedup
6. **wins tab** — filtered view, stat cards
7. **heartbeat tab** — static first (hand-written for launch), then wire up
   Claude API on weekly cron

Everything else is v2.

---

## v2 ideas (post-launch)

- heartbeat history: scroll back through previous weeks — how has the team
  evolved? is the vibe trending better or worse over time?
- Slack bot: post to mumbl from Slack with `/mumbl your thought here`
- Space discovery: public spaces people can browse (opt-in)
- Challenges: weekly micro-activities (30-min refactor sprint, one-line wisdom)
  that create connection through doing
- Mobile app (PWA first, then native)
- Creator-only: aggregated sentiment trends — never individual-level, never
  identifying — for understanding team health over months
- Custom reaction labels per space vibe

---

## growth model

Mumbl grows when:
1. someone creates a space and shares the link on Twitter/X
2. the creator posts first — teammates open the link and see honesty is already here
3. someone posts something and 14 people react — they feel heard for the first
   time in a while
4. Monday comes and the heartbeat is screenshot-worthy — someone shares it
5. a new person sees that screenshot and wants one for their team

The product is the ad. Every shared link, every heartbeat screenshot, every
"we use mumbl" tweet is acquisition. No paid ads, no SEO content farm, no cold
outreach. Just make the product good enough that people want to show it to
their team.

---

## what mumbl is not

- not a performance review tool
- not a surveillance tool — creators cannot identify anonymous posters (break-
  glass audit exists only for safety moderation, not curiosity)
- not a replacement for 1:1s or real conversations
- not a public social network (spaces are private by default)
- not corporate — if the copy ever sounds like a LinkedIn post, rewrite it
- not a wellness app — the uplift is not "drink water" or "take a break"
- not for management — the heartbeat is for the team

---

## the one thing

If mumbl does one thing well, it's this: an engineer who has never spoken up in
a standup drops something honest in the feed, the team reacts to it, and for
the first time they feel like their thoughts matter at work.

The heartbeat closes that loop — the team doesn't just give, they receive. Every
Monday they know how the week actually went, and they know one small thing they
can do about it.

That's the whole product. Build toward that moment.
