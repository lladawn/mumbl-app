import { NextResponse } from "next/server";

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function badRequest(message, details) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error) {
  const message = error instanceof Error ? error.message : "unexpected backend error";
  const status = message.startsWith("Missing backend environment variables") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}
