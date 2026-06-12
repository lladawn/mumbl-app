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
5. confirm `MUMBL_ENABLE_PATTERN_TEST_TOOLS` is disabled or unset in production
6. confirm production pattern thresholds are intentional, normally first insight at 10 and interval 25
7. if launching pattern graph to users with existing logged-in private dumps, run or schedule the approved signal/count backfill before relying on `/dump/map`
8. run `npm run db:link:prod`
   this reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.production.local`
9. run `npm run db:status`
10. run `npm run db:push` only if the production schema needs a migration
11. merge `dev` into `main`
12. verify the production deployment on `mumbl.wtf`

## After release

1. smoke test create space
2. smoke test posting and reactions
3. smoke test `/explore`
4. confirm analytics are behaving as expected
5. confirm cron secrets still match the intended environment
6. smoke test logged-in private dumps and `/dump/map`
7. confirm `/patterns` loads only the current user's private insights
8. confirm Slack pattern notifications contain only a link/pointer, not private insight text

## Environment files to keep separate

- `.env.local` for staging/local
- `.env.production.local` for local production-release checks

## Environment variables to keep separate

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MUMBL_TOKEN_HASH_SECRET`
- `CRON_SECRET`
- `NEXT_PUBLIC_ENABLE_ANALYTICS`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `OPENAI_API_KEY`
- `OPENAI_SIGNAL_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_INSIGHT_MODEL`
- `MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT`
- `MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL`
- `MUMBL_ENABLE_PATTERN_TEST_TOOLS`

## Rule of thumb

If there is any doubt about which Supabase project is linked, stop and re-link intentionally before running `db:push`.
