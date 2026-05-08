import { createHmac, randomBytes } from "node:crypto";
import { assertSupabaseEnv } from "./env";

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(value) {
  const { tokenHashSecret } = assertSupabaseEnv();
  return createHmac("sha256", tokenHashSecret).update(value).digest("hex");
}
