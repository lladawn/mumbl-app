# Mumbl — product extension 01

> read alongside `mumbl-product-context.md`. this doc covers everything
> decided after that doc was written. if there's a conflict, this wins.

---

## domain

**mumbl.wtf** — the domain. registered. this is the one.

not mumbl.app (taken), not mumbl.space (considered and dropped), not
mumbl.io. mumbl.wtf is right because it names the feeling before you even
open the app. when someone shares `mumbl.wtf/r/backend-gremlins` on twitter,
people click it just because of the domain. the curiosity is built in.

every internal reference, every link, every OG tag, every share template
should use `mumbl.wtf`. the current deployment at `justmumbl.vercel.app`
should point to `mumbl.wtf` as the primary domain.

example room URL: `mumbl.wtf/r/backend-gremlins`
explore page: `mumbl.wtf/explore`

---

## product soul — the real reason mumbl exists

this section is for anyone making design, copy, or feature decisions on mumbl.
read it before building anything. it's the difference between building a
feedback tool and building something people actually love.

---

### the broken framing: work-life balance

"work-life balance" implies work and life are opponents — two things pulling
in opposite directions that you have to keep from touching each other. the
goal becomes escape: get through the workday so you can get to the real stuff.

but most people spend 8 to 10 hours a day at work. that *is* life. the
question isn't how to escape it — it's how to make it actually feel like
something worth being in.

mumbl is built on a different framing: **work is a part of life, not the
opposite of it.** the energy you bring to it, the people you share it with,
the small honest moments that happen inside it — those aren't separate from
living. they are living.

---

### the thing that actually makes work good

it's not the perks. not the mission statement. not the async-first policy.

it's having someone at work who gets your jokes. who knows when you're having
a bad day without you saying it. who makes the boring parts bearable and the
good parts actually fun. a friend.

gallup has tracked this for years — "having a best friend at work" is one of
the strongest predictors of engagement, retention, and output. not a
"high-performing team." not "psychological safety." a friend. someone you'd
genuinely miss if they left.

the problem is most workplaces optimise for output and treat friendship as a
byproduct. it either happens or it doesn't. usually in the first few weeks,
in a shared frustration over a broken deployment or a bad meeting, or it
doesn't happen at all — especially in remote teams where those accidental
moments never occur.

mumbl is where those moments happen on purpose. not through forced team
bonding. not through an icebreaker in a retro. through honest, low-pressure,
everyday expression — the stuff that shows who you actually are to the people
you work with every day.

---

### what the post types actually are

this is important. the features have a surface description and a real one.

| post type | surface description | what it actually is |
|-----------|--------------------|--------------------|
| **find** | share an interesting link or tool | showing your taste to people you spend every day with |
| **thought** | drop a half-formed observation | letting people see how your mind works |
| **rant** | vent something that needs saying | the beginning of an inside joke, or the moment someone realises they're not alone |
| **win** | share an achievement | letting people who were in the trenches with you know it mattered |
| **lol** | something funny that happened | an inside joke forming in real time |

the feature is the door. the friendship is what's on the other side.

---

### what the heartbeat actually is

on the surface: an AI-generated weekly summary of the team's mood and themes.

in reality: the week your team had together — named, remembered, and given
back to you. the thing that makes monday feel like a continuation of something
rather than a reset. the thing that, six months in, you scroll back through
and realise you actually lived something with these people.

---

### what mumbl should never feel like

- a survey
- a performance tool
- a corporate wellness initiative
- a product that takes itself too seriously
- a place where you have to be professional

---

### what mumbl should always feel like

- a group chat with the people you actually want to talk to at work
- the slack channel that actually stayed alive
- the place where the quiet person finally said something and everyone was
  glad they did
- something you open because you want to, not because you have to

---

### the north star sentence — updated

the original doc ends with this:

> "an engineer who has never spoken up in a standup drops something honest in
> the feed. the team reacts. for the first time they feel like their thoughts
> matter at work."

that's still true. but the bigger version is this:

> **work is where you spend your life. the right people make it feel like
> play. mumbl is how you find them — and how you stay found.**

every feature decision should be measured against this. if a feature makes
mumbl feel more like a feedback tool and less like a place where friendships
form, it's the wrong feature.

---

## why mumbl and not slack — the structural argument

the original doc covers this but codex needs the full picture to make the
right decisions when building features. here it is clearly:

