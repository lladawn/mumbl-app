import { feedbackRoom, publicDemoRoom } from "../lib/constants";
import { encryptContentFields } from "./encryption";
import { createToken, hashToken } from "./hash";

const knownPublicRooms = [
  {
    ...publicDemoRoom,
    vibe: "chaotic",
    starterPosts: [
      {
        type: "thought",
        content: "if this room loaded, something somewhere is probably working on someone else's machine too.",
      },
      {
        type: "rant",
        content: "quick syncs are never quick. this is science until proven otherwise.",
      },
      {
        type: "find",
        content: "tiny useful thing: drop the awkward thought early, before it grows legs and becomes a meeting.",
      },
      {
        type: "lol",
        content: "locally green. emotionally yellow. spiritually waiting for ci.",
      },
    ],
  },
  {
    ...feedbackRoom,
    vibe: "professional",
    starterPosts: [
      {
        type: "thought",
        content: "what part of mumbl made you think: okay, this could actually work for my team?",
      },
      {
        type: "rant",
        content: "what felt confusing, awkward, slow, or too much like software trying to be cute?",
      },
      {
        type: "win",
        content: "drop one thing mumbl should absolutely keep. tiny details count.",
      },
      {
        type: "find",
        content: "seen a product pattern mumbl should learn from? throw it here.",
      },
    ],
  },
];

export async function getOrCreateKnownPublicRoom(supabase, slug) {
  const room = knownPublicRooms.find((knownRoom) => knownRoom.slug === slug);
  if (!room) return null;

  const insertResult = await supabase
    .from("spaces")
    .insert({
      slug: room.slug,
      vibe: room.vibe,
      creator_token_hash: hashToken(createToken()),
      first_post_done: true,
      is_public: true,
      encrypted_payload: encryptContentFields("spaces", {
        name: room.name,
        description: null,
        public_name: room.name,
      }),
    })
    .select("*")
    .single();

  if (!insertResult.error) {
    await seedPublicRoomPosts(supabase, insertResult.data.id, room.starterPosts);
    return insertResult.data;
  }

  if (insertResult.error.code !== "23505") throw insertResult.error;

  const { data: existingSpace, error: selectError } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", room.slug)
    .single();
  if (selectError) throw selectError;

  return existingSpace;
}

async function seedPublicRoomPosts(supabase, spaceId, starterPosts) {
  const { error } = await supabase.from("posts").insert(
    starterPosts.map((post) => ({
      space_id: spaceId,
      type: post.type,
      is_anonymous: true,
      encrypted_payload: encryptContentFields("posts", {
        content: post.content,
        display_name: null,
        field_note_title: null,
      }),
    })),
  );

  if (error) throw error;
}
