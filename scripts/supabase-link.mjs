import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = process.argv[2] || process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_URL || ".env.local";
const projectRef = resolveProjectRef(source);

if (!projectRef) {
  console.error("Missing Supabase project ref.");
  console.error("Use a project ref, a Supabase URL, or an env file path.");
  process.exit(1);
}

const result = spawnSync("supabase", ["link", "--project-ref", projectRef], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);

function resolveProjectRef(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return projectRefFromUrl(value);
  }
  if (existsSync(value)) {
    return projectRefFromEnvFile(value);
  }
  return value;
}

function projectRefFromEnvFile(path) {
  const file = readFileSync(path, "utf8");
  const match = file.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
  return match ? projectRefFromUrl(match[1].trim()) : "";
}

function projectRefFromUrl(url) {
  const match = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : "";
}
