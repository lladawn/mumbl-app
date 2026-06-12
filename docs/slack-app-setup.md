# Slack App Setup

This doc is the production setup checklist for the Mumbl Slack app.

Mumbl's Slack app is a free beta entry point into the private dump -> field note -> team read loop. The app should feel native to Slack, but Mumbl remains the source of truth.

## Product Shape

Slack surfaces:

- `/mumbl [text]` saves a private dump.
- `/mumbl room [team name]` or `/mumbl start [team name]` creates a Mumbl room from Slack.
- `/mumbl pin [space-slug]` pins an existing Mumbl room as a personal Slack publish destination.
- Message shortcut `save_to_mumbl` saves an explicit Slack message to the user's private dump.
- App Home supports new private dumps, drafting team reads, reviewing drafts, viewing published reads, and managing pinned teamspaces.
- Optional per-room Slack reads posting creates one private Slack channel and mirrors explicitly published Mumbl team reads.

Privacy guardrails:

- No channel history scopes.
- No message history scopes.
- No passive member tracking, presence, or analytics.
- Slack identity is never used as the author label for anonymous reads.
- A Slack reads channel only receives field notes that a user explicitly publishes.
- Mumbl login is used only to keep private data and creator access attached to the right person; it is not room identity.

## Slack App Identity

Recommended production app profile:

- App name: `Mumbl`
- Short description: `Save private work thoughts from Slack and publish team reads only when ready.`
- Long description: `Mumbl lets people catch private work thoughts from Slack, shape the useful ones into field-note drafts, and publish anonymous or handle-based team reads. Mumbl does not read Slack channel history.`
- App website: `https://mumbl.wtf`
- Privacy policy: `https://mumbl.wtf/privacy` if available before public distribution.
- Support/contact URL: use the production support or founder contact URL.

The production site includes Slack app suggestion metadata:

```html
<meta name="slack-app-id" content="A0B9JPJGT2S">
```

Keep this value aligned with the production Slack app id in `app/layout.jsx`.

## Production URLs

Use `https://mumbl.wtf` for production.

Slack dashboard URLs:

- Core OAuth redirect URL: `https://mumbl.wtf/api/slack/oauth/callback`
- Optional team-reads OAuth redirect URL: `https://mumbl.wtf/api/slack/team-reads/oauth/callback`
- Slash command request URL: `https://mumbl.wtf/api/slack/commands`
- Interactivity request URL: `https://mumbl.wtf/api/slack/interactions`
- Event subscriptions request URL: `https://mumbl.wtf/api/slack/events`

Install URLs:

- Core install: `https://mumbl.wtf/api/slack/install`
- Optional team-reads upgrade is started from Mumbl room settings or Slack-created room setup. Do not expose it as a generic public install link because it needs a room setup token.

## Slack Dashboard Setup

Create or update the app in `api.slack.com/apps`.

### Basic Information

1. Set the app name and descriptions from the identity section.
2. Add app icon and brand assets.
3. Copy these values for Vercel:
   - Client ID -> `SLACK_CLIENT_ID`
   - Client Secret -> `SLACK_CLIENT_SECRET`
   - Signing Secret -> `SLACK_SIGNING_SECRET`

### OAuth & Permissions

Add redirect URLs:

- `https://mumbl.wtf/api/slack/oauth/callback`
- `https://mumbl.wtf/api/slack/team-reads/oauth/callback`

Core bot token scopes:

- `commands`: required for `/mumbl`.
- `users:read`: required to read the Slack user profile during explicit user actions.
- `users:read.email`: required to match Slack users to existing Mumbl login emails and connect their private dump.
- `im:write`: required to open a DM when Mumbl has a private pattern notification pointer.
- `chat:write`: required to send the private pattern notification pointer and Slack response messages.

Optional team-read bot token scopes:

- `groups:write`: creates one private Slack reads channel for a Mumbl room.
- `groups:read`: receives join events for Mumbl-created private Slack reads channels so Mumbl can auto-pin that room for connected users.

Do not add:

- `channels:history`
- `groups:history`
- `im:history`
- `mpim:history`
- broad channel/member analytics scopes

### Slash Commands

Create a slash command:

- Command: `/mumbl`
- Request URL: `https://mumbl.wtf/api/slack/commands`
- Short description: `Save a private thought to Mumbl`
- Usage hint: `[thought]`, `room [team name]`, or `pin [space-slug]`

Expected behavior:

- `/mumbl something I want to keep` saves a private dump.
- `/mumbl room platform team` creates a Mumbl room.
- `/mumbl start platform team` is an alias.
- `/mumbl pin platform-team` pins an existing Mumbl room and best-effort joins the room's Slack reads channel if it exists.
- Unpinning from App Home removes only that user's publish shortcut and best-effort removes them from the linked Slack reads channel if one exists.

### Interactivity & Shortcuts

Enable Interactivity:

- Request URL: `https://mumbl.wtf/api/slack/interactions`

Create a message shortcut:

- Name: `save_to_mumbl`
- Callback ID: `save_to_mumbl`
- Description: `Save this message to Mumbl`

App Home buttons and modals also use the same interactivity endpoint.

### App Home

Enable App Home.

Home tab behavior:

- Shows private dump actions.
- Shows drafting/review/publish actions.
- Shows pinned teamspaces when the user has them.
- Shows pinned-space management.
- Does not show team analytics, member counts, presence, or channel history.

### Event Subscriptions

Enable Event Subscriptions:

- Request URL: `https://mumbl.wtf/api/slack/events`

Subscribe to bot events:

