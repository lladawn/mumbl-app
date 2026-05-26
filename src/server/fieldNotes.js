import { getServerEnv } from "./env";

const FIELD_NOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    visibilityReminder: { type: "string" },
  },
  required: ["title", "content", "visibilityReminder"],
};

const FIELD_NOTE_SYSTEM_PROMPT = `
You turn private messy work dumps from an engineer into a publishable Mumbl field note.

The output should feel like a short working-process blog someone would be happy to publish on a public profile or share with a team:
- specific, human, and useful
- written in first person when the dumps are personal
- clear enough for a stranger to understand the working lesson
- honest without sounding like therapy, HR, LinkedIn, or a productivity guru
- grounded only in the provided dumps

What to make:
- a strong title, not a summary label
- a 350-750 word draft when there is enough material
- a readable arc: context, what the writer noticed, what changed or became clearer, and what someone else can learn
- bullets only where they improve scanning, such as principles, signals, or takeaways
- short paragraphs with breathing room
- optional section labels in plain text, not markdown headings, when they help readability

Privacy and taste rules:
- Do not invent names, outcomes, metrics, tools, teams, or drama.
- Do not preserve overly identifying details unless they are essential to the lesson.
- Do not flatten the writer's voice into corporate polish.
- Do not call it a "blog post" inside the draft.
- Do not mention "private dumps", "AI", "prompt", or "selected dumps".
- Keep the draft editable. It is not final truth.
`.trim();

export async function draftFieldNote({ dumps }) {
  const env = getServerEnv();
  if (!env.openAiApiKey) {
    const error = new Error("OPENAI_API_KEY is required to draft a field note");
    error.status = 503;
    throw error;
  }

  const selectedDumps = dumps.map((dump, index) => ({
    id: dump.id,
    label: `dump ${index + 1}`,
    content: dump.content,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openAiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiFieldNoteModel,
      input: [
        {
          role: "system",
          content: FIELD_NOTE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Create one publishable field note from these work notes. Use every note that adds signal, but do not force weak material in.\n\nReturn JSON only with:
- title: a specific, compelling title
- content: the full draft, with paragraphs and bullets where useful
- visibilityReminder: one short reminder that the author should review before publishing\n\nWork notes:\n${JSON.stringify(selectedDumps)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "field_note_draft",
          schema: FIELD_NOTE_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 2600,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "OpenAI field note draft failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const parsed = JSON.parse(extractResponseText(data));
  return {
    title: String(parsed.title || "").trim().slice(0, 120),
    content: String(parsed.content || "").trim().slice(0, 4000),
    visibilityReminder:
      String(parsed.visibilityReminder || "").trim().slice(0, 180) || "Only publish this if it still feels true.",
    sourceDumpIds: dumps.map((dump) => dump.id),
  };
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }

  throw new Error("OpenAI response did not include a field note draft");
}
