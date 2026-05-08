import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv } from "./env";

let cachedClient;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;
  const env = assertSupabaseEnv();

  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
