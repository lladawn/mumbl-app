import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getServerEnv } from "./env";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;

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

function sideQuestKey() {
  const { sideQuestEncryptionKey } = getServerEnv();
  if (!sideQuestEncryptionKey) {
    const error = new Error("Missing backend environment variables: MUMBL_SIDE_QUEST_ENCRYPTION_KEY");
    error.status = 503;
    throw error;
  }

  return createHash("sha256").update(sideQuestEncryptionKey).digest();
}
