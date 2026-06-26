# mumbl pattern graph — codex spec
# pattern graph layer + supermemory removal + pgvector migration

## context for codex

this spec assumes full familiarity with the mumbl codebase.
stack: next.js app router, supabase, vercel, raw fetch for AI calls.
existing AI: openai via raw fetch in `src/server/fieldNotes.js`.
no openai SDK installed — keep using raw fetch consistently.
no pgvector currently — we are adding it.
supermemory is being removed entirely.

read these files before touching anything:
- `src/server/fieldNotes.js` — existing openai call pattern to follow
- `src/server/supermemory.ts` — what we are replacing
- `app/api/dumps/route.js` — existing dump save flow to extend
- `supabase/migrations/` — all existing migrations before writing new ones

---

## phase 0: supermemory removal

### what to remove

1. `src/server/supermemory.ts` — delete entirely
2. all imports of supermemory across the codebase — find and remove
3. all calls to supermemory sync — in dump save flow and field note flow
4. env vars to deprecate (do not delete from .env.example yet, just mark as deprecated):
   - `SUPERMEMORY_API_KEY`

### what to keep (columns stay, go dormant)

do NOT drop these columns yet — keep for data safety:
- `dumps.supermemory_id`
- `dumps.supermemory_status`
- `dumps.supermemory_synced_at`
- `field_notes.supermemory_id`
- `field_notes.supermemory_status`
- `field_notes.supermemory_synced_at`

just stop writing to them. they become inert. we drop them in a future migration
after confirming nothing depends on them.

### what replaces supermemory's semantic search

pgvector in supabase + our own embedding pipeline (see phase 1).
the dump map feature that used supermemory search will be rebuilt
on top of our own vectors in phase 2.

---

## phase 1: pgvector + signal extraction

### migration 0026 — enable pgvector and add signal layer

create file: `supabase/migrations/0026_pattern_graph.sql`

```sql
-- enable pgvector
create extension if not exists vector;

-- signal extraction table
-- one row per dump, populated async after dump save
create table if not exists dump_signals (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references dumps(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  -- extracted signals (nullable — extraction may fail gracefully)
  energy text check (energy in ('low', 'neutral', 'high')),
  emotions text[] default '{}',
  topics text[] default '{}',
  is_blocker boolean default false,
  signal_strength text check (signal_strength in ('strong', 'weak')),

  -- embedding vector (1536 dims for text-embedding-3-small)
  embedding vector(1536),

  -- processing state
  extraction_status text default 'pending'
    check (extraction_status in ('pending', 'done', 'failed')),
  extracted_at timestamptz,

  created_at timestamptz default now()
);

-- index for cosine similarity search
create index if not exists dump_signals_embedding_idx
  on dump_signals
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- index for fast user lookups
create index if not exists dump_signals_user_id_idx
  on dump_signals(user_id);

create index if not exists dump_signals_dump_id_idx
  on dump_signals(dump_id);

-- patterns table
create table if not exists patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- which dumps formed this pattern
  dump_ids uuid[] not null default '{}',

  -- the insight itself — in user's own words
  summary text not null,

  -- one question back to the user
  question text not null,

  -- time window this pattern covers
  period_start timestamptz,
  period_end timestamptz,

  -- user feedback on this pattern
  user_confirmed boolean,
  user_dismissed boolean,

  -- delivery state
  delivered_slack boolean default false,
  delivered_at timestamptz,

  -- what dump count triggered this
  triggered_at_count integer,

  created_at timestamptz default now()
);

create index if not exists patterns_user_id_idx
  on patterns(user_id);

-- track per-user dump counts for milestone triggering
-- this avoids a count(*) query on every dump save
create table if not exists user_dump_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_dumps integer default 0,
  last_insight_at_count integer default 0,
  updated_at timestamptz default now()
);
```

---

### new file: `src/server/signals.js`

signal extraction + embedding pipeline.
follow the same raw fetch pattern as `src/server/fieldNotes.js`.

