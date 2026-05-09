import { ok, serverError } from "../../../src/server/http";
import { getExploreSummary } from "../../../src/server/explore";

export async function GET() {
  try {
    return ok({ explore: await getExploreSummary() });
  } catch (error) {
    return serverError(error);
  }
}
