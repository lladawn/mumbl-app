import { publicDemoRoom } from "../lib/constants";
import { createToken, hashToken } from "./hash";

const starterPosts = [
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
];

export async function getOrCreatePublicDemoRoom(supabase, slug) {
  if (slug !== publicDemoRoom.slug) return null;

  const insertResult = await supabase
    .from("spaces")
    .insert({
      slug: publicDemoRoom.slug,
      name: publicDemoRoom.name,
      vibe: "chaotic",
      creator_token_hash: hashToken(createToken()),
      first_post_done: true,
      is_public: true,
      public_name: publicDemoRoom.name,
    })
    .select("*")
    .single();

  if (!insertResult.error) {
    await seedPublicDemoPosts(supabase, insertResult.data.id);
    return insertResult.data;
  }

  if (insertResult.error.code !== "23505") throw insertResult.error;

  const { data: existingSpace, error: selectError } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", publicDemoRoom.slug)
    .single();
  if (selectError) throw selectError;

  return existingSpace;
}

async function seedPublicDemoPosts(supabase, spaceId) {
  const { error } = await supabase.from("posts").insert(
    starterPosts.map((post) => ({
      space_id: spaceId,
      type: post.type,
      content: post.content,
      is_anonymous: true,
      display_name: null,
    })),
  );

  if (error) throw error;
}