```javascript
// src/server/signals.js

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = 'text-embedding-3-small';
// gpt-5.4-nano: released March 2026, purpose-built for extraction/classification
// $0.20/1M input + $1.25/1M output — cheaper and faster than gpt-4o-mini
// structured output mode guarantees valid JSON — no post-processing needed
const SIGNAL_MODEL = process.env.OPENAI_SIGNAL_MODEL || 'gpt-5.4-nano';

/**
 * extract structured signals from a dump's content
 * returns { energy, emotions, topics, is_blocker, signal_strength }
 */
export async function extractSignals(content) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: SIGNAL_MODEL,
      max_tokens: 200,
      // structured output mode — guarantees schema-valid JSON, no markdown wrapping
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `you extract structured signals from private work journal entries.
respond only with valid json matching this exact shape:
{
  "energy": "low" | "neutral" | "high",
  "emotions": string[],  // max 3, e.g. ["frustrated", "proud", "anxious"]
  "topics": string[],    // max 3, e.g. ["technical", "people", "process", "self"]
  "is_blocker": boolean, // true if person is stuck or blocked on something
  "signal_strength": "strong" | "weak" // strong = clear emotional signal, weak = neutral/ambiguous
}
be conservative. if unsure, pick neutral/weak. never invent signals not present in the text.`
        },
        {
          role: 'user',
          content: content.slice(0, 1000) // cap at 1000 chars for cost
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`signal extraction failed: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * generate embedding vector for a dump's content
 * returns float[] of length 1536
 */
export async function embedContent(content) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: content.slice(0, 2000), // embedding input cap
    })
  });

  if (!response.ok) throw new Error(`embedding failed: ${response.status}`);
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * process a dump: extract signals + embed + store in dump_signals
 * designed to be called async after dump save — never blocks the dump response
 */
export async function processDump(supabase, dumpId, userId, content) {
  try {
    const [signals, embedding] = await Promise.all([
      extractSignals(content),
      embedContent(content),
    ]);

    await supabase.from('dump_signals').upsert({
      dump_id: dumpId,
      user_id: userId,
      energy: signals.energy,
      emotions: signals.emotions,
      topics: signals.topics,
      is_blocker: signals.is_blocker,
      signal_strength: signals.signal_strength,
      embedding,
      extraction_status: 'done',
      extracted_at: new Date().toISOString(),
    }, { onConflict: 'dump_id' });

  } catch (err) {
    // never throw — signal extraction failure must not affect dump save
    console.error('processDump failed silently:', err);

    await supabase.from('dump_signals').upsert({
      dump_id: dumpId,
      user_id: userId,
      extraction_status: 'failed',
    }, { onConflict: 'dump_id' });
  }
}
```

---

### modify: `app/api/dumps/route.js`

extend the existing POST handler. after the dump is saved and response is returned,
trigger signal processing and milestone check async.

find the section after the dump insert succeeds and add:

```javascript
// existing: return serialized dump to client immediately
// NEW: fire async processing — do not await, never block the response

if (owner.user_id) {
  // only process for authenticated users (not anon session-only dumps)
  Promise.all([
    processDump(supabase, dump.id, owner.user_id, content),
    checkInsightMilestone(supabase, owner.user_id),
  ]).catch(err => {
    console.error('async dump processing error:', err);
  });
}
```

import at top of file:
```javascript
import { processDump } from '@/server/signals';
import { checkInsightMilestone } from '@/server/insights';
```

---

## phase 2: insight engine

### new file: `src/server/insights.js`

```javascript
// src/server/insights.js

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// claude-haiku-4-5: better nuance and emotional language than gpt-5.4-nano
// preserves author's intent — critical for insight prompts that quote user's own words
// use gpt-5.4-nano for extraction (structured JSON), claude-haiku for insight (language quality)
const INSIGHT_MODEL = 'claude-haiku-4-5-20251001';

// milestone thresholds: first insight at 10, then every 25
const FIRST_INSIGHT_AT = 10;
const INSIGHT_INTERVAL = 25;

/**
 * check if this user has crossed an insight milestone
 * called async after every dump save for authenticated users
 */
