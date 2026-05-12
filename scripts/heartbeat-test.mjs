import { readFileSync, existsSync } from "node:fs";

const target = process.argv[2] || process.env.MUMBL_HEARTBEAT_URL || "http://127.0.0.1:3000";
const env = readEnvFile(process.env.MUMBL_ENV_FILE || ".env.local");
const cronSecret = process.env.CRON_SECRET || env.CRON_SECRET || "";
const url = new URL("/api/cron/heartbeats", target);

const response = await fetch(url, {
  method: "POST",
  headers: cronSecret ? { authorization: "Bearer " + cronSecret } : {},
});

const text = await response.text();
let body = text;
try {
  body = JSON.stringify(JSON.parse(text), null, 2);
} catch {}

console.log(response.status + " " + response.statusText);
console.log(body);

if (!response.ok) process.exit(1);

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}