| | slack channel | survey tools | mumbl |
|---|---|---|---|
| identity | your name, always | anonymous in theory | anonymous by default, structurally |
| manager visibility | yes, fully | results go to mgmt | heartbeat goes to team, not mgmt |
| searchable forever | yes | sometimes | no — posts are ephemeral by design |
| stays alive | dies in 2 weeks | nobody fills it in after week 3 | reactions + monday heartbeat create the return loop |
| gives something back | no | no | yes — heartbeat, vibe read, uplift |
| zero setup | needs workspace access | needs a form | link in 30 seconds, no account |

**the moments mumbl is built for that slack can never serve:**

1. the thought you won't say in standup — "sprint planning feels like theater."
   on slack this stays in your head. on mumbl it becomes a post, 14 reactions,
   and someone quietly fixes the retro format next sprint.

2. the thought you drop on an ordinary day — not a win, not a crisis. just
   "today was one of those days" or "anyone else feel like our deployment process
   is held together with tape?" on slack this evaporates. on mumbl it lands,
   gets a reaction from three people who felt the same thing, and the person
   who posted it feels slightly less alone in their workday. this is the
   everyday use case. this is most of what mumbl is.

3. the win nobody hears about — wins are real but rare, maybe once every two
   weeks. when they do happen, the quiet engineer who fixed the memory leak
   might drop it on mumbl. they might get reactions. that matters. but mumbl
   is not built around wins — it's built around the nine ordinary days between
   them.

3. the rant that needs to exist somewhere — on slack it's a complaint that
   might offend someone. on mumbl it's a rant badge, 19 reactions, and the
   team lead who reads the heartbeat quietly fixes the estimation process.

4. the remote engineer who feels like a ghost — no watercooler, no hallway.
   mumbl is the place that exists outside timezone pressure. post when you have
   a thought. react when you have a minute. read the heartbeat on monday.

**what slack will never be able to copy:** structural anonymity. slack is
identity-first by architecture. they cannot make anonymity the default without
breaking everything their product is built on. this is mumbl's permanent moat.

**why it stays alive when slack channels don't:**

- reactions take one tap — even lurkers contribute
- the monday heartbeat creates a reason to come back every week
- the heartbeat is screenshot-worthy — it brings new members in
- the creator posts first (see original doc) — seeds the culture before anyone
  else arrives so the space never feels empty

---

## public spaces — the culture observatory

this is a v2 feature. do not build it in v1. but design the data model to
support it from day one (see schema additions below).

### what it is

spaces are private by default. creators can opt in to make their space public.
public spaces contribute anonymised post data to a shared culture feed visible
at `mumbl.space/explore`.

the explore page shows:
- how many public spaces are active this week
- top themes across all public spaces (not individual posts — themes only)
- most common rant topic across the industry this week
- most reacted win type
- which team sizes are most active
- day of week with highest post volume across all spaces
- a live "culture pulse" — a one-liner about what engineering teams are
  collectively feeling right now

### why this is powerful

- it's real data. bottom-up. anonymous. not a linkedin poll, not a vendor
  survey. actual engineers saying actual things.
- it's shareable. "what are engineering teams stressed about this week?" has
  a live, honest answer that no other product can give.
- it's the growth engine. every share of the explore page brings new teams in.

### the weekly culture tweet

every monday, mumbl auto-generates a tweet from the explore data. generated
via claude API. posted to mumbl's twitter/X account.

format: short, funny, specific, honest. never generic.

example:
> "this week across 240+ engineering teams on mumbl:
> — 74% of rants were about sprint planning (classic)
> — tuesday was the most burned-out day
> — someone's CI pipeline improvement got 47 reactions (the people's champion)
> — 83% of posts were anonymous
> the machines are tired but they're still here."

this tweet is the top-of-funnel acquisition channel. it costs nothing and
it writes itself from real data.

### public space data rules

- no individual posts are ever shown on the explore page
- no space names are shown without creator opt-in
- only themes, aggregate counts, and percentages
- spaces can toggle public/private at any time — when toggled private, their
  data is removed from the aggregate within 24 hours
- public spaces get a small badge on their room page: "contributing to
  mumbl explore" — a nice signal for teams who care about the wider community

### schema additions for public spaces

```sql
-- add to spaces table
alter table spaces add column is_public boolean default false;
alter table spaces add column public_name text; -- optional display name for explore

-- weekly culture snapshots (for explore page)
create table culture_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,
  total_public_spaces int,
  total_posts int,
  total_reactions int,
  anon_percentage numeric(5,2),
  top_rant_theme text,
  top_win_theme text,
  most_active_day text,
  culture_pulse text,           -- one-liner generated by claude
  tweet_text text,              -- the weekly culture tweet copy
  created_at timestamptz default now()
);
```

---

## supermemory integration — team memory over time

**not v1. not v2. think of this as v2.5 or the feature that justifies the
pro plan.**

