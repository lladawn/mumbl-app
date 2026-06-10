import { badRequest, ok, serverError } from "../../../src/server/http";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = cleanString(body.email, 254).toLowerCase();

    if (!email) return badRequest("email is required");
    if (!isValidEmail(email)) return badRequest("drop in a real email and we'll save your spot.");

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("waitlist_signups").insert({
      email,
      source: "landing",
    });

    if (error && error.code !== "23505") throw error;

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
