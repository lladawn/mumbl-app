# Pattern Graph

The pattern graph is Mumbl's private sensemaking layer for logged-in dumps. It reads a user's own private dump history, finds recurring work patterns, and gives the user a private place to review them before anything becomes a team read.

This is not team analytics. It is not room intelligence. It is not a manager view. It belongs to the logged-in person who wrote the dumps.

## Product Intent

Mumbl's dump is where people write the messy thing before it is ready for anyone else. The pattern graph helps that private writing become useful without forcing the user to publish, summarize, or explain themselves too early.

The surfaces are intentionally split:

- `/dump/map` is the working map. It is an exploratory view of active themes, connected evidence, and the strongest current read.
- `/patterns` is the review inbox. It shows generated insight moments the user can confirm or dismiss.

The user should not need to understand embeddings, milestones, or model routing. The product promise is simpler: "Mumbl noticed something in your private dump. Does this feel true?"

## Privacy Rules

- Only logged-in private dumps are AI-processed for the pattern graph.
- Anonymous/session-only dumps are excluded.
- Pattern APIs are owner-scoped by server route handlers.
- Pattern APIs must never return source dump content.
- Source dump IDs may be stored privately for cleanup and evidence linking, but public or room surfaces must not expose them.
- Slack notifications may say that a private insight exists and link back to Mumbl. They must not include private insight text.
- Confirming or dismissing a pattern affects only that logged-in user's row.
- Supermemory columns are kept inert for data safety. New code should not read or write `supermemory_*`.

## Data Flow

```text
logged-in private dump saved
  -> save returns to the user
  -> async pattern processing starts
  -> OpenAI extracts structured signals
  -> OpenAI creates an embedding
  -> dump_signals is upserted
  -> user_dump_counts is incremented
  -> milestone check runs
  -> Anthropic may generate a private pattern
  -> Slack may send a link-only notification
  -> /patterns and /dump/map can show the result
```

Save must not depend on AI success. If OpenAI, Anthropic, Slack, or vector search fails, the dump should still save.

## Schema

The schema lives in:

- `supabase/migrations/0026_pattern_graph.sql`
- `supabase/migrations/0027_fix_pattern_graph_dump_count.sql`
- `supabase/migrations/0028_cleanup_pattern_graph_after_dump_delete.sql`

Core tables:

- `dump_signals`: one private signal row per processed dump, owned by `user_id`; stores extracted topics, emotion/energy, blocker flag, signal strength, extraction status, and pgvector embedding.
- `patterns`: generated private insights owned by `user_id`; stores summary, question, source dump IDs, period, milestone count, and user feedback state.
- `user_dump_counts`: active logged-in private dump count and milestone state per user.

Core RPC:

- `search_dumps_by_embedding(user_id, query_embedding, match_count)` searches a user's own dump signal embeddings with pgvector.
- `increment_user_dump_count(user_id)` increments the active private dump count after an authenticated dump save.
- `cleanup_pattern_graph_after_dump_delete(user_id, dump_ids)` removes pattern rows that cite deleted dumps and reconciles the active count.

RLS should stay enabled. App writes still go through server route handlers with the service role key because the routes enforce Mumbl's privacy boundary and request ownership.

## AI Providers

Signal extraction and embeddings use OpenAI through raw server-side `fetch` in `src/server/signals.js`.

Insight generation uses Anthropic through raw server-side `fetch` in `src/server/insights.js`.

Server-only environment variables:

```bash
OPENAI_API_KEY=
OPENAI_SIGNAL_MODEL=gpt-5.4-nano
ANTHROPIC_API_KEY=
ANTHROPIC_INSIGHT_MODEL=claude-haiku-4-5-20251001
MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT=10
MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL=25
MUMBL_ENABLE_PATTERN_TEST_TOOLS=false
```

Production defaults should be conservative: first insight at 10 logged-in private dumps, then every 25. Local and staging may lower the thresholds for QA.

## Surfaces

`/dump/map`

- Builds a private graph from `dump_signals`, pgvector search, and existing `patterns`.
- Uses source dump content only server-side while building the graph response.
- May show private evidence labels, but should avoid exposing full dump bodies.
- Shows a test-only regenerate control when `MUMBL_ENABLE_PATTERN_TEST_TOOLS=true`.

`/patterns`