export async function checkInsightMilestone(supabase, userId) {
  // upsert user dump count
  const { data: countRow } = await supabase
    .from('user_dump_counts')
    .upsert(
      { user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  // increment count
  const newCount = (countRow?.total_dumps || 0) + 1;
  const lastInsightAt = countRow?.last_insight_at_count || 0;

  await supabase
    .from('user_dump_counts')
    .update({ total_dumps: newCount, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // check milestone
  const isFirstMilestone = newCount === FIRST_INSIGHT_AT;
  const isSubsequentMilestone =
    newCount > FIRST_INSIGHT_AT &&
    newCount - lastInsightAt >= INSIGHT_INTERVAL;

  if (!isFirstMilestone && !isSubsequentMilestone) return;

  // milestone hit — generate insight
  await generateAndDeliverInsight(supabase, userId, newCount);

  // update last insight count
  await supabase
    .from('user_dump_counts')
    .update({ last_insight_at_count: newCount })
    .eq('user_id', userId);
}

/**
 * fetch recent dumps with signals for a user
 */
async function fetchRecentDumpsWithSignals(supabase, userId, limit = 15) {
  const { data } = await supabase
    .from('dumps')
    .select(`
      id,
      content,
      created_at,
      dump_signals (
        energy,
        emotions,
        topics,
        is_blocker,
        signal_strength
      )
    `)
    .eq('user_id', userId)
    .eq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * generate insight from dumps using claude-haiku-4-5
 * using anthropic API — same raw fetch pattern, different endpoint
 * returns { summary, question }
 */
async function generateInsight(dumps) {
  // format dumps for the prompt — include signals if available
  const formatted = dumps.map((d, i) => {
    const signals = d.dump_signals?.[0];
    const signalLine = signals
      ? `[energy: ${signals.energy}, emotions: ${signals.emotions?.join(', ')}, blocker: ${signals.is_blocker}]`
      : '';
    return `dump ${i + 1} (${new Date(d.created_at).toDateString()}):
${signalLine}
"${d.content.slice(0, 400)}"`;
  }).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: INSIGHT_MODEL,
      max_tokens: 300,
      system: `you are a thoughtful, private mirror for someone's work experience.
you have access to their recent private journal entries from work.
find 1-2 genuine patterns in what they've written.

rules:
- use their own words and phrases where possible — quote them directly
- never diagnose, score, or rate them
- never use corporate language ("leverage", "synergy", "productivity")
- write like a thoughtful friend who noticed something, not a therapist or manager
- the summary should feel like a gentle observation, not an analysis
- the question should be curious and open, not leading
- keep summary under 80 words
- keep question under 20 words
- if there's no clear pattern, say so honestly — "not enough signal yet to see a clear pattern"

respond only with valid json, no markdown fences:
{
  "summary": string,
  "question": string
}`,
      messages: [
        {
          role: 'user',
          content: `here are my recent work journal entries:\n\n${formatted}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`insight generation failed: ${response.status}`);
  const data = await response.json();
  const text = data.content[0].text;
  // strip any accidental markdown fences before parsing
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * generate insight and save to patterns table
 * deliver via slack DM if connected
 */
export async function generateAndDeliverInsight(supabase, userId, dumpCount) {
  const dumps = await fetchRecentDumpsWithSignals(supabase, userId);
  if (dumps.length < 5) return; // not enough to say anything meaningful

  const insight = await generateInsight(dumps);

  // save to patterns table
  const { data: pattern } = await supabase
    .from('patterns')
    .insert({
      user_id: userId,
      dump_ids: dumps.map(d => d.id),
      summary: insight.summary,
      question: insight.question,
      period_start: dumps[dumps.length - 1].created_at,
      period_end: dumps[0].created_at,
      triggered_at_count: dumpCount,
    })
    .select()
    .single();

  // attempt slack delivery
  await deliverInsightViaSlack(supabase, userId, insight, pattern.id);
}

/**
 * deliver insight as private slack DM
 * fails silently if user has no slack connection
 */
async function deliverInsightViaSlack(supabase, userId, insight, patternId) {
  try {
    // get slack connection for this user
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('slack_user_id, slack_team_id')
      .eq('mumbl_user_id', userId)
      .single();

    if (!connection) return; // no slack connection — insight waits in web app

    // get bot token for this team
    const { data: installation } = await supabase
      .from('slack_installations')
      .select('bot_token') // adjust column name to match your actual schema
      .eq('slack_team_id', connection.slack_team_id)
      .single();

    if (!installation?.bot_token) return;

    const SLACK_BOT_TOKEN = installation.bot_token; // encrypted — decrypt if needed

    // open DM channel
    const dmRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ users: connection.slack_user_id }),
    });

    const dmData = await dmRes.json();
    if (!dmData.ok) return;

    // send the insight as a private DM
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: dmData.channel.id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*something we noticed* 🌱\n\n${insight.summary}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `_${insight.question}_`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `only you can see this. <https://mumbl.wtf/patterns|view your patterns →>`
              }
            ]
          }
        ]
      }),
    });

    // mark as delivered
    await supabase
      .from('patterns')
      .update({ delivered_slack: true, delivered_at: new Date().toISOString() })
      .eq('id', patternId);

  } catch (err) {
    console.error('slack insight delivery failed silently:', err);
    // never throw — delivery failure must not affect anything upstream
  }
}
```

---

## phase 3: pattern confirmation UI

### new api endpoint: `app/api/patterns/[patternId]/feedback/route.js`

```javascript
// POST — user confirms or dismisses a pattern
// body: { confirmed: boolean }

