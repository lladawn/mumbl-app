import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getServerEnv } from "./env";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;
const CONTENT_KEY_VERSION = "v1";

export function encryptSideQuestMessage(message) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, sideQuestKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(message, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    version: VERSION,
  };
}

export function decryptSideQuestMessage({ ciphertext, iv, tag }) {
  const decipher = createDecipheriv(ALGORITHM, sideQuestKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptContentFields(table, fields) {
  const payload = {};

  for (const [field, value] of Object.entries(fields || {})) {
    if (value === undefined) continue;
    payload[field] = encryptContentValue(value, `${table}:${field}`);
  }

  return payload;
}

export function decryptContentFields(table, row, fieldNames) {
  if (!row?.encrypted_payload || typeof row.encrypted_payload !== "object") return row;

  const decrypted = { ...row };
  for (const field of fieldNames) {
    if (!Object.hasOwn(row.encrypted_payload, field)) continue;
    decrypted[field] = decryptContentValue(row.encrypted_payload[field], `${table}:${field}`);
  }

  return decrypted;
}

export function decryptContentRows(table, rows, fieldNames) {
  return (rows || []).map((row) => decryptContentFields(table, row, fieldNames));
}

export function withoutEncryptedPayload(row) {
  if (!row || typeof row !== "object") return row;
  const { encrypted_payload, ...rest } = row;
  return rest;
}

export function withoutEncryptedPayloadRows(rows) {
  return (rows || []).map(withoutEncryptedPayload);
}

function encryptContentValue(value, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, contentKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const encoding = typeof value === "string" || value === null ? "text" : "json";
  const plaintext = value === null ? "" : encoding === "json" ? JSON.stringify(value) : value;
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    version: VERSION,
    keyVersion: CONTENT_KEY_VERSION,
    encoding,
    isNull: value === null,
  };
}

function decryptContentValue(payload, aad) {
  if (!payload || typeof payload !== "object") return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, contentKey(), Buffer.from(payload.iv, "base64url"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    if (payload.isNull) return null;
    if (payload.encoding === "json") return JSON.parse(plaintext);
    return plaintext;
  } catch {
    return null;
  }
}

function sideQuestKey() {
  const { sideQuestEncryptionKey } = getServerEnv();
  if (!sideQuestEncryptionKey) {
    const error = new Error("Missing backend environment variables: MUMBL_SIDE_QUEST_ENCRYPTION_KEY");
    error.status = 503;
    throw error;
  }

  return createHash("sha256").update(sideQuestEncryptionKey).digest();
}

function contentKey() {
  const { contentEncryptionKey } = getServerEnv();
  if (!contentEncryptionKey) {
    const error = new Error("Missing backend environment variables: MUMBL_CONTENT_ENCRYPTION_KEY");
    error.status = 503;
    throw error;
  }

  return createHash("sha256").update(contentEncryptionKey).digest();
}
