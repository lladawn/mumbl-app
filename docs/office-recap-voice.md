# The recap voice — day archetypes, templates, and worked examples

_Content/voice spec, 2026-08-20. Author: Meredith (voice/copy). For the design agent wiring the "screenshot your day" recap card. Branch `feat/office-sim`._

_This doc is copy + logic only. It does not touch `opengraph-image.jsx`, `office-scene.js`, or any component. The design agent reads this and wires it in._

---

## 0. What this is

mumbl already has a working recap **prototype**: `app/office/[slug]/recap/opengraph-image.jsx` renders a "Spotify Wrapped for your workday" card from a per-app seconds breakdown (see `recapMock()` → `mockToRecap()` in that file, and the `daily_app_totals` data spec in `docs/office-visual-design.md` §7). Today it has exactly one voice: a static headline (`"{name}'s day."`) and a stat line (`"{date} · {n} tools · {time} focused"`).

The founder wants this to be **really fun** — the part of the card that makes someone screenshot it and send it to a friend, the way people do with Spotify Wrapped. That means the card needs to *notice what kind of day it was* and say something true and specific about it, not just report numbers.

This doc gives the design agent:
1. A taxonomy of **day archetypes** — the shape of a day, named and voiced.
2. A **template system** — the exact variables available, and the rules for picking a winning archetype from them.
3. **Fully worked examples** on different day shapes, headline + summary, ready to drop into the card.

---

## 1. The data this can actually use (ground truth)

Everything here is derived from `daily_app_totals` (shape-only: `space_id, external_id, day, tool, category, seconds`) per `docs/office-visual-design.md` §7, rolled up for one actor on one day. **No task content, no titles, no URLs — durations and shape tokens only**, same privacy boundary as the live office.

Category vocabulary is fixed (`docs/office-visual-design.md` §0): `coding | design | call | music | writing | browsing | review | focus | agent` (+ `other` → `focus`). "Terminal" is **not** its own category — terminal apps (`terminal`/`iterm`/`ghostty`/`warp`) roll up into `coding` (see `office-scene.js` `TOOL_LOOK`), they just get their own visual station. Use it as an **app-level** flavor detail (§4), not a category trigger.

**Available today, straight off the aggregate — no new columns:**

| Variable | From | Notes |
|---|---|---|
| `topApp` / `topAppSeconds` | `apps[0]` after sorting by seconds | e.g. `vscode`, `4h20m` |
| `topCategory` / `topCategorySeconds` | group `apps` by `category`, sort | e.g. `coding`, `5h05m` |
| `toolCount` | `apps.length` | distinct apps touched |
| `totalSeconds` | sum of all `apps[].seconds` | everything tracked that day |
| `focusedSeconds` | sum excluding ambient tools (`spotify`, `apple-music`, `other`) | already computed in `mockToRecap()` |
| `focusRatio` | `topApp.seconds / focusedSeconds` | **new, but free** — just a division. This is the single best "was it one thing or ten things" signal. |
| `categorySeconds[category]` | group-by-category sum | needed for e.g. `call` load, `music` share |
| `musicRatio` | `categorySeconds.music / totalSeconds` | ambient music share of the whole day |

**Needed, and small — flag to whoever owns `daily_app_totals`:**

| Variable | Why it's not free today | Cheapest fix |
|---|---|---|
| `meetingCount` | aggregate has seconds, not event/session counts | add a `sessions` int column, incremented once per contiguous dwell in a `tool`/`category` (cheap — same upsert path already increments `seconds`) |
| `longestBlockSeconds` | needs the length of the single longest unbroken dwell, not a sum | add a `max_session_seconds` column, updated as `greatest(existing, this_dwell)` on the same upsert |
| `switchCount` | needs a count of app-to-app transitions, not per-app totals | increment a `space_id/external_id/day` scalar `switches` counter once per heartbeat where `tool` differs from the previous heartbeat's `tool` |

None of these need new capture or new permissions — they're small additions to the *same* upsert-on-heartbeat path that already fills `seconds` (per §7's "no new capture, no heavy storage" note). Until they land, **§3 below marks which archetypes can ship on data available today vs. which need one of these three fields**, so the design agent can ship a first pass now and light up the rest later without a rewrite.

---

## 2. Voice rules