### the problem it solves

right now every week resets. the heartbeat captures the week but there's no
team memory. a team that's been on mumbl for 6 months has no way to ask:
- "what were we stressed about in february?"
- "how has our vibe changed since we shipped that feature?"
- "is the team actually doing better than 3 months ago, or does it just feel
  that way?"

supermemory solves this. it gives each team a searchable, longitudinal record
of their culture — without storing any individual post content, just the
weekly theme summaries and vibe reads.

### what gets stored in supermemory

after each heartbeat is generated, push to supermemory:

```json
{
  "space_id": "uuid",
  "week_of": "2025-05-05",
  "vibe_read": "heavy week but people showed up",
  "top_themes": ["sprint planning frustration", "deployment win", "unclear requirements"],
  "post_count": 9,
  "reaction_count": 47,
  "win_count": 3,
  "rant_count": 2,
  "energy_score": 62
}
```

no post content. no names. no session tokens. just the week's shape.

### what teams can do with it

- **team timeline** — a scrollable view of every week's vibe read going back
  to when they joined. see the shape of the team's year.
- **before/after tracking** — "3 months before we went async-first vs 3 months
  after." real evidence that process changes are working (or aren't).
- **ask mumbl** — a simple text input: "when were we most stressed?" or "what's
  changed in the last 6 weeks?" — answered from supermemory context via claude.
  no data leaves the team's namespace in supermemory.
- **culture report** — a quarterly PDF export of the team's vibe journey.
  managers will pay for this.

### when to add it

get teams posting for 4+ weeks first. memory without content is empty storage.
once you have teams with 8+ heartbeats in the system, the timeline view becomes
genuinely compelling. that's when you build the UI and wire up supermemory.

### the pitch for this feature

"we've been on mumbl for a year. here's what our team looked like in january
vs now. here's the week our energy spiked after we killed the daily standup.
here's the two-week dip when requirements were unclear. here's how we came back."

no other tool can show a team this. that's the pro plan upgrade moment.

### supermemory MCP server

the supermemory MCP server URL is: `https://mcp.supermemory.ai/mcp`

when making API calls that involve team memory (timeline queries, before/after
comparisons, "ask mumbl" feature), include the supermemory MCP server in the
request:

```javascript
mcp_servers: [
  {
    type: "url",
    url: "https://mcp.supermemory.ai/mcp",
    name: "supermemory"
  }
]
```

store all team data under a namespace keyed to `space_id` so there is zero
cross-team data leakage.

---

## revenue model

**the goal right now is not revenue. the goal is engineers enjoying mumbl so
much they share it. revenue follows love, not the other way around.**

### no limits on the free plan. ever.

the previous version of this doc had a 15-member cap and a 4-week history
limit. both are gone. here's why:

every limit is a reason not to share. "hey join our mumbl space" followed by
"sorry we hit the member cap" kills the energy instantly. mumbl grows when
engineers share it freely — unlimited members, unlimited history, unlimited
spaces. let it spread without friction.

the free plan is not a trial. it's the product. it stays whole, unlimited,
and shareable forever.

### how money comes in — engineer-led, company-paid

mumbl doesn't sell to managers. it doesn't have a sales team. it doesn't
cold email HR departments.

the model:
1. an engineer finds mumbl, creates a space, shares it with the team
2. the team uses it on free — no limits, no pressure, no expiry
3. weeks pass. the heartbeat becomes something people look forward to.
   friendships form in the feed. the space feels alive.
4. someone — usually the engineer who created it — thinks "this is genuinely
   making our team better. i want to support it / get more from it."
5. they ask the company to pay. $12/month is easier to approve than a
   team lunch. the heartbeat is the proof — "look what our team has been
   saying for the last 3 months."

the product never talks to managers. it talks entirely to the engineer who
found it. the landing page copy, the onboarding, every email — written for
that person, not their boss.

### pricing — flat, not per-seat. always.

| plan | price | who it's for |
|------|-------|-------------|
| free | $0 | anyone. no limits. forever. |
| pro team | $12/month | teams who want more on top of great |
| org | $49/month | companies with multiple teams (build when you have them) |

### free plan — unlimited everything

- unlimited spaces
- unlimited members
- unlimited heartbeat history
- full feed + all post types + reactions
- wins tab
- weekly heartbeat — vibe read + digest + uplift
- vibe over time
- public space option (opt-in)
- anonymous posting, always

### pro team — $12/month — additive only

nothing is taken away from free. pro adds things that only make sense after
a team has been using mumbl for a while and wants to go deeper.

- **supermemory team timeline** — searchable long-term memory of the team's
  culture. needs real data to be useful — only valuable after months of use.
