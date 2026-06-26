import { existsSync, readFileSync } from "node:fs";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;
const CONTENT_KEY_VERSION = "v1";

const envFile = process.argv[2] || ".env.local";
const force = process.argv.includes("--force");

loadEnvFile(envFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !process.env.MUMBL_CONTENT_ENCRYPTION_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or MUMBL_CONTENT_ENCRYPTION_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const targets = [
  ["spaces", ["name", "description", "public_name"]],
  ["posts", ["content", "display_name", "field_note_title"]],
  ["heartbeats", ["vibe_read", "digest", "uplift", "vibe_word", "top_theme", "card_line"]],
  ["dumps", ["content", "ai_reflection", "source_meta"]],
  ["field_notes", ["title", "content"]],
  ["dump_insights", ["content"]],
  ["public_profiles", ["display_name", "bio"]],
  ["slack_pending_dumps", ["content", "source_meta"]],
  ["patterns", ["summary", "question"]],
];

for (const [table, fields] of targets) {
  const updated = await backfillTable(table, fields);
  console.log(`${table}: encrypted ${updated} row${updated === 1 ? "" : "s"}`);
}

async function backfillTable(table, fields) {
  let from = 0;
  let updated = 0;

  for (;;) {
    const to = from + 499;
    const { data, error } = await supabase
      .from(table)
      .select(["id", "encrypted_payload", ...fields].join(","))
      .order("id", { ascending: true })
      .range(from, to);

    if (isMissingRelation(error)) return updated;
    if (error) throw error;
    if (!data?.length) return updated;

    for (const row of data) {
      const existing = row.encrypted_payload && typeof row.encrypted_payload === "object" ? row.encrypted_payload : {};
      const missingFields = fields.filter((field) => force || !Object.hasOwn(existing, field));
      if (!missingFields.length) continue;

      const encrypted = encryptContentFields(
        table,
        Object.fromEntries(missingFields.map((field) => [field, row[field] ?? null])),
      );
      const { error: updateError } = await supabase
        .from(table)
        .update({ encrypted_payload: { ...existing, ...encrypted } })
        .eq("id", row.id);
      if (updateError) throw updateError;
      updated += 1;
    }

    from += data.length;
  }
}

function loadEnvFile(path) {
  if (!path || !existsSync(path)) return;
  const file = readFileSync(path, "utf8");
  for (const line of file.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function isMissingRelation(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function encryptContentFields(table, fields) {
  const payload = {};
  for (const [field, value] of Object.entries(fields || {})) {
    payload[field] = encryptContentValue(value, `${table}:${field}`);
  }
  return payload;
}

function encryptContentValue(value, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, contentKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const encoding = typeof value === "string" || value === null ? "text" : "json";
  const plaintext = value === null ? "" : encoding === "json" ? JSON.stringify(value) : value;
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    version: VERSION,
    keyVersion: CONTENT_KEY_VERSION,
    encoding,
    isNull: value === null,
  };
}

function contentKey() {
  return createHash("sha256").update(process.env.MUMBL_CONTENT_ENCRYPTION_KEY).digest();
}
