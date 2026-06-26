import { badRequest, notFound, ok, serverError } from "../../../../src/server/http";
import { applyOwnerFilter, assertExpectedAuthenticatedOwner, resolveRequestOwner } from "../../../../src/server/auth";
import { cleanupPatternGraphAfterDumpDelete } from "../../../../src/server/dumpPatterns";
import { encryptContentFields } from "../../../../src/server/encryption";
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
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!dumpId) return badRequest("dump id is required");
    if (!sessionToken) return badRequest("session token is required");
    if (!content) return badRequest("dump content is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { data: existingDump, error: existingError } = await applyOwnerFilter(
      supabase.from("dumps").select("id,encrypted_payload").eq("id", dumpId),
      owner,
    ).single();
    if (existingError?.code === "PGRST116") return notFound("dump not found");
    if (existingError) throw existingError;
    const aiReflection = wantsReflection ? makeLocalReflection(content) : null;
    const { data: dump, error } = await applyOwnerFilter(
      supabase
        .from("dumps")
        .update({
          encrypted_payload: {
            ...(existingDump.encrypted_payload || {}),
            ...encryptContentFields("dumps", {
              content,
              ai_reflection: aiReflection,
            }),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", dumpId),
      owner,
    )
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
    const expectsAuthenticatedOwner = body.expectsAuthenticatedOwner === true;

    if (!dumpId) return badRequest("dump id is required");
    if (!sessionToken) return badRequest("session token is required");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken });
    assertExpectedAuthenticatedOwner(owner, expectsAuthenticatedOwner);
    const { error, count } = await applyOwnerFilter(supabase.from("dumps").delete({ count: "exact" }).eq("id", dumpId), owner);
    if (error) throw error;
    if (!count) return notFound("dump not found");
    if (owner.userId) {
      await cleanupPatternGraphAfterDumpDelete({ supabase, userId: owner.userId, dumpIds: [dumpId], source: "web" });
    }

    return ok({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
