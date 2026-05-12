import { dailyPromptOptions } from "../lib/promptOptions";
import { getSupabaseAdmin } from "./supabase";

export async function ensureDailyPrompt(date = todayDate()) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from("prompts")
    .select("id,prompt_date,prompt_text,tone")
    .eq("prompt_date", date)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const { text: promptText, tone } = promptForDate(date);
  const { data, error } = await supabase
    .from("prompts")
    .upsert(
      {
        prompt_date: date,
        prompt_text: promptText,
        tone,
      },
      { onConflict: "prompt_date" },
    )
    .select("id,prompt_date,prompt_text,tone")
    .single();

  if (error) throw error;
  return data;
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function promptForDate(date) {
  const dayNumber = Math.floor(new Date(date + "T00:00:00.000Z").getTime() / 86400000);
  return dailyPromptOptions[Math.abs(dayNumber) % dailyPromptOptions.length];
}
