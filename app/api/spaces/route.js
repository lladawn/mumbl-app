import { ok, badRequest, serverError } from "../../../src/server/http";
import { createToken, hashToken } from "../../../src/server/hash";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString, isValidVibe, slugify } from "../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = cleanString(body.name, 80).toLowerCase();
    const vibe = cleanString(body.vibe, 24) || "chill";

    if (!name) return badRequest("space name is required");
    if (!isValidVibe(vibe)) return badRequest("unsupported vibe");

    const supabase = getSupabaseAdmin();
    const creatorToken = createToken();
    const baseSlug = slugify(name) || "team-mumbl";
    let slug = baseSlug;
    let insertedSpace;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await supabase
        .from("spaces")
        .insert({
          slug,
          name,
          vibe,
          creator_token_hash: hashToken(creatorToken),
        })
        .select()
        .single();

      if (!error) {
        insertedSpace = data;
        break;
      }

      if (error.code !== "23505") throw error;
      slug = `${baseSlug}-${attempt + 2}`;
    }

    if (!insertedSpace) return serverError(new Error("could not create a unique space slug"));

    return ok({
      slug: insertedSpace.slug,
      creatorToken,
      space: {
        id: insertedSpace.id,
        slug: insertedSpace.slug,
        name: insertedSpace.name,
        vibe: insertedSpace.vibe,
        firstPostDone: insertedSpace.first_post_done,
        posts: [],
        heartbeats: [],
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
