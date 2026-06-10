import { loadSession } from "./storage";

const SUPABASE_AUTH_CLIENT_KEY = "__mumblSupabaseAuthClient";
const SUPABASE_AUTH_CLIENT_PROMISE_KEY = "__mumblSupabaseAuthClientPromise";

export async function getBrowserSupabase() {
  if (globalThis[SUPABASE_AUTH_CLIENT_KEY]) return globalThis[SUPABASE_AUTH_CLIENT_KEY];
  if (globalThis[SUPABASE_AUTH_CLIENT_PROMISE_KEY]) return globalThis[SUPABASE_AUTH_CLIENT_PROMISE_KEY];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  globalThis[SUPABASE_AUTH_CLIENT_PROMISE_KEY] = import("@supabase/supabase-js").then(({ createClient }) => {
    if (!globalThis[SUPABASE_AUTH_CLIENT_KEY]) {
      globalThis[SUPABASE_AUTH_CLIENT_KEY] = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
    return globalThis[SUPABASE_AUTH_CLIENT_KEY];
  });
  return globalThis[SUPABASE_AUTH_CLIENT_PROMISE_KEY];
}

export async function requestMagicLink(email) {
  const supabase = await getBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback?next=/dump`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const supabase = await getBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback?next=/dump`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });
  if (error) throw error;
}

export async function getAuthAccessToken() {
  try {
    const supabase = await getBrowserSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) return "";
    return data.session?.access_token || "";
  } catch {
    return "";
  }
}

export async function getAuthSession() {
  try {
    const supabase = await getBrowserSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session || null;
  } catch {
    return null;
  }
}

export async function authHeader() {
  const accessToken = await getAuthAccessToken();
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

export async function signOutOfDump() {
  const supabase = await getBrowserSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function completeMagicLinkSession(code) {
  const supabase = await getBrowserSupabase();
  if (!code) {
    const existingSession = await withTimeout(supabase.auth.getSession(), "couldn't find a login session in that callback.");
    if (existingSession.error) throw existingSession.error;
    const existingAccessToken = existingSession.data.session?.access_token;
    if (!existingAccessToken) throw new Error("that login link is missing its auth code. try logging in again.");
    return linkCurrentBrowserSession(existingAccessToken);
  }

  const { error: exchangeError } = await withTimeout(
    supabase.auth.exchangeCodeForSession(code),
    "Google login took too long to finish. try again.",
  );
  if (exchangeError) throw exchangeError;

  const { data, error } = await withTimeout(supabase.auth.getSession(), "couldn't read the finished login session.");
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("couldn't finish login from that callback.");

  return linkCurrentBrowserSession(accessToken);
}

async function linkCurrentBrowserSession(accessToken) {
  const response = await fetch("/api/auth/link-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sessionToken: loadSession() }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "couldn't link this browser to your dump.");
  }
  return result;
}

async function withTimeout(promise, message, timeoutMs = 12000) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