- Lists generated patterns for the logged-in owner.
- Lets the user mark a pattern as true or dismiss it.
- Shows a test insight button only when `MUMBL_ENABLE_PATTERN_TEST_TOOLS=true`.

Slack App Home / DM

- Can point the user back to Mumbl when a new private insight exists.
- Must not include `patterns.summary`, `patterns.question`, dump text, or evidence text in Slack.

## Deletion

Deleting logged-in private dumps must update the pattern graph:

- `dump_signals` should disappear through cascade from deleted `dumps`.
- `patterns` rows that cite deleted dump IDs should be removed.
- `user_dump_counts.active_dump_count` should reconcile to the current number of private dumps for that user.

This is acceptable on delete because deletes are explicit, lower-frequency user actions and the cleanup keeps future insight cadence honest. If delete volume becomes high, move cleanup into a durable background job before optimizing prematurely.

## Launch Backfill

If the pattern graph launches after users already have logged-in private dumps, those previous dumps are still available as source material, but they will not fully participate in the graph until they have `dump_signals` rows.

Current post-save processing only handles dumps saved after the feature is active. Without a backfill:

- old logged-in private dumps remain in `dumps`
- old dumps have no embeddings or extracted signals
- pgvector search and `/dump/map` will be thin for existing users
- `user_dump_counts` may reflect post-launch saves rather than the user's true active private dump total
- milestone insight generation will happen on future saves, not from historical history

Before production launch, add and run an explicit backfill path:

1. Find logged-in private dumps that do not have a matching `dump_signals` row.
2. Process them in small batches, such as 25-50 dumps per run, to avoid AI cost spikes and route timeouts.
3. Upsert `dump_signals` through the same OpenAI signal/embedding path used after save.
4. Reconcile `user_dump_counts.active_dump_count` from actual logged-in private dump totals.
5. Keep `last_insight_at_count` conservative so users are not flooded with old milestones.
6. Do not auto-generate historical patterns or Slack notifications during backfill unless product explicitly approves that launch behavior.

Recommended product behavior: backfill signals and counts so existing users get a useful working map, then let new saves trigger future milestone insights. This preserves the private promise without surprising people with a stack of old AI reads.

## Testing

For local or staging QA:

```bash
MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT=5
MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL=10
MUMBL_ENABLE_PATTERN_TEST_TOOLS=true
```

Do not ship test tools enabled in production.

Smoke test:

1. Confirm the Supabase project before applying migrations:
   ```bash
   npm run db:status
   ```
2. Confirm pgvector exists:
   ```sql
   select * from extensions where name = 'vector';
   ```
3. Log in with Google.
4. Save private dumps from the web app.
5. Save a private dump from Slack for the same connected user.
6. Check that `dump_signals` and `user_dump_counts` update only for logged-in dumps.
7. Confirm `/dump/map` loads without Supermemory env vars.
8. Confirm `/patterns` returns only the authenticated owner's rows.
9. Use the test insight button or map regenerate control on staging.
10. Confirm Slack receives only a pointer/link notification.
11. Delete a source dump and confirm related pattern rows are cleaned up.

Useful SQL:

```sql
select
  id,
  user_id,
  dump_id,
  extraction_status,
  signal_strength,
  energy,
  topics,
  embedding is not null as has_embedding,
  vector_dims(embedding) as embedding_dims,
  created_at
from dump_signals
order by created_at desc
limit 20;
```

```sql
select
  id,
  user_id,
  summary,
  question,
  dump_ids,
  triggered_at_count,
  user_confirmed,
  user_dismissed,
  created_at
from patterns
order by created_at desc
limit 20;
```

## Environment Guidance

Local ngrok, staging, and production may all have different app URLs, auth redirect URLs, Slack apps, and encryption keys. Avoid mixing production credentials into local or staging.

If local ngrok and staging share the same staging Supabase project, they must either:

- share the same `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY`, or
- reinstall Slack through the same environment that will send notifications.

Otherwise the app may find a Slack installation row encrypted by another environment and skip notifications because the token cannot be decrypted.

## Future Upgrade Paths

- Move post-save pattern processing to a durable queue if async route work becomes unreliable at scale.
- Add retry/backoff for failed AI calls once usage justifies the operational complexity.
- Consider HNSW indexes if vector volume grows and query latency matters more than index build cost.
- Add a maintenance view for failed `dump_signals.extraction_status` rows, but keep it internal and user-owner scoped.
