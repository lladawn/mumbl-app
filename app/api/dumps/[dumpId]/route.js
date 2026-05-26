import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { hashToken } from "../../../../src/server/hash";
import { makeLocalReflection, serializeDump } from "../../../../src/server/dumps";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function PATCH(request, { params }) {
  try {
    const { dumpId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const content = cleanString(body.content, 4000);
    const wantsReflection = body.wantsReflection === true;

    if (!dumpId) return badRequest("dump id is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!content) return badRequest("dump content is required");

    const supabase = getSupabaseAdmin();
    const { data: dump, error } = await supabase
      .from("dumps")
      .update({
        content,
        ai_reflection: wantsReflection ? makeLocalReflection(content) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dumpId)
      .eq("session_token_hash", hashToken(sessionToken))
      .select("*")
      .single();
    if (error?.code === "PGRST116") return notFound("dump not found");
    if (error) throw error;

    return ok({ dump: serializeDump(dump) });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { dumpId } = await params;
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);

    if (!dumpId) return badRequest("dump id is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const { error, count } = await supabase
      .from("dumps")
      .delete({ count: "exact" })
      .eq("id", dumpId)
      .eq("session_token_hash", hashToken(sessionToken));
    if (error) throw error;
    if (!count) return notFound("dump not found");

    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
