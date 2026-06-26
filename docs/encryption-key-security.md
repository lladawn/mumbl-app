# Encryption Key Security

## Current implementation

Content, Slack token, and side-quest encryption keys are derived by running the raw env-var string through a single SHA-256 hash:

```js
// src/server/encryption.js
createHash("sha256").update(envVar).digest()
```

This produces a valid 256-bit AES key, but provides no protection against low-entropy inputs — a short or memorable string maps directly to a deterministic key with no stretching or salting.

## Risk

If an operator sets `MUMBL_CONTENT_ENCRYPTION_KEY` (or the Slack/side-quest equivalents) to a guessable value (a word, a short phrase, a reused password), an attacker who can guess the env-var can derive the encryption key and decrypt all `encrypted_payload` columns in the database without needing database access.

Affected env vars:
- `MUMBL_CONTENT_ENCRYPTION_KEY` — dumps, posts, field notes, spaces
- `MUMBL_SIDE_QUEST_ENCRYPTION_KEY` — side-quest room messages
- `MUMBL_SLACK_TOKEN_ENCRYPTION_KEY` — Slack OAuth tokens

## Recommended fix

Replace `createHash("sha256")` with HKDF (available natively in Node ≥ 15 via `crypto.hkdfSync`) to add a fixed info string per key purpose:

```js
import { hkdfSync } from "crypto";

function deriveKey(envVar, info) {
  return Buffer.from(
    hkdfSync("sha256", envVar, "", info, 32)
  );
}

// Usage:
deriveKey(contentEncryptionKey, "mumbl-content-v1");
deriveKey(slackTokenEncryptionKey, "mumbl-slack-v1");
deriveKey(sideQuestEncryptionKey, "mumbl-sidequests-v1");
```

HKDF doesn't stretch low-entropy inputs (for that you'd need PBKDF2/scrypt), but it adds domain separation so keys can't be cross-used, and it's the right primitive for key derivation from high-entropy material (which env vars should be).

## Operator guidance (add to `.env.example`)

The three encryption env vars **must** be set to at least 32 cryptographically random bytes, base64- or hex-encoded. Do not use memorable strings or passwords. Generate them with:

```sh
openssl rand -base64 32
```

The current `.env.example` should document this requirement explicitly next to each key.
