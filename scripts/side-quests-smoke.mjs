const baseUrl = process.argv[2] || "http://127.0.0.1:3000";
const slug = process.argv[3];

if (!slug) {
  console.error("Usage: npm run side-quests:smoke -- <base-url> <space-slug>");
  process.exit(1);
}

const ownerToken = crypto.randomUUID();
const pickerToken = crypto.randomUUID();

const created = await request(`/api/spaces/${slug}/side-quests`, {
  method: "POST",
  body: {
    kind: "need",
    context: "smoke test side quest",
    sessionToken: ownerToken,
  },
});

const picked = await request(`/api/spaces/${slug}/side-quests/${created.card.id}/pick`, {
  method: "POST",
  body: { sessionToken: pickerToken },
});

if (!picked.room) {
  throw new Error("expected immediate room from active owner");
}

await request(`/api/side-quest-rooms/${picked.room.id}/messages`, {
  method: "POST",
  body: {
    message: "smoke test mumbl",
    sessionToken: pickerToken,
  },
});

const room = await request(`/api/side-quest-rooms/${picked.room.id}?sessionToken=${encodeURIComponent(ownerToken)}`);
if (!room.room.messages.some((message) => message.message === "smoke test mumbl")) {
  throw new Error("expected owner to read decrypted smoke message");
}

await request(`/api/side-quest-rooms/${picked.room.id}/leave`, {
  method: "POST",
  body: { sessionToken: ownerToken },
});

console.log(`side quests smoke passed for ${slug}`);

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { error: `${response.status} ${response.statusText} from ${path}; expected JSON but got ${contentType || "unknown content"}` };
  if (!response.ok) {
    throw new Error(data.error || `${response.status} ${response.statusText}`);
  }
  return data;
}
