/**
 * Device-pairing contract check.
 *
 *   node --import ./scripts/pairing-check/register.mjs ./scripts/pairing-check/run.mjs
 *
 * WHY THIS EXISTS. Pairing is the moment a machine is handed a credential, so
 * the properties that matter are security properties: the code is single-use,
 * it expires, a signed-out request mints nothing, the token that travels is
 * NOT the space-wide ingest token, and revoking one Mac leaves the others
 * alone. None of that is visible in a screenshot.
 *
 * It runs the REAL shipped route handlers — app/api/agents/pair/{claim,authorize}
 * and src/server/{devicePairing,agentPresence}.js are imported unmodified. Only
 * three things are substituted, via an ESM resolve hook (loader.mjs):
 *   · src/server/supabase.js → an in-memory fake of the query builder, because
 *     this repo has no local Postgres (no Docker) and the only configured
 *     database is a real remote one.
 *   · src/server/auth.js     → so the test can choose who is signed in.
 *   · next/server            → NextResponse.json is a plain Response.
 * The loader also appends .js to extensionless relative imports, which Next's
 * bundler resolves but plain Node ESM does not.
 *
 * WHAT IT DOES NOT COVER: the DDL in supabase/migrations/0010_device_pairing.sql
 * is never executed here. The fake emulates the queries, not Postgres. Running
 * the migration against a real database is still required, and is the one step
 * that has to happen before the flow works for a human.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
process.env.MUMBL_TOKEN_HASH_SECRET = "test-hash-secret";

const { db, reset } = await import("./fake-supabase.mjs");
const { setUser } = await import("./fake-auth.mjs");

// THE REAL SHIPPED HANDLERS — not a re-implementation.
const claim = await import("../../app/api/agents/pair/claim/route.js");
const authorize = await import("../../app/api/agents/pair/authorize/route.js");
const { resolveSpaceByIngestToken } = await import("../../src/server/agentPresence.js");
const { revokeDeviceToken, listDeviceTokens } = await import("../../src/server/devicePairing.js");
const { hashToken } = await import("../../src/server/hash.js");
const { getSupabaseAdmin } = await import("./fake-supabase.mjs");

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};
const post = (mod, body) => mod.POST(new Request("http://localhost:3000/api/agents/pair/claim", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));
const get = (mod, qs) => mod.GET(new Request(`http://localhost:3000/api/agents/pair/authorize?${qs}`));

function seed() {
  reset();
  db.agent_spaces.push({ id: "space-1", slug: "acme", name: "Acme", ingest_token_hash: hashToken("legacy-space-token"), owner_user_id: "user-1", created_at: "2026-01-01" });
  db.agent_spaces.push({ id: "space-2", slug: "zoe", name: "Zoe's office", ingest_token_hash: hashToken("other-space-token"), owner_user_id: null, created_at: "2026-01-02" });
  db.public_profiles.push({ id: "p1", user_id: "user-2", handle: "zoe" });
  setUser("user-1");
}

const CODE = "ABCD-EFGH";

console.log("\n1. THE CONTRACT pairing.rs polls for");
seed();
let r = await post(claim, { code: CODE });
check("unknown code -> 404", r.status === 404, `got ${r.status}`);

await get(authorize, `code=${CODE}&name=Dawn%27s%20MacBook`);
r = await post(claim, { code: CODE });
check("registered but not authorized -> 202", r.status === 202, `got ${r.status}`);

r = await authorize.POST(new Request("http://localhost:3000/api/agents/pair/authorize", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: CODE, name: "Dawn's MacBook" }),
}));
check("authorize -> 200", r.status === 200, `got ${r.status}`);

r = await post(claim, { code: CODE });
const claimed = await r.json();
check("authorized -> 200", r.status === 200, `got ${r.status}`);
check("returns a token", Boolean(claimed.token), JSON.stringify(claimed));
check("returns the slug", claimed.slug === "acme", claimed.slug);
check("returns an absolute ingest endpoint", /\/api\/agents\/ingest$/.test(claimed.endpoint || ""), claimed.endpoint);

r = await post(claim, { code: CODE });
check("SINGLE USE: second claim -> 404", r.status === 404, `got ${r.status}`);

console.log("\n2. THE MINTED TOKEN IS DEVICE-SCOPED, INGEST-ONLY, REVOCABLE");
const sb = getSupabaseAdmin();
const minted = claimed.token;
check("token is NOT the space-wide ingest token", minted !== "legacy-space-token");
let space = await resolveSpaceByIngestToken(sb, minted);
check("device token authenticates ingest for its own space", space?.slug === "acme", JSON.stringify(space));
check("device token row is scoped to one space", db.agent_device_tokens.length === 1 && db.agent_device_tokens[0].space_id === "space-1");
check("legacy space token still works (not regressed)", (await resolveSpaceByIngestToken(sb, "legacy-space-token"))?.slug === "acme");
check("an unrelated string authenticates nothing", (await resolveSpaceByIngestToken(sb, "nope")) === null);

const devices = await listDeviceTokens(sb, { spaceId: "space-1" });
check("device is listed for a Disconnect UI", devices.length === 1 && devices[0].device_name === "Dawn's MacBook", JSON.stringify(devices));

const revoked = await revokeDeviceToken(sb, { deviceTokenId: devices[0].id, spaceId: "space-1" });
check("revoke reports success", revoked === true);
check("REVOKED token no longer authenticates", (await resolveSpaceByIngestToken(sb, minted)) === null);
check("revoking did not touch the space-wide token", (await resolveSpaceByIngestToken(sb, "legacy-space-token"))?.slug === "acme");

console.log("\n3. EXPIRY");
seed();
await get(authorize, `code=EXPI-RED1&name=Old`);
db.agent_pairing_codes[0].expires_at = new Date(Date.now() - 1000).toISOString();
r = await post(claim, { code: "EXPI-RED1" });
check("expired code -> 404", r.status === 404, `got ${r.status}`);

console.log("\n4. ENTITLEMENT — the browser side decides the space, not the app");
seed();
setUser("");
r = await get(authorize, `code=NOAU-TH12&name=Mac`);
check("signed-out GET -> 401", r.status === 401, `got ${r.status}`);
r = await authorize.POST(new Request("http://localhost:3000/api/agents/pair/authorize", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: "NOAU-TH12", name: "Mac" }),
}));
check("signed-out POST -> 401", r.status === 401, `got ${r.status}`);
check("nothing was minted for a signed-out request", db.agent_device_tokens.length === 0);

setUser("user-1");
r = await get(authorize, `code=WHOS-PACE&name=Mac`);
let body = await r.json();
check("signed-in user gets THEIR OWN space, never a chosen one", body.space?.slug === "acme", JSON.stringify(body.space));

console.log("\n5. ADOPTION of an ownerless space whose slug is the user's handle");
seed();
setUser("user-2");                       // handle 'zoe', space 'zoe' is unowned
r = await get(authorize, `code=ADOP-T123&name=Mac`);
body = await r.json();
check("user-2 resolves to the space named after their handle", body.space?.slug === "zoe", JSON.stringify(body.space));
check("adoption stamped ownership", db.agent_spaces.find((s) => s.slug === "zoe").owner_user_id === "user-2");
setUser("user-1");
r = await get(authorize, `code=ADOP-T456&name=Mac`);
body = await r.json();
check("a DIFFERENT user cannot then adopt it", body.space?.slug === "acme", JSON.stringify(body.space));

seed();
setUser("user-3");                        // no owned space, no profile handle
r = await get(authorize, `code=NONE-1234&name=Mac`);
body = await r.json();
check("user with no office -> space:null, nothing minted", body.space === null && db.agent_device_tokens.length === 0, JSON.stringify(body));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
