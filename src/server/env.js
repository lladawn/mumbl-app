export function getServerEnv() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tokenHashSecret: process.env.MUMBL_TOKEN_HASH_SECRET,
    contentEncryptionKey: process.env.MUMBL_CONTENT_ENCRYPTION_KEY,
    sideQuestEncryptionKey: process.env.MUMBL_SIDE_QUEST_ENCRYPTION_KEY,
    cronSecret: process.env.CRON_SECRET,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiFieldNoteModel: process.env.OPENAI_MODEL_FIELD_NOTE || "gpt-5.4-nano",
    openAiSignalModel: process.env.OPENAI_SIGNAL_MODEL || "gpt-5.4-nano",
    openAiMaxDailyDrafts: Number.parseInt(process.env.OPENAI_MAX_DAILY_DRAFTS || "20", 10),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicInsightModel: process.env.ANTHROPIC_INSIGHT_MODEL || "claude-haiku-4-5-20251001",
    patternGraphFirstInsightAt: positiveInteger(process.env.MUMBL_PATTERN_GRAPH_FIRST_INSIGHT_AT, 10),
    patternGraphInsightInterval: positiveInteger(process.env.MUMBL_PATTERN_GRAPH_INSIGHT_INTERVAL, 25),
    patternGraphEnabled: process.env.MUMBL_ENABLE_PATTERN_GRAPH === "true",
    patternGraphTestToolsEnabled: process.env.MUMBL_ENABLE_PATTERN_TEST_TOOLS === "true",
    slackClientId: process.env.SLACK_CLIENT_ID,
    slackClientSecret: process.env.SLACK_CLIENT_SECRET,
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
    slackTokenEncryptionKey: process.env.MUMBL_SLACK_TOKEN_ENCRYPTION_KEY,
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

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function assertSlackEnv() {
  const env = getServerEnv();
  const missing = [];
  if (!env.slackClientId) missing.push("SLACK_CLIENT_ID");
  if (!env.slackClientSecret) missing.push("SLACK_CLIENT_SECRET");
  if (!env.slackSigningSecret) missing.push("SLACK_SIGNING_SECRET");
  if (!env.slackTokenEncryptionKey) missing.push("MUMBL_SLACK_TOKEN_ENCRYPTION_KEY");

  if (missing.length) {
    throw new Error(`Missing Slack environment variables: ${missing.join(", ")}`);
  }

  return env;
}
