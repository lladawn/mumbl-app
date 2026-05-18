export function getServerEnv() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tokenHashSecret: process.env.MUMBL_TOKEN_HASH_SECRET,
    sideQuestEncryptionKey: process.env.MUMBL_SIDE_QUEST_ENCRYPTION_KEY,
    cronSecret: process.env.CRON_SECRET,
  };
}

export function assertSupabaseEnv() {
  const env = getServerEnv();
  const missing = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.tokenHashSecret) missing.push("MUMBL_TOKEN_HASH_SECRET");

  if (missing.length) {
    throw new Error(`Missing backend environment variables: ${missing.join(", ")}`);
  }

  return env;
}
