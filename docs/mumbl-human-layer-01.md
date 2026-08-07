# mumbl — the human layer, plan 01

> read alongside `mumbl-mission.md`, `mumbl-product-context.md`, and
> `mumbl-extension-01.md`. this doc plans the next layer of work: not new
> plumbing, but the depth that makes the existing plumbing feel like being
> with people. if it conflicts with extension 01, extension 01 wins on
> mechanics; this doc wins on intent.

---

## what the human layer is

the mission doc says it in one image: washing dishes alone is a chore.
washing dishes with someone you love is one of the best parts of the day.
the task didn't change. the human context around it did.

mumbl has built the sink and the plumbing. private dump → field note →
team read works. the heartbeat comes back every monday. side quests exist.
reactions carry phrases instead of emoji. that's the infrastructure.

the human layer is what happens *between* those mechanics:

- the moment the person who spoke finds out they were heard
- the moment a reader gets to say one true sentence back
- the moment a team looks at its own past and realises it lived something
- the moment two people discover they get each other
- the moment a room develops language nobody outside it understands

none of these are features yet. all of them are almost within reach of the
features that exist. this plan closes those gaps — and nothing else.

---

## the filter — beauty vs. noise

every candidate in this doc, and every future one, passes through five
questions. fail any one and it's noise, however engaging it looks:

1. **does it make someone feel seen, or just pinged?**
   noise notifies. depth acknowledges. if the feature's value is "brings
   people back," it's a growth mechanic wearing a human costume.

2. **does it survive silence?**
   a real human-layer feature is still beautiful in a quiet week. streaks,
   activity meters, and "your team misses you" emails die without volume —
   which means they exist to manufacture volume.

3. **would this exist between friends?**
   friends don't send each other read receipts. they notice things, remember
   things, and say small true sentences at the right moment.

4. **does it deepen without counting people?**
   posts and resonance are the identity of a space. anything that needs a
   member count, a presence dot, or an engagement rate is out — permanently,
   structurally, no matter what it promises.

5. **is it for the team and invisible to management?**
   same rule as the heartbeat. if a feature would look good in a manager
   dashboard, it's the wrong feature.

---

## workstream 1 — being heard: the "it landed" moment

**the human moment.** the mission's definition of success: someone who never
speaks in standup drops something honest, three people react, and they feel
— for the first time in a long time at work — like they're there with people
who notice. today that moment happens *in the room*, but the author only
experiences it if they happen to go back and look. the loop closes for the
team and stays open for the person who spoke.

**the build.** a quiet, private surface in the author's own dump: next to a
field note they published, show the resonance it gathered — the actual
phrases, "i felt this · 6", "same energy · 3". no push notification, no
email, no badge count. it's discovered the next time they open their dump,
the way you find a note someone left on your desk.

copy stays small: "your read landed." nothing more.

**smallest honest version.** authors already own their published field notes
(edit tokens, optional logged-in continuity). render current reaction state
on the owner's dump / field-note view. one query joining owned field notes
to reaction counts, server-side, owner-scoped.

**guardrails.**
- never rank. no "your top post," no totals across posts, no history graph
  of personal resonance. that turns speaking into scoring.
- resonance shows on the author's own things only. no discovering what
  reacted to whom.
- if a read got zero reactions, show nothing special. absence of applause
  is not a state the UI should name.

---

## workstream 2 — echoes: one true sentence back

**the human moment.** reactions are a secret vote, and that's right — but
sometimes a phrase isn't enough. someone posts "deployment anxiety is
eating my week" and a teammate wants to say "same thing happened to us in
march, it passed." today that sentence has nowhere to go. a full comment
thread is the wrong answer — threads are slack: identity pressure,
performance, pile-ons. the hallway sentence after the meeting is the right
answer.

**the build.** an *echo*: one anonymous line under a team read. hard cap on
length (~140 chars). hard cap on count per read (three, maybe five). no
nesting, no echoes on echoes, no reactions on echoes. rendered quiet —
small, italic, under the read, like a margin note. when the cap is full,
the composer closes: what needed saying was said.

anonymous only for v1. names on echoes reintroduce the tax that anonymity
removed, exactly at the moment someone is being tender.

**smallest honest version.** a new `echoes` table shaped like posts minus
everything (post_id, encrypted content, created_at — no user id, no
session token stored on the row). server-mediated writes with the existing
rate-limit and encryption path. rendered in `PostCard`.

**guardrails.**
- the cap is the feature. scarcity keeps echoes meant. never raise it
  because "engagement."
- echoes feed the heartbeat only as anonymised content like posts do,
  or not at all in v1 — decide before shipping, default to not at all.
- an echo appears in workstream 1's "it landed" view for the author.
  that pairing — someone said a true thing back and you found it later —
  is the deepest single moment this plan builds.

---

## workstream 3 — memory: the team's lived time, given back

**the human moment.** extension 01 already names it: six months in, you
scroll back and realise you actually lived something with these people.
heartbeat history exists — but it's a list. lists are storage. memory is
when the past shows up at the right moment on its own.

**the builds, in order:**

**3a. callbacks in the heartbeat.** the weekly generation already receives
this week's anonymised reads. also pass it the last 4–8 stored heartbeat
rows (vibe reads and themes only — already anonymised by construction) and
let it look back when the look-back is real: "a month ago this room was
buried in the migration. it isn't anymore." zero new data collected. one
prompt change, one extra query in the cron path.

**3b. the season view.** the heartbeat tab has vibe-over-time as a signal.
add the narrative version: the vibe reads themselves, scrollable, week
after week, as one column of text. no chart, no axes. the shape of the
team's months in the team's own voice. one query, one list view — the
"tiny build, big feeling" pattern extension 01 already endorses.