- **before/after culture tracking** — compare team mood across periods.
- **monthly culture report** — a designed PDF of the team's journey. the
  thing you show in an all-hands or a retrospective.
- **custom vibe modes** — brand the space to the team's personality.
- **"ask mumbl"** — natural language queries over team history.

### what never goes behind a paywall

- the heartbeat — it's the reason people come back
- anonymity — always free, always on by default
- the explore page — public good and growth engine
- reactions — participation should never cost anything
- member count or history — no artificial limits, ever

### what drives the upgrade

not hitting a wall. not getting blocked. the upgrade happens when a team
genuinely wants more — more memory, more depth, more history. it's a pull,
not a push. build toward the moment where $12/month feels obvious because
the team already loves it and wants to go further.

---

## build order — ship fast, ship whole

the old v1/v2/v3 split is gone. with Codex, the constraint isn't build speed
— it's clarity. most features that were previously deferred to v2 or v3 are
small builds that make the product feel complete. ship them.

the real question isn't "what do we save for later" — it's "what needs to
exist on launch day for mumbl.wtf to feel alive and worth sharing."

### launch — build all of this before telling anyone

build in this order. each item should feel shippable before moving to the next.

**core loop**
1. landing page — headline, vibe picker, create → get link instantly
2. "you first" — after creating a space, prompt the creator to post before
   they see the share link. one post seeds the culture. empty rooms don't get
   joined.
3. space feed — view posts, member count, newest first
4. compose + post — post types (find/thought/rant/win/lol), anonymous toggle
   default on, 500 char limit
5. reactions — phrase-based ("i felt this · 8"), session dedup, one tap

**tabs**
6. wins tab — filtered feed view + 3 stat cards (wins this week / members
   posted / reactions given). small build, makes wins feel celebrated when
   they do happen.
7. heartbeat tab — monday AI digest + vibe read + uplift via claude API.
   this is not a v2 feature. it's the reason people come back. ship it.

**heartbeat extras — ship with heartbeat, not after**
8. vibe over time — last 4 weeks of heartbeat scores shown as a simple bar
   chart. you're already generating and storing this data. display it.
9. heartbeat history — scroll back through previous weeks. one query, one
   list view. tiny build, big feeling.

**public layer**
10. public spaces toggle — creator can opt their space in. default off.
11. explore page at mumbl.wtf/explore — aggregate themes from public spaces,
    top rant topic this week, most active day, live culture pulse one-liner.
    no individual posts ever shown.
12. weekly culture tweet — auto-generated monday morning from explore data
    via claude API. post to mumbl's twitter/X. this is the growth engine.

**pro plan**
13. pro plan at $12/month — stripe integration, flat pricing. additive only —
    no limits removed, only new features added (team timeline, culture report,
    custom vibe modes). the free plan stays completely whole.

**domain**
14. point mumbl.wtf to the deployment. update all OG tags, canonical URLs,
    share link templates from justmumbl.vercel.app → mumbl.wtf.

---

### defer only these — they genuinely need real users before they make sense

these aren't saved because build is slow. they're saved because they require
longitudinal data or paying customers that don't exist yet at launch.

- **supermemory team timeline** — needs 4-6 weeks of heartbeat data per team
  to be useful. wire it up after teams have history. this is the feature that
  makes the pro plan obvious — build it when the data exists.

- **"ask mumbl"** — natural language queries over team history. needs
  supermemory populated first. comes after team timeline.

- **org plan + cross-team insights** — needs multiple paying teams. build
  when you have them.

- **slack bot** — `/mumbl your thought here`. useful but not the growth
  engine. twitter is. defer.

- **SSO + company auth** — enterprise problem. not a launch problem.

- **mobile PWA** — the web experience should work well on mobile from day
  one (responsive), but a dedicated PWA is a later optimisation.

- **API access** — for teams who want to pipe mumbl data into their own
  tools. org plan feature, comes with that.

---

### the mindset

the old way: plan phases, protect scope, ship minimum viable.
the mumbl way: if it takes less than a day to build and makes the product
feel more alive — ship it at launch. the only reason to defer something is
if it literally cannot exist without data or users that don't exist yet.

codex is fast. use that. arrive at launch with something that feels whole.

---

## updated growth model

1. creator makes a space, posts first, shares the link on twitter/X
2. teammates join — they see a post already there, honesty is already welcome
3. someone posts something real, 14 people react — they feel heard
4. monday comes — the heartbeat is funny and honest and screenshot-worthy
5. someone screenshots it and posts it on twitter
6. the weekly culture tweet from mumbl's account adds fuel to the fire
7. a new person sees either of those and creates their own space
8. repeat