Calibrated against the two blog posts already in this voice: `your-work-has-a-shape` and `forty-seven-seconds` (`src/content/blog-posts.js`). Read those before writing more copy for this feature — this section is the compressed version.

**Do:**
- Be specific. "6h20m in VS Code, 4 calls, and exactly one Spotify binge" beats "a productive day." A real number is funnier than an adjective.
- Be a little cheeky. This is a card people screenshot for fun, not a performance review.
- Tell the truth the data actually supports. Every claim traces to a real field in §1 — no invented "productivity score," no 1–100 rating, no judgment about whether the numbers are *good*.
- Let contradictions be funny, not shameful. Ten tools and forty minutes of focus is a bit; it's not a problem to fix.
- Second person, present tense, direct: "you" did this, today.

**Don't:**
- No corporate voice. Never "leveraged," "optimized," "productivity," "efficiency," "insights," "actionable."
- No surveillance voice. Never "you were monitored for," "your activity shows," "tracked time." This is a fun mirror, not a report card.
- No shame, ever — about long meeting days, low focus days, low-activity days, or heavy multitasking. The Lurker and Context-Switch Chaos are jokes *with* the reader, not about them.
- No generic filler that could describe any day. If a headline works for someone who coded for 6 hours and also for someone who was in 5 meetings, it's not doing its job.
- No fabricated precision — round the same way the card already does (`fmt()` in the recap route: `4h20m`, `55m`, never `4.33 hours`).

---

## 3. Day archetypes

