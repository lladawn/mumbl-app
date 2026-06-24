# Release Checklist

Use this every time we move work from `dev` to `main`.

## Daily dev work

1. start from `dev`
2. branch for your feature
3. merge back into `dev`
4. verify the Vercel Preview deployment
5. make sure local `.env.local` is not using production credentials

## Before touching staging data

1. confirm you are on `dev` or a feature branch
2. run `npm run db:link:staging`
   this reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`
3. run `npm run db:status`
4. run `npm run db:push` only after confirming the linked project is staging
5. for pattern graph migrations, confirm pgvector is available before testing:
   ```sql
   select * from extensions where name = 'vector';
   ```

## Before releasing to production

1. verify `dev` is stable in Vercel Preview
2. open PR from `dev` into `main`
3. confirm production env vars are set only in Vercel `Production`
4. confirm staging env vars are set only in Vercel `Preview`
5. confirm `MUMBL_CONTENT_ENCRYPTION_KEY` is set in production and is not reused from staging/local
6. confirm `MUMBL_ENABLE_PATTERN_GRAPH` and `NEXT_PUBLIC_ENABLE_PATTERN_GRAPH` are disabled or unset in production unless intentionally launching private patterns
7. confirm `MUMBL_ENABLE_PATTERN_TEST_TOOLS` is disabled or unset in production
8. confirm production pattern thresholds are intentional, normally first insight at 10 and interval 25
9. if launching pattern graph to users with existing logged-in private dumps, run or schedule the approved signal/count backfill before relying on `/dump/map`
10. run `npm run db:link:prod`
   this reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.production.local`
11. run `npm run db:status`
12. run `npm run db:push` only if the production schema needs a migration
13. for the first encryption rollout, the first `db:push` should apply `0029_content_encrypted_payloads.sql` and may intentionally stop at the guarded `0030_scrub_plaintext_content.sql`
14. run `npm run content-encryption:backfill -- .env.production.local`
15. confirm every existing user-content row has the expected `encrypted_payload`
16. rerun `npm run db:push` so `0030_scrub_plaintext_content.sql` scrubs legacy columns and `0031_drop_legacy_plaintext_content_columns.sql` drops them
17. confirm legacy plaintext columns are gone while the app still renders decrypted content
18. confirm dormant Supermemory columns, `memory_entries`, and unused `space_plans` are gone after `0032_drop_supermemory_and_inert_plan_schema.sql`
19. confirm obsolete `dump_insights` and `culture_snapshots` tables are gone after `0033_drop_obsolete_insight_snapshot_tables.sql`
20. confirm private room invite keys and saved-room access tables are present after `0034_private_room_access_tokens.sql` and `0035_saved_room_access.sql`
21. merge `dev` into `main`
22. verify the production deployment on `mumbl.wtf`

## After release

1. smoke test create space
2. smoke test posting and reactions
3. smoke test `/explore`
4. confirm analytics are behaving as expected
5. confirm cron secrets still match the intended environment
6. smoke test logged-in private dumps and `/dump/map`
7. confirm `/patterns` loads only the current user's private insights
8. confirm Slack pattern notifications contain only a link/pointer, not private insight text
9. confirm newly created rooms, posts, dumps, field notes, public profile text, heartbeats, and Slack pending dumps have non-empty `encrypted_payload`
10. confirm legacy plaintext columns are gone from the user-content tables

## Environment files to keep separate

- `.env.local` for staging/local
- `.env.production.local` for local production-release checks

## Environment variables to keep separate

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUMBL_TOKEN_HASH_SECRET`
- `MUMBL_CONTENT_ENCRYPTION_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_ENABLE_ANALYTICS`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `MUMBL_ENABLE_PATTERN_GRAPH`
- `NEXT_PUBLIC_ENABLE_PATTERN_GRAPH`
- `OPENAI_API_KEY`
- `OPENAI_SIGNAL_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_INSIGHT_MODEL`
- `MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT`
- `MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL`
- `MUMBL_ENABLE_PATTERN_TEST_TOOLS`

## Rule of thumb

If there is any doubt about which Supabase project is linked, stop and re-link intentionally before running `db:push`.
