import { badRequest, ok, serverError } from "../../../../../src/server/http";
import { consumeCreatorHandoff } from "../../../../../src/server/slack";
import { cleanString } from "../../../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const handoffId = cleanString(body.handoffId, 80);
    const handoffToken = cleanString(body.handoffToken, 256);
    if (!handoffId || !handoffToken) return badRequest("handoff link is incomplete");

    const handoff = await consumeCreatorHandoff({ handoffId, handoffToken });
    return ok(handoff);
  } catch (error) {
    return serverError(error);
  }
}