export async function POST(request, { params }) {
  const { patternId } = params;
  const { confirmed } = await request.json();

  // resolve owner — must be authenticated user
  const owner = await resolveRequestOwner(request, supabase);
  if (!owner.user_id) {
    return Response.json({ error: 'auth required' }, { status: 401 });
  }

  // update pattern — only if it belongs to this user
  const { error } = await supabase
    .from('patterns')
    .update({
      user_confirmed: confirmed === true ? true : null,
      user_dismissed: confirmed === false ? true : null,
    })
    .eq('id', patternId)
    .eq('user_id', owner.user_id);

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ ok: true });
}
```

### new api endpoint: `app/api/patterns/route.js`

```javascript
// GET — fetch patterns for current user
// returns patterns ordered by created_at desc
// excludes dismissed patterns by default

export async function GET(request) {
  const owner = await resolveRequestOwner(request, supabase);
  if (!owner.user_id) {
    return Response.json({ patterns: [] });
  }

  const url = new URL(request.url);
  const includeDismissed = url.searchParams.get('includeDismissed') === 'true';

  let query = supabase
    .from('patterns')
    .select('*')
    .eq('user_id', owner.user_id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!includeDismissed) {
    query = query.not('user_dismissed', 'eq', true);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ patterns: data });
}
```

---

## phase 4: dump map rebuild (replaces supermemory search)

### new api endpoint: `app/api/dumps/map/route.js`

semantic search over user's own dumps using pgvector cosine similarity.
replaces the supermemory-based dump map.

```javascript
// GET /api/dumps/map?q=feeling+stuck
// returns semantically similar dumps to the query

