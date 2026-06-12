import { getServerEnv } from "./env";
import { cleanString } from "./validation";

const EMBED_MODEL = "text-embedding-3-small";
const SIGNAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    energy: { type: "string", enum: ["low", "neutral", "high"] },
    emotions: { type: "array", items: { type: "string" }, maxItems: 3 },
    topics: { type: "array", items: { type: "string" }, maxItems: 3 },
    is_blocker: { type: "boolean" },
    signal_strength: { type: "string", enum: ["strong", "weak"] },
  },
  required: ["energy", "emotions", "topics", "is_blocker", "signal_strength"],
};

const SIGNAL_SYSTEM_PROMPT = `
You extract structured signals from private work journal entries.

Rules:
- Be conservative.
- If unsure, pick neutral and weak.
- Never invent signals not present in the text.
- Keep emotions and topics short, lowercase, and human.
`.trim();

export async function extractSignals(content) {
  const env = getServerEnv();
  if (!env.openAiApiKey) throw new Error("OPENAI_API_KEY is required to extract signals");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiSignalModel,
      input: [
        { role: "system", content: SIGNAL_SYSTEM_PROMPT },
        { role: "user", content: cleanString(content, 1000) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dump_signals",
          schema: SIGNAL_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 220,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `signal extraction failed: ${response.status}`);
  }

  return normalizeSignals(JSON.parse(extractResponseText(data)));
}

export async function embedContent(content) {
  const env = getServerEnv();
  if (!env.openAiApiKey) throw new Error("OPENAI_API_KEY is required to embed content");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: cleanString(content, 2000),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `embedding failed: ${response.status}`);
  }

  if (!Array.isArray(data?.data?.[0]?.embedding)) throw new Error("embedding response was empty");
  return data.data[0].embedding;
}

export async function processDump(supabase, dumpId, userId, content) {
  const cleanedDumpId = cleanString(dumpId, 64);
  const cleanedUserId = cleanString(userId, 64);
  if (!cleanedDumpId || !cleanedUserId) return;

  try {
    const [signals, embedding] = await Promise.all([extractSignals(content), embedContent(content)]);
    const { error } = await supabase.from("dump_signals").upsert(
      {
        dump_id: cleanedDumpId,
        user_id: cleanedUserId,
        energy: signals.energy,
        emotions: signals.emotions,
        topics: signals.topics,
        is_blocker: signals.is_blocker,
        signal_strength: signals.signal_strength,
        embedding,
        extraction_status: "done",
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "dump_id" },
    );
    if (error) throw error;
  } catch (error) {
    console.error("processDump failed silently:", error);
    try {
      await supabase.from("dump_signals").upsert(
        {
          dump_id: cleanedDumpId,
          user_id: cleanedUserId,
          extraction_status: "failed",
        },
        { onConflict: "dump_id" },
      );
    } catch (statusError) {
      console.error("processDump failure status could not be saved:", statusError);
    }
  }
}

function normalizeSignals(signals) {
  const energy = ["low", "neutral", "high"].includes(signals?.energy) ? signals.energy : "neutral";
  const signalStrength = ["strong", "weak"].includes(signals?.signal_strength) ? signals.signal_strength : "weak";
  return {
    energy,
    emotions: normalizeList(signals?.emotions, 3),
    topics: normalizeList(signals?.topics, 3),
    is_blocker: signals?.is_blocker === true,
    signal_strength: signalStrength,
  };
}

function normalizeList(value, max) {
  return Array.isArray(value) ? value.map((item) => cleanString(item, 32).toLowerCase()).filter(Boolean).slice(0, max) : [];
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }

  throw new Error("OpenAI response did not include signal JSON");
}