11 archetypes plus a fallback, ordered here for reading; §4 gives the actual selection order (ties matter). Each has: the signal it keys on, a headline template, a one-line summary voice, and a **ships-on** note (today's data vs. one of the three new fields from §1).

### 1. Deep Work Day
**Signal:** `focusRatio ≥ 0.65` and `toolCount ≤ 3`. One thing ate the day.
**Headline:** `"{topApp}, basically all day."`
**Summary:** `"{topAppSeconds} in {topApp}, {toolCount} other tabs open the whole time. That's not multitasking, that's a lockdown."`
**Ships on:** today's data.

### 2. Maker's Day
**Signal:** `coding` + `design` categories together ≥ 60% of `focusedSeconds`, `call` category < 15%.
**Headline:** `"you built something today."`
**Summary:** `"{codingTime} in the editor, {designTime} in {topDesignApp} — barely a meeting in sight. This was a making day, not a talking day."`
**Ships on:** today's data.

### 3. Shipping Day
**Signal:** `coding` category dominant AND at least two coding-category apps present with one being a terminal app (`terminal`/`iterm`/`ghostty`/`warp`) AND `review` category present (however small).
**Headline:** `"code, terminal, repeat."`
**Summary:** `"{editorTime} in {topApp}, {terminalTime} in the terminal, and a PR in the mix. Something shipped today."`
**Ships on:** today's data (uses per-app + category breakdown, no new fields).

### 4. Meeting Marathon
**Signal:** `categorySeconds.call ≥ 0.35 * totalSeconds`, OR (once `meetingCount` ships) `meetingCount ≥ 4`.
**Headline:** `"back-to-back-to-back."`
**Summary:** `"{callTime} on calls today — that's {callSharePct}% of everything tracked. Whatever got built happened in the gaps."`
**Ships on:** today's data for the time-share version; upgrade to counting actual meetings once `meetingCount` ships (more precise: "4 meetings" reads better than "35% of your day").

### 5. Context-Switch Chaos
**Signal:** `toolCount ≥ 7` and `focusRatio < 0.25`.
**Headline:** `"{toolCount} tools, no ringleader."`
**Summary:** `"Nothing today crossed {topAppSeconds}. You were everywhere for a little while — {topApp}, {secondApp}, {thirdApp}, and {toolCount minus 3} more."`
**Ships on:** today's data. (Gets sharper with `switchCount` later: "you switched apps {switchCount} times before lunch" is a great line once it exists.)

### 6. The Lurker
**Signal:** `browsing` + `review` categories together ≥ 55% of `focusedSeconds`, and `coding`/`design` combined < 20%.
**Headline:** `"a lot of reading, not much writing."`
**Summary:** `"{browsingTime} browsing, {reviewTime} reviewing — you looked at a lot today and typed very little of it."`
**Ships on:** today's data.

### 7. Chat Storm
**Signal:** a single chat-mapped app (e.g. `slack`) ≥ 30% of `totalSeconds`.
**Headline:** `"today was a conversation."`
**Summary:** `"{slackTime} in Slack alone — more time talking about the work than time visibly doing it. Sometimes that's the work."`
**Ships on:** today's data. Note the last line is doing real work not to read as an accusation — talking-about-work days are real days, not wasted ones.

### 8. Soundtrack Day
**Signal:** `musicRatio ≥ 0.35` (music running alongside real focused time — this archetype should never fire on a day with near-zero `focusedSeconds`, or it just reads as "you did nothing and listened to music," which is a different, less kind joke).
**Headline:** `"{topApp}, with a soundtrack."`
**Summary:** `"{musicTime} of music running under {focusedSeconds} of actual work. Almost an album's worth of focus."`
**Ships on:** today's data.

### 9. The Long Haul
**Signal:** `focusedSeconds ≥ 9 * 3600` (9+ hours), regardless of category mix. Checked **before** the category-specific archetypes below it in the priority order (§4) since raw duration is the more surprising fact on a very long day.
**Headline:** `"a long one."`
**Summary:** `"{focusedSeconds} tracked today, across {toolCount} tools. Hope there was a walk in there somewhere."`
**Ships on:** today's data.

### 10. Quiet Day
**Signal:** `totalSeconds < 90 * 60` (under 90 minutes tracked).
**Headline:** `"a quiet one."`
**Summary:** `"Only {totalSeconds} showed up in the office today. Could've been a light day, could've been a day that happened somewhere mumbl wasn't watching. Both are fine."`
**Ships on:** today's data. **Voice note:** this is the archetype most likely to accidentally read as surveillance-y or judgmental if the summary gets tightened later — keep the "somewhere mumbl wasn't watching" framing, it's the honest and kind read, not "you weren't productive."

### 11. Balanced Day
**Signal:** no other archetype's threshold is met — genuinely mixed, no dominant category or app.
**Headline:** `"a bit of everything."`
**Summary:** `"{topCategory} led with {topCategorySeconds}, but {secondCategory} and {thirdCategory} both got real time too. A normal, mixed-bag kind of day."`
**Ships on:** today's data. This is the fallback — see §4.

### 12. Fallback — no data
**Signal:** `totalSeconds === 0` or `apps.length === 0` (nothing tracked at all — new user, opted out, or a full off day).
**Headline:** `"nothing tracked today."`
**Summary:** `"Either an off day, or the office wasn't pointed at anything yet. Come back once you've connected a tool or two."`
**Ships on:** today's data. This is a distinct state from Quiet Day (some signal, just little) — don't merge them, the copy needs to know which one it's looking at.

---

## 4. Template system

### 4.1 Selection order (first match wins)

Evaluate top to bottom; the first archetype whose signal is true wins. This ordering matters — e.g. a day that's both very long *and* meeting-heavy should read as **The Long Haul** (the more surprising fact), not Meeting Marathon.

```
1.  no data at all               → Fallback (no data)
2.  totalSeconds < 90min         → Quiet Day
3.  focusedSeconds ≥ 9h          → The Long Haul
4.  focusRatio ≥ .65 & tools ≤3  → Deep Work Day
5.  slack (or chat app) ≥ 30%    → Chat Storm
6.  call ≥ 35% of total          → Meeting Marathon
7.  coding+terminal & review     → Shipping Day
8.  coding+design ≥ 60%, call<15%→ Maker's Day
9.  browsing+review ≥ 55%        → The Lurker
10. musicRatio ≥ .35              → Soundtrack Day
11. tools ≥7 & focusRatio < .25  → Context-Switch Chaos
12. (nothing else matched)        → Balanced Day
```

These thresholds are **starting points, not sacred numbers** — the design agent (or whoever wires real data) should sanity-check them against a week or two of real `daily_app_totals` once live data flows, and retune. What must not change without a voice pass: the *ordering logic* (surprising facts win over generic ones) and the *tone* (§2) of whatever replaces a threshold.

### 4.2 Variables the design agent fills

All derived per §1, formatted with the recap route's existing `fmt()` (`4h20m`, `55m` — never decimals, never "hours" spelled out in the compact stat line, spelled out is fine in the summary sentence).

| Placeholder | Example value |
|---|---|
| `{topApp}` | `VS Code` |
| `{topAppSeconds}` | `4h20m` |
| `{secondApp}` / `{thirdApp}` | `Figma` / `Zoom` |
| `{topCategory}` / `{secondCategory}` / `{thirdCategory}` | `coding` / `design` / `call` |
| `{topCategorySeconds}` | `5h05m` |
| `{toolCount}` | `6` |
| `{totalSeconds}` (formatted) | `9h50m` |
| `{focusedSeconds}` (formatted) | `6h50m` |
| `{callTime}` | `1h40m` |
| `{callSharePct}` | `35` |
| `{musicTime}` | `3h10m` |
| `{terminalTime}` | `45m` |
| `{editorTime}` | `3h35m` |
| `{designTime}` / `{topDesignApp}` | `2h05m` / `Figma` |
| `{browsingTime}` / `{reviewTime}` | `1h20m` / `40m` |
| `{slackTime}` | `2h45m` |
| `{meetingCount}` *(once shipped)* | `4` |
| `{switchCount}` *(once shipped)* | `31` |

Category-level time (`{callTime}`, `{designTime}`, etc.) is the sum of `seconds` for every app in that category that day — group `apps` by `category`, same as `topCategory`.

### 4.3 Formatting rules

- Time: always `{h}h{mm}` or `{m}m`, matching `fmt()` in the recap route exactly. Never `4.3 hours`, never spell out "four hours."
- App names: use the human `label` from `TOOL` in the recap route (`VS Code`, not `vscode`).
- Percentages: round to the nearest whole number, no decimal.
- Lists of 3+ apps in a summary: use the "and N more" pattern shown in Context-Switch Chaos, not a full comma list past three — keeps the card readable at OG-image scale.
- Never show `0` counts or `0m` durations in a summary — if a variable would render as zero, drop the clause instead of printing it.

---

## 5. Worked examples

Four different day shapes, using the recap route's own mock data style so these drop in as literal test fixtures.

### Example A — Deep Work Day
**Input:** VS Code 6h20m, Slack 25m, Chrome 15m. (`toolCount` 3, `focusRatio` ≈ 0.90)
**Headline:** `VS Code, basically all day.`
**Summary:** `6h20m in VS Code, 2 other tabs open the whole time. That's not multitasking, that's a lockdown.`

### Example B — Meeting Marathon
**Input:** Zoom 3h10m, Slack 1h05m, Notion 20m, VS Code 45m. (call share ≈ 58%)
**Headline:** `back-to-back-to-back.`
**Summary:** `3h10m on calls today — that's 58% of everything tracked. Whatever got built happened in the gaps.`

### Example C — Context-Switch Chaos
**Input:** VS Code 1h10m, Figma 55m, Slack 50m, Chrome 45m, Notion 30m, Zoom 25m, Spotify 20m, Terminal 15m. (`toolCount` 8, `focusRatio` ≈ 0.24)
**Headline:** `8 tools, no ringleader.`
**Summary:** `Nothing today crossed 1h10m. You were everywhere for a little while — VS Code, Figma, Slack, and 5 more.`

### Example D — Soundtrack Day
**Input:** VS Code 4h05m, Spotify 3h30m, Terminal 40m, Slack 20m. (`musicRatio` ≈ 0.40, `focusedSeconds` ≈ 5h05m)
**Headline:** `VS Code, with a soundtrack.`
**Summary:** `3h30m of music running under 5h05m of actual work. Almost an album's worth of focus.`

---

## 6. Open questions for whoever owns `daily_app_totals` next

1. **`sessions`, `max_session_seconds`, `switches`** — the three small columns in §1 that unlock `meetingCount`, `longestBlockSeconds`, and a sharper Context-Switch Chaos line. None require new capture, just a slightly richer upsert on the same heartbeat write. Worth doing before or right after the recap's real-data cutover, since it's the same migration moment.
2. **Threshold tuning** — every number in §4.1 is a guess calibrated on the recap route's own mock data (`recapMock()`), not real usage. Re-check against a week of real `daily_app_totals` once live.
3. **Weekly/monthly "Wrapped"** — `docs/office-visual-design.md` §7 notes the same aggregate over a wider `day` range gives a weekly recap for free. This voice system should mostly transfer (same archetypes, wider time buckets) but wasn't designed against week-scale numbers — worth a follow-up pass, not blocking v1.
