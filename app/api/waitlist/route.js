import { badRequest, ok, serverError } from "../../../src/server/http";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString } from "../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = cleanString(body.email, 254).toLowerCase();

    if (!email) return badRequest("email is required");
    if (!isValidEmail(email)) return badRequest("drop in a real email and we'll save your spot.");

    // optional research fields — the agent-collaborator landing asks for these,
    // the older slack landing posts email only.
    const company = cleanString(body.company, 160);
    const teamSize = cleanString(body.teamSize, 40);
    const agentTools = cleanString(body.agentTools, 400);
    const source = cleanString(body.source, 40) || "landing";

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("waitlist_signups").insert({
      email,
      source,
      company: company || null,
      team_size: teamSize || null,
      agent_tools: agentTools || null,
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
