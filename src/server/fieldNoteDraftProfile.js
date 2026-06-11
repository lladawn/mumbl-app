export const FIELD_NOTE_DRAFT_PROFILES = {
  tiny: {
    label: "tiny",
    maxContentChars: 1200,
    maxOutputTokens: 900,
    target:
      "60-140 words. Write one honest moment in 1-3 short paragraphs. Preserve the spark, tension, or feeling. Do not force a lesson, arc, or big takeaway.",
  },
  short: {
    label: "short",
    maxContentChars: 2400,
    maxOutputTokens: 1300,
    target:
      "180-300 words. Write a small story: what happened or was noticed, why it felt meaningful, and what the writer is carrying forward. Keep it vivid without padding.",
  },
  full: {
    label: "full",
    maxContentChars: 4000,
    maxOutputTokens: 2600,
    target:
      "400-650 words only when the dumps contain enough real material. Write a true field note with narrative arc, human texture, and a useful takeaway grounded in the source.",
  },
};

export function classifyFieldNoteDraftProfile(dumps) {
  const source = Array.isArray(dumps) ? dumps : [];
  const totalWords = source.reduce((sum, dump) => sum + countWords(dump?.content), 0);
  if (source.length <= 2 && totalWords <= 45) return "tiny";
  if (totalWords <= 160) return "short";
  return "full";
}

export function truncateDraftContent(content, maxChars) {
  if (content.length <= maxChars) return content;

  const hardCut = content.slice(0, maxChars).trim();
  const paragraphCut = hardCut.lastIndexOf("\n\n");
  if (paragraphCut >= Math.floor(maxChars * 0.55)) return hardCut.slice(0, paragraphCut).trim();

  const sentenceCut = Math.max(hardCut.lastIndexOf(". "), hardCut.lastIndexOf("! "), hardCut.lastIndexOf("? "));
  if (sentenceCut >= Math.floor(maxChars * 0.65)) return hardCut.slice(0, sentenceCut + 1).trim();

  return hardCut;
}

function countWords(value) {
  const words = String(value || "").trim().match(/\S+/g);
  return words ? words.length : 0;
}