**3c. the anniversary read.** rooms know their created_at. once a year, the
weekly cron notices and generates one extra read for the room: the arc of
the year from stored heartbeat rows. not a report — a toast. "a year ago
this room said its first honest thing out loud. here's what the year
sounded like." screenshot-worthy by design, which makes it a growth moment
that costs nothing and counts nobody.

**guardrails.**
- memory reads from stored heartbeats only. never from private dumps,
  never re-reading old post content, never slack.
- no trend judgment ("engagement declining"). the past is named, not graded.
- 3c waits until rooms are actually old enough. build 3a and 3b now;
  3c ships when the first real room approaches a birthday.

---

## workstream 4 — side quests: the friendship engine, deepened

**the human moment.** gallup's strongest predictor isn't "psychological
safety" — it's a friend. someone you'd genuinely miss. side quests are
mumbl's only two-person surface, which makes them the only place a
friendship can actually form rather than be gestured at. right now a quest
starts from a panel. friendships don't start from panels. they start from
*something someone said*.

**the builds, in order:**

**4a. start a quest from a read.** an affordance on a team read: "take this
to a side quest." you read something, an echo isn't enough, and you want to
say more — privately, still anonymous, still temporary. the read is the
door; this makes the handle visible. mechanically it's the existing side
quest creation seeded with a reference to the read that started it.

**4b. graceful endings.** quests are temporary by design — but today they
just stop. give the ending a shape: one closing card to both people.
"this quest is over. it existed. nothing was recorded." endings that are
named feel safe; endings that just happen feel like the rug moved.

**4c. the mutual reveal — design carefully, build later.** the biggest
moment this product could ever create: at the end of a quest, each person
privately answers one question — "want to keep talking as yourselves?" —
without seeing the other's answer. both yes: names are exchanged. anything
else: nobody ever learns anything, including that the question was asked.
this is the moment an anonymous connection becomes a workplace friendship
— the entire mission compressed into one mechanic. it is also the single
most sensitive thing mumbl could build, so it ships only after a real
design review of the failure modes (small teams where anonymity is thin,
pressure dynamics, one-sided hope). the double-blind property is
non-negotiable and must be enforced server-side, not by UI.

**guardrails.** everything already true stays true: same-room only,
anonymous, temporary, encrypted, never a count of anything.

---

## workstream 5 — the room's own language

**the human moment.** you know a team has become a team when it has words
outsiders don't get. the inside joke is the smallest unit of belonging.
mumbl's reactions are already phrases — but they're preset by vibe. a room
six months in should be reacting in its *own* dialect.

**the builds, in order:**

**5a. creator-added reaction phrases.** let the room creator add a custom
reaction label from the room sidebar. one small form, per-space labels
table, same dedupe mechanics. when "the ticket lied" keeps coming up in
reads, someone makes it a reaction, and from then on the room has a word.

**5b. the heartbeat proposes one.** later, the weekly generation — which
already reads the room's anonymised content — can notice a recurring
phrase and offer it: "'the ticket lied' came up three times this week.
want it as a reaction?" the room's language emerges from what the room
actually said. this is extension 01's "custom vibe modes" idea, but grown
from the inside instead of configured from the outside.

**guardrails.**
- creator curates, but phrases should come from the room's own reads.
  the proposal flow (5b) is the point; 5a is the manual bootstrap.
- cap active custom labels (a handful). a hundred reactions is a menu;
  five is a dialect.
- normal profanity is fine — engineers talk like engineers — but the
  creator owns removal, same as other creator controls.

---

## the anti-plan — noise we will never ship

named explicitly so nobody has to relitigate it under growth pressure:

- streaks, daily goals, posting quotas
- presence dots, "last seen," "X is typing," online counts
- read receipts of any kind
- leaderboards, top-poster anything, personal resonance totals
- push notifications and re-engagement emails ("your team misses you")
- more scheduled rituals. one ritual is a heartbeat; five rituals is a
  calendar. the monday heartbeat stays the only clock mumbl owns.
- anything that would make a manager say "can i get that as a dashboard"

each of these fails the filter, most on multiple counts. they are how
products with mumbl's shape die — by converting humans into metrics and
calling it community.

---

## sequence

ordered by depth-per-effort and by what needs longitudinal data:

**now — small builds on existing data**
1. workstream 1: "it landed" — owner-scoped resonance in the dump
2. workstream 3a: heartbeat callbacks — prompt + one query
3. workstream 2: echoes — one table, one card change, existing
   encryption/rate-limit path

**next — new mechanics, still small**
4. workstream 4a: side quest from a read
5. workstream 4b: graceful quest endings
6. workstream 5a: creator-added reaction phrases
7. workstream 3b: the season view

**later — needs age, data, or a design review**
8. workstream 3c: anniversary read (needs year-old rooms)
9. workstream 5b: heartbeat-proposed room language (needs recurring-phrase
   density)
10. workstream 4c: mutual reveal (needs a dedicated design review first;
    do not build casually)

everything in "now" and "next" fits the existing posture: next.js route
handlers, server-mediated writes, per-row encryption, existing cron
cadence, vercel hobby + supabase free tier. nothing here needs a new
service, a queue, realtime, or a paid tier.

---

## how we'll know it's working

not a metric. moments — the same standard the mission sets:

- someone screenshots an anniversary read or a heartbeat callback and
  sends it outside the room
- an echo makes the author of a hard read feel less alone, and they say
  so in the feed
- a side quest ends and both people are a little sad it's over
- a room reacts to something with a phrase that no other room would
  understand

we don't instrument these. we hear about them — because the product is the
ad, and teams that lived a moment tell other teams. that has been the
growth model since day one; the human layer is what gives them something
worth telling.

---

the task was never the problem. the code review is the same code review.
this plan is the dishes, done together.
