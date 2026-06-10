import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { resolveRequestOwner } from "../../../../../src/server/auth";
import { consumePendingSlackDump, dumpUrl } from "../../../../../src/server/slack";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingId = cleanString(body.pendingId, 80);
    if (!pendingId) return badRequest("pending Slack dump is required");

    const owner = await resolveRequestOwner({ request, sessionToken: "" });
    if (!owner.userId) return badRequest("login is required");

    const result = await consumePendingSlackDump({ pendingId, mumblUserId: owner.userId });
    return ok({ connected: true, dumpId: result.dump.id, webUrl: dumpUrl(result.dump.id) });
  } catch (error) {
    return serverError(error);
  }
}