three acquisition channels, all free, all self-sustaining:
- **shared room links** — the core viral loop
- **heartbeat screenshots** — teams sharing their own monday digest
- **mumbl's culture tweets** — aggregate data from all public spaces, weekly

---

## what this extension adds to the data model

see schema additions in the public spaces section above. additionally:

```sql
-- team memory entries (for supermemory sync tracking)
create table memory_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id),
  heartbeat_id uuid references heartbeats(id),
  supermemory_key text,             -- the key used in supermemory
  synced_at timestamptz,
  created_at timestamptz default now()
);

-- plan/billing (when revenue is added)
create table space_plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id),
  plan text not null default 'free', -- free | pro | org
  billing_cycle text,                -- monthly | annual
  started_at timestamptz default now(),
  expires_at timestamptz
);
```

---

## open source — the decision and the timing

### why open source fits mumbl better than almost any other product

**the users are the contributors.** engineers are the audience. engineers are
also the people who, when they find a tool they love, open the source, fix the
thing that annoyed them, add the feature they wanted, and submit a PR. the
mumbl user and the mumbl contributor are literally the same person.

**it permanently answers the anonymity question.** anonymity is mumbl's core
promise. the number one thing engineers will wonder is "is this actually
anonymous or is it just a toggle?" open source answers that question forever.
they can read the code. they can see that user_id is null on anonymous posts.
no amount of marketing copy does what a public codebase does for trust.

**the community becomes the roadmap.** right now you're imagining what
engineers want. with open source, engineers who use mumbl tell you exactly
what they want — by filing issues, building it themselves, discussing it
publicly. the heartbeat ideas, the reaction phrases, the vibe modes — all
crowdsourced from people living inside the product every day.

**github becomes a second discovery channel.** a well-written README with a
clear problem statement and a live demo at mumbl.wtf will bring engineers in
who've never seen a tweet about it. trending on github is real traffic.

**it's the best content you'll ever have.** "mumbl is open source — if
something's annoying you, fix it" is a tweet engineers respond to. first
contributor gets a shoutout. first PR merged gets a heartbeat mention.

### when to go open source — the honest answer

not yet. here's the real-life scenario thinking:

**if you open source now:**
- the codebase is early and messy. contributors will look at it and either
  judge it or get confused. first impressions of an open source repo matter —
  a messy initial commit sets a tone that's hard to recover from.
- you'll spend time managing issues, PRs, and questions before you've figured
  out what the product even wants to be. that attention should be on building
  and talking to users right now.
- there's nothing in the repo yet that makes someone say "i want to contribute
  to this." the community forms around a product people love, not around a
  codebase that just appeared.

**if you open source after the first real users:**
- the README can show a live product at mumbl.wtf with real rooms and real
  heartbeats. "here's the thing, here's the code, go break it or build on it."
  that's a much more compelling open source launch.
- you'll have real feedback from real teams about what's missing — and those
  become your first GitHub issues, written from genuine experience, not guesses.
- the codebase will have been cleaned up by actually using it. contributors
  get something worth reading.
- the open source announcement becomes a second launch moment — separate from
  the product launch, generates its own attention.

**the right time:** after 4-6 weeks of real teams using mumbl. when you have
at least one heartbeat that made someone smile. when the core loop feels solid
and the code isn't embarrassing. then open source it with full intention —
a good README, a CONTRIBUTING.md written in mumbl's voice, and a tweet that
says "we built this for engineers and now we want engineers to build it with us."

### when you do open source — do it right

**repo:** `github.com/lladawn/mumbl` or a new org `github.com/mumblwtf/mumbl`

**README must:**
- open with the problem, not the features. one paragraph, honest, no jargon.
- link to a live demo at mumbl.wtf immediately
- explain how to run it locally in under 5 commands
- sound like mumbl talks — not corporate, not dry

**CONTRIBUTING.md must:**
- include the product soul section from this doc — contributors need to
  understand what they're building toward, not just how to submit a PR
- label easy issues as `good first mumbl` not `good first issue`
- make it clear: contributions to copy and voice are as welcome as code

**what stays out of the public repo:**
- the anonymity audit table schema — keep the break-glass moderation
  mechanism access-controlled. the schema can be documented separately.
  this isn't hiding anything — it's not making the moderation system a
  how-to guide for circumventing it.

---

an engineer who has never spoken up in a standup drops something honest in
the feed. the team reacts. for the first time they feel like their thoughts
matter at work. the heartbeat on monday names what the week was. the team
timeline six months later shows them they've grown.

that's the whole product. build toward that moment.