- `app_home_opened`: publishes the private App Home surface for that Slack user.
- `member_joined_channel`: auto-pins a Mumbl room when a connected user joins a Mumbl-created private Slack reads channel.

Event handling remains narrow:

- `app_home_opened` only renders App Home.
- `member_joined_channel` only checks whether the channel maps to `slack_space_channels`.
- Mumbl does not read messages, channel history, or member lists.

## Vercel Production Environment

Set these in Vercel Production for `mumbl.wtf`:

- `NEXT_PUBLIC_APP_URL=https://mumbl.wtf`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY`
- production Supabase variables from `docs/environments.md`

`MUMBL_SLACK_TOKEN_ENCRYPTION_KEY` must be a stable secret used to encrypt Slack bot tokens. Generate once and keep it production-only:

```bash
openssl rand -base64 32
```

Do not rotate it casually. Existing encrypted Slack installations depend on it.

Slack env vars should be scoped only to Vercel Production for the production Slack app. Use a separate Slack app or separate redirect URLs for staging if staging needs Slack testing.

## Supabase Production Setup

Before production release:

1. Link intentionally to production:

```bash
npm run db:link:prod
```

2. Confirm the linked project:

```bash
npm run db:status
```

3. Push pending migrations only after confirming production:

```bash
npm run db:push
```

Slack-related migrations create or update:

- `slack_installations`
- `slack_connections`
- `slack_pending_dumps`
- `slack_space_channels`
- `slack_team_read_setups`
- `slack_started_spaces`
- `slack_space_handoffs`
- `slack_pinned_spaces`
- `spaces.creator_user_id`
- field-note picker indexes for Slack modals

Also confirm Supabase Auth production redirect URLs include:

- `https://mumbl.wtf/auth/callback`

## Install And Upgrade Flow

Core install:

1. Visit `https://mumbl.wtf/api/slack/install`.
2. Slack redirects through `https://mumbl.wtf/api/slack/oauth/callback`.
3. Mumbl stores the encrypted bot token in `slack_installations`.

User connection:

- If Slack email matches an existing Mumbl login, Mumbl can connect the Slack user automatically during explicit actions.
- If not, Mumbl creates a pending dump and sends the user to the Mumbl connect flow.
- After connection, Mumbl reconciles Slack-created rooms for that Slack user: creator ownership is linked when unclaimed, the room is pinned for Slack publishing, and the user is best-effort invited into the Mumbl-created reads channel when one exists.

Optional team-reads upgrade:

1. A Mumbl room creator chooses to create a Slack reads channel.
2. Mumbl starts a setup flow with a short-lived room setup token.
3. Slack requests the optional scopes in addition to the core scopes.
4. Mumbl creates a private channel named like `mumbl-[space-slug]`.
5. Mumbl links that channel in `slack_space_channels`.
6. Published team reads post as one Slack message. Replies stay in Slack threads and are not ingested by Mumbl.

Beta default: the Slack reads channel is private. Public workspace-visible reads channels can come later with admin-approved public-channel permissions such as `channels:manage`; that future scope should only be used to create the reads channel and should not add Slack history scopes.

## Smoke Test Checklist

After production install or release:

1. Install the app from `https://mumbl.wtf/api/slack/install`.
2. Run `/mumbl hello from prod`.
3. Confirm the response is private/ephemeral and the dump appears in Mumbl.
4. Use the `save_to_mumbl` message shortcut on a Slack message.
5. Open App Home and confirm:
   - `new private dump` opens a modal.
   - `draft team read` opens a dump picker.
   - `review drafts` opens and updates reliably.
   - `manage pinned spaces` opens when pins exist.
6. Run `/mumbl room platform team`.
7. Confirm the room is created and pinned when the Slack email maps to a Mumbl login.
8. Create a Slack reads channel from the room setup.
9. Publish a team read from Slack or Mumbl.
10. Confirm exactly one Slack channel message is posted.
11. Confirm anonymous posts do not show Slack identity.
12. Run `/mumbl pin [space-slug]` for an existing room and confirm it appears in App Home pinned teamspaces.

## Troubleshooting

Common Slack errors:

- `redirect_uri did not match any configured URIs`: add the exact production callback URL in Slack OAuth settings.
- `operation_timeout`: the endpoint did not acknowledge Slack quickly enough. Check Vercel logs around `/api/slack/commands` or `/api/slack/interactions`.
- `invalid_arguments`: Slack rejected a Block Kit view. Check logs for `response_metadata.messages`.
- App Home does not update: confirm `app_home_opened` event subscription and `SLACK_SIGNING_SECRET`.
- Team reads channel is not created: confirm core scopes include `chat:write` and optional scopes include `groups:write` and `groups:read`.
- `/mumbl pin` does not join the Slack reads channel: confirm the room has a row in `slack_space_channels` and the bot still has access to that private channel.

Useful Vercel log labels:

- `Slack API failed`
- `Slack draft review update failed`
- `Slack publish options update failed`
- `Slack field note publish failed`
- `Slack channel invite after pin failed`

## Release Notes

Before merging `dev` to `main`:

1. Verify staging Slack behavior against the preview deployment.
2. Apply pending Supabase migrations to production only after `npm run db:status`.
3. Confirm Vercel Production has the production Slack app credentials.
4. Confirm Slack dashboard URLs point at `https://mumbl.wtf`, not preview or ngrok URLs.
5. Merge to `main`.
6. Smoke test the production Slack app.

Keep staging and local Slack testing separate from the production Slack app whenever possible. For ngrok/local testing, use a separate Slack app or temporary request URLs, then restore production URLs before release.
