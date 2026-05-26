import { badRequest, serverError } from "../../../../../src/server/http";

export async function POST(request, { params }) {
  try {
    return badRequest("raw dumps stay private. draft and publish a field note instead.");
  } catch (error) {
    return serverError(error);
  }
}