export async function GET(request) {
  const owner = await resolveRequestOwner(request, supabase);
  if (!owner.user_id) return Response.json({ results: [] });

  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  if (!query) return Response.json({ results: [] });

  // embed the search query
  const { embedContent } = await import('@/server/signals');
  const queryEmbedding = await embedContent(query);

  // cosine similarity search via pgvector
  const { data } = await supabase.rpc('search_dumps_by_embedding', {
    query_embedding: queryEmbedding,
    match_user_id: owner.user_id,
    match_threshold: 0.75,
    match_count: 10,
  });

  return Response.json({ results: data || [] });
}
```

add this postgres function to migration 0026 as well:

```sql
create or replace function search_dumps_by_embedding(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.75,
  match_count int default 10
)
returns table (
  dump_id uuid,
  content text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    d.id as dump_id,
    d.content,
    d.created_at,
    1 - (ds.embedding <=> query_embedding) as similarity
  from dump_signals ds
  join dumps d on d.id = ds.dump_id
  where ds.user_id = match_user_id
    and ds.embedding is not null
    and 1 - (ds.embedding <=> query_embedding) > match_threshold
  order by ds.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## phase 5: slack home update

update `app_home_opened` event handler to show pending insight notification
if user has an undelivered or unread pattern.

add to the existing app home blocks when a pending pattern exists:

```javascript
{
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: '🌱 *something we noticed about your work* — <https://mumbl.wtf/patterns|see your pattern →>'
  }
}
```

---

## environment variables to add

add to `.env.example`:

```
# pattern graph — signal extraction
# uses existing OPENAI_API_KEY — no new key needed
# model: gpt-5.4-nano (released March 2026) — purpose-built for extraction
OPENAI_SIGNAL_MODEL=gpt-5.4-nano

# pattern graph — insight generation
# uses existing ANTHROPIC_API_KEY (already in codebase via claude API)
# model: claude-haiku-4-5 — better nuance/emotional language than openai small models
# do NOT use OPENAI_API_KEY for insights — route to anthropic

# embedding model: text-embedding-3-small ($0.02/1M tokens — negligible at this scale)

# deprecated — to be removed after supermemory migration confirmed stable
# SUPERMEMORY_API_KEY=
```

---

## build order for codex

do these in strict order. each phase is independently testable.

1. **phase 0** — remove supermemory imports and calls. confirm nothing breaks. deploy.
2. **phase 1 migration** — write and apply migration 0026. confirm pgvector extension loads on staging.
3. **phase 1 signals** — build `src/server/signals.js`. test extractSignals and embedContent in isolation with a hardcoded dump string.
4. **phase 1 hook** — add async processDump + checkInsightMilestone call to dump save endpoint. confirm existing dump save is unaffected (async errors caught).
5. **phase 2 insights** — build `src/server/insights.js`. test generateInsight with real dump data. test deliverInsightViaSlack against your own slack account.
6. **phase 3 API** — build patterns GET and feedback POST endpoints.
7. **phase 4 dump map** — rebuild dump map on pgvector. test semantic search with real dumps.
8. **phase 5 slack home** — update app home to surface pending patterns.

---

## things codex must NOT do

- do not add pgvector migration without confirming the extension is available on staging supabase — run `select * from pg_extension where extname = 'vector'` first
- do not drop supermemory columns from dumps or field_notes — leave them inert
- do not await processDump or checkInsightMilestone in the dump save response path — always fire and forget
- do not expose dump content in pattern API responses — patterns table only, no dump content in GET /api/patterns
- do not generate insights for anon/session-only users — only authenticated users with user_id
- do not install openai SDK or anthropic SDK — use raw fetch consistent with existing codebase
- do not use openai for insight generation — route insights to anthropic API (claude-haiku-4-5) for better language quality
- do not use OPENAI_MODEL_FIELD_NOTE env var for signals — use OPENAI_SIGNAL_MODEL which defaults to gpt-5.4-nano

---

## cost estimate (verified June 2026)

**per dump on save:**
- signal extraction via gpt-5.4-nano: ~200 tokens in + 50 out = $0.00004
- embedding via text-embedding-3-small: ~500 tokens = $0.00001
- total per dump: ~$0.00005 (half a cent per 10,000 dumps)

**per insight (every 10/25 dumps):**
- claude-haiku-4-5: ~3000 tokens in + 300 out ≈ $0.0045

**for 100 active users writing 2 dumps/day:**
- signals: 200 dumps/day × $0.00005 = $0.01/day
- insights: ~8 insights/day × $0.0045 = $0.036/day
- total: ~$0.046/day = **~$1.40/month**

negligible. pgvector storage on supabase free tier: 500MB included.
a 1536-dim float32 vector = ~6KB. 10,000 dumps = ~60MB. room for ~80,000 dumps on free tier before storage is a concern.

---

## infrastructure notes (verified June 2026)

**supabase free tier:**
- pgvector included on all plans including free ✅
- 500MB database storage, 50k MAU, unlimited API requests
- ⚠️ projects pause after 1 week of inactivity — add a keep-alive ping
- fix: add a github actions workflow (free since April 2026) that hits your supabase URL every 5 days

```yaml
# .github/workflows/keep-alive.yml
name: keep supabase alive
on:
  schedule:
    - cron: '0 9 */5 * *'  # every 5 days at 9am UTC
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -f ${{ secrets.SUPABASE_URL }}/rest/v1/ -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

**vercel cron (hobby free tier):**
- 2 cron jobs max, once-per-day minimum cadence
- the count-based milestone trigger needs no cron — stays event-driven ✅
- if you later add daily reminder DMs: use cron-job.org (free, unlimited jobs, 1-minute granularity) — just points at your existing vercel API route, no code changes needed

**future paid upgrade path (for reference only — not needed now):**
- supabase pro: $25/month — worth it at ~500 active users
- vercel pro: $20/month — only needed if you want sub-hourly crons built-in
- text-embedding-3-large: $0.13/1M tokens — 6.5x more expensive, marginal quality gain for short dumps. not worth it.
