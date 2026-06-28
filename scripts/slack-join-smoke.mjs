import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load env from .env.local (same file db:link:staging uses).
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const teamId = `T_SMOKE_${crypto.randomUUID().slice(0, 8)}`;
const slackUserId = `U_SMOKE_${crypto.randomUUID().slice(0, 8)}`;

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// Reference a real space without creating one.
const { data: space, error: spaceErr } = await supabase.from("spaces").select("id,slug").limit(1).single();
if (spaceErr || !space) throw new Error("no spaces in DB to reference for the smoke test");
console.log(`using space ${space.slug} (${space.id})\n`);

let pinId;
try {
  // 1) A newcomer joins: pin with mumbl_user_id = null (the migration enables this).
  const { data: pin, error: pinErr } = await supabase
    .from("slack_pinned_spaces")
    .insert({ mumbl_user_id: null, slack_team_id: teamId, slack_user_id: slackUserId, space_id: space.id })
    .select("id,mumbl_user_id")
    .single();
  assert(!pinErr, `null-mumbl_user_id pin insert succeeds${pinErr ? ` — ${pinErr.message}` : ""}`);
  assert(pin?.mumbl_user_id === null, "stored mumbl_user_id is null");
  pinId = pin.id;

  // 2) App Home / manage list keys on Slack identity — must find it without a connection.
  const { data: listed } = await supabase
    .from("slack_pinned_spaces")
    .select("id,space_id")
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId);
  assert(listed?.some((row) => row.id === pinId), "pin is listed by (slack_team_id, slack_user_id)");

  // 3) Backfill on connect: a fake but valid-shaped uuid; use a real auth user so the FK holds.
  const { data: authUser } = await supabase.from("slack_connections").select("mumbl_user_id").limit(1).maybeSingle();
  if (authUser?.mumbl_user_id) {
    const { error: backfillErr } = await supabase
      .from("slack_pinned_spaces")
      .update({ mumbl_user_id: authUser.mumbl_user_id })
      .eq("slack_team_id", teamId)
      .eq("slack_user_id", slackUserId)
      .is("mumbl_user_id", null);
    assert(!backfillErr, `backfill update sets mumbl_user_id${backfillErr ? ` — ${backfillErr.message}` : ""}`);
    const { data: after } = await supabase.from("slack_pinned_spaces").select("mumbl_user_id").eq("id", pinId).single();
    assert(after?.mumbl_user_id === authUser.mumbl_user_id, "pin now attributed to the connected mumbl user");
  } else {
    console.log("  ~ skipped backfill check (no existing slack_connections row to borrow a user id from)");
  }

  console.log("\nSMOKE PASS ✅");
} finally {
  if (pinId) {
    await supabase.from("slack_pinned_spaces").delete().eq("id", pinId);
    console.log("cleaned up smoke pin");
  }
}
