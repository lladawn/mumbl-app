-- Device pairing — the "Connect my office" button in the desktop helper.
--
-- Replaces "paste an ingest token into a native app" with: open the browser the
-- user is already signed into, click Authorize, and let the app pull a token
-- back. See desktop/src-tauri/src/pairing.rs, which is the authoritative
-- contract; this schema exists to satisfy it.
--
-- WHY A SECOND TOKEN TABLE RATHER THAN REUSING agent_spaces.ingest_token_hash:
-- that column is ONE space-wide credential. Handing it to a laptop means the
-- laptop holds a secret valid for the whole space, forever, and revoking it
-- breaks every other reporter at once. The pairing contract requires the minted
-- token to be DEVICE-SCOPED, INGEST-ONLY and REVOCABLE, and the only way to get
-- all three is a row per device that can be revoked on its own. Blast radius is
-- the point: a leaked device token means "someone can post fake activity for
-- one Mac", and "Disconnect this Mac" costs one click and disturbs nothing else.
--
-- Same posture as 0004: service-role writes only, RLS on with no policies.

-- ── pairing codes ──────────────────────────────────────────────────────────
-- Short-lived, single-use handoff. The desktop app mints the code locally and
-- polls; the browser side binds a device token to it once a human authorizes.
--
-- Only the HMAC of the code is stored, exactly like every other token in this
-- schema: the claim route is deliberately UNAUTHENTICATED (possession of a
-- fresh code is the proof), so a dump of this table must not hand an attacker
-- a set of live codes to replay.
create table agent_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  -- what the app called itself, shown to the human on the authorize page.
  -- Untrusted display text: it comes from the desktop client.
  device_name text not null default 'Unknown device',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- THE ONE-TIME TOKEN, ENCRYPTED AT REST (encryptContentFields, AES-256-GCM
  -- with a server-side content key). It cannot live in process memory: this
  -- app runs on Vercel, so the authorize POST and the helper's claim poll
  -- routinely land on DIFFERENT lambdas and an in-memory handoff fails by
  -- default rather than exceptionally. It is wiped the instant it is claimed,
  -- so the window in which any ciphertext exists is one human click wide.
  --
  -- Note the asymmetry with code_hash above, and keep it: the CODE is stored
  -- one-way (HMAC) because we only ever need to recognise it, while the TOKEN
  -- must be handed back verbatim exactly once, so it is stored reversibly and
  -- deleted rather than hashed.
  encrypted_payload jsonb not null default '{}'::jsonb,
  -- set when a signed-in human authorizes; until then a claim gets 202
  authorized_at timestamptz,
  authorized_by_user_id uuid references auth.users(id) on delete set null,
  space_id uuid references agent_spaces(id) on delete cascade,
  device_token_id uuid,
  -- set when the desktop app successfully collects the token. Single-use is
  -- enforced on this column, not by deleting the row, so a second claim can be
  -- told "already used" (404) rather than "never existed".
  claimed_at timestamptz
);

create index agent_pairing_codes_expiry_idx on agent_pairing_codes (expires_at);

-- ── device tokens ──────────────────────────────────────────────────────────
-- One row per paired machine. This is what /api/agents/ingest accepts alongside
-- the legacy space-wide token.
create table agent_device_tokens (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references agent_spaces(id) on delete cascade,
  -- only the HMAC, same as agent_spaces.ingest_token_hash
  token_hash text not null unique,
  device_name text not null default 'Unknown device',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  -- REVOCABLE: "Disconnect this Mac" stamps this and nothing else. Kept as a
  -- tombstone rather than a delete so the device list can still show what was
  -- revoked and when.
  revoked_at timestamptz
);

-- the ingest hot path: hash lookup, live tokens only
create index agent_device_tokens_live_idx
  on agent_device_tokens (token_hash)
  where revoked_at is null;

create index agent_device_tokens_space_idx
  on agent_device_tokens (space_id, created_at desc);

alter table agent_pairing_codes add constraint agent_pairing_codes_device_token_fk
  foreign key (device_token_id) references agent_device_tokens(id) on delete set null;

alter table agent_pairing_codes enable row level security;
alter table agent_device_tokens enable row level security;

-- No policies, deliberately: both tables are written and read exclusively by
-- the service role from src/server/devicePairing.js. A pairing code that anon
-- could select is a pairing code anyone can claim.
