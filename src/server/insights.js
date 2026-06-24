import { getServerEnv } from "./env";
import { decryptContentFields, decryptContentRows, encryptContentFields, withoutEncryptedPayload } from "./encryption";
import { cleanString } from "./validation";

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    question: { type: "string" },
  },
  required: ["summary", "question"],
};

export async function checkInsightMilestone(supabase, userId) {
  const cleanedUserId = cleanString(userId, 64);
  if (!cleanedUserId) return;
  if (!getServerEnv().patternGraphEnabled) return;

  const { data, error } = await supabase.rpc("increment_user_dump_count", { p_user_id: cleanedUserId });
  if (error) throw error;

  const countRow = Array.isArray(data) ? data[0] : data;
  const newCount = Number(countRow?.total_dumps || 0);
  const lastInsightAt = Number(countRow?.last_insight_at_count || 0);
  const env = getServerEnv();
  const firstInsightAt = env.patternGraphFirstInsightAt;
  const insightInterval = env.patternGraphInsightInterval;
  const isFirstMilestone = newCount === firstInsightAt;
  const isSubsequentMilestone = newCount > firstInsightAt && newCount - lastInsightAt >= insightInterval;
  if (!isFirstMilestone && !isSubsequentMilestone) return;

  const pattern = await generateAndDeliverInsight(supabase, cleanedUserId, newCount);
  if (!pattern) return;

  const { error: updateError } = await supabase
    .from("user_dump_counts")
    .update({ last_insight_at_count: newCount, updated_at: new Date().toISOString() })
    .eq("user_id", cleanedUserId);
  if (updateError) throw updateError;
}

export async function generateAndDeliverInsight(supabase, userId, dumpCount) {
  if (!getServerEnv().patternGraphEnabled) return null;
  const dumps = await fetchRecentDumpsWithSignals(supabase, userId);
  if (dumps.length < 5) return null;

  const insight = await generateInsight(dumps);
  const { data: pattern, error } = await supabase
    .from("patterns")
    .insert({
      user_id: userId,
      dump_ids: dumps.map((dump) => dump.id),
      encrypted_payload: encryptContentFields("patterns", {
        summary: insight.summary,
        question: insight.question,
      }),
      period_start: dumps[dumps.length - 1]?.created_at || null,
      period_end: dumps[0]?.created_at || null,
      triggered_at_count: dumpCount,
    })
    .select("id, encrypted_payload")
    .single();
  if (error) throw error;

  await notifyInsightViaSlack(supabase, userId, pattern.id);
  return withoutEncryptedPayload(decryptContentFields("patterns", pattern, ["summary", "question"]));
}

export async function notifyInsightViaSlack(supabase, userId, patternId) {
  try {
    const { data: connections, error: connectionError } = await supabase
      .from("slack_connections")
      .select("slack_user_id, slack_team_id")
      .eq("mumbl_user_id", userId)
      .limit(3);
    if (connectionError) throw connectionError;
    if (!connections?.length) return;

    const { sendSlackPatternNotification } = await import("./slack");
    const results = await Promise.allSettled(
      connections.map((connection) =>
        sendSlackPatternNotification({
          teamId: connection.slack_team_id,
          slackUserId: connection.slack_user_id,
          patternId,
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("slack insight notification failed silently:", {
          teamId: connections[index]?.slack_team_id,
          message: result.reason?.message,
          slackError: result.reason?.slack?.error,
        });
      }
    });
  } catch (error) {
    console.error("slack insight notification failed silently:", error);
  }
}

async function fetchRecentDumpsWithSignals(supabase, userId, limit = 15) {
  const { data, error } = await supabase
    .from("dumps")
    .select(
      `
      id,
      content,
      encrypted_payload,
      created_at,
      dump_signals (
        energy,
        emotions,
        topics,
        is_blocker,
        signal_strength
      )
    `,
    )
    .eq("user_id", userId)
    .eq("visibility", "private")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return decryptContentRows("dumps", data || [], ["content", "ai_reflection", "source_meta"]);
}

async function generateInsight(dumps) {
  const env = getServerEnv();
  if (!env.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required to generate pattern insights");

  const formatted = dumps
    .map((dump, index) => {
      const signals = Array.isArray(dump.dump_signals) ? dump.dump_signals[0] : dump.dump_signals;
      const signalLine = signals
        ? `[energy: ${signals.energy || "neutral"}, emotions: ${(signals.emotions || []).join(", ")}, blocker: ${Boolean(signals.is_blocker)}]`
        : "";
      return `dump ${index + 1} (${new Date(dump.created_at).toDateString()}):
${signalLine}
"${cleanString(dump.content, 400)}"`;
    })
    .join("\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.anthropicInsightModel,
      max_tokens: 320,
      system: `You are a thoughtful, private mirror for someone's work experience.
Find one genuine pattern in recent private work journal entries.

Rules:
- Use their own words and phrases where possible.
- Never diagnose, score, rate, or manage them.
- Never use corporate language.
- Write like a thoughtful friend who noticed something.
- Keep summary under 80 words.
- Keep question under 20 words.
- If there is no clear pattern, say there is not enough signal yet.

Respond only with valid JSON matching this shape:
${JSON.stringify(INSIGHT_SCHEMA)}`,
      messages: [
        {
          role: "user",
          content: `Here are my recent work journal entries:\n\n${formatted}`,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `insight generation failed: ${response.status}`);
  }

  const text = data?.content?.find((item) => item.type === "text")?.text || "";
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  return {
    summary: cleanString(parsed.summary, 700) || "not enough signal yet to see a clear pattern.",
    question: cleanString(parsed.question, 180) || "what feels worth noticing here?",
  };
}
