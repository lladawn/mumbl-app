import { ok, badRequest, serverError } from "../../../src/server/http";
import { resolveRequestOwner } from "../../../src/server/auth";
import { decryptContentFields, encryptContentFields } from "../../../src/server/encryption";
import { createToken, hashToken } from "../../../src/server/hash";
import { isMissingSavedRoomAccessTable, roomInvitePath } from "../../../src/server/roomAccess";
import { getSupabaseAdmin } from "../../../src/server/supabase";
import { cleanString, isValidVibe, slugify } from "../../../src/server/validation";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionToken = cleanString(url.searchParams.get("sessionToken"), 256);
    const owner = await resolveRequestOwner({ request, sessionToken });
    if (!owner.userId) return ok({ savedRooms: [] });

    const supabase = getSupabaseAdmin();
    const [{ data: savedRows, error: savedError }, { data: ownedRows, error: ownedError }] = await Promise.all([
      supabase
        .from("saved_room_access")
        .select("last_opened_at, created_at, spaces(id,slug,vibe,encrypted_payload,created_at)")
        .eq("user_id", owner.userId)
        .order("last_opened_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("spaces")
        .select("id,slug,vibe,encrypted_payload,created_at")
        .eq("creator_user_id", owner.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (savedError && !isMissingSavedRoomAccessTable(savedError)) throw savedError;
    if (ownedError) throw ownedError;

    const byId = new Map();
    for (const row of savedError ? [] : savedRows || []) {
      const space = Array.isArray(row.spaces) ? row.spaces[0] : row.spaces;
      if (space?.id) byId.set(space.id, serializeSavedRoom(space));
    }
    for (const space of ownedRows || []) {
      if (space?.id) byId.set(space.id, serializeSavedRoom(space));
    }

    return ok({ savedRooms: [...byId.values()] });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = cleanString(body.name, 80).toLowerCase();
    const vibe = cleanString(body.vibe, 24) || "chill";

    if (!name) return badRequest("space name is required");
    if (!isValidVibe(vibe)) return badRequest("unsupported vibe");

    const supabase = getSupabaseAdmin();
    const owner = await resolveRequestOwner({ request, sessionToken: cleanString(body.sessionToken, 256) || "space-create" });
    const creatorToken = createToken();
    const accessToken = createToken();
    const baseSlug = slugify(name) || "team-mumbl";
    let slug = baseSlug;
    let insertedSpace;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await supabase
        .from("spaces")
        .insert({
          slug,
          vibe,
          creator_token_hash: hashToken(creatorToken),
          read_token_hash: hashToken(accessToken),
          encrypted_payload: encryptContentFields("spaces", { name, description: null, public_name: null }),
          ...(owner.userId ? { creator_user_id: owner.userId } : {}),
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
    if (owner.userId) {
      const { error: saveError } = await supabase.from("saved_room_access").upsert(
        {
          user_id: owner.userId,
          space_id: insertedSpace.id,
          read_token_hash: insertedSpace.read_token_hash,
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: "user_id,space_id" },
      );
      if (saveError && !isMissingSavedRoomAccessTable(saveError)) throw saveError;
    }

    return ok({
      slug: insertedSpace.slug,
      creatorToken,
      accessToken,
      invitePath: roomInvitePath(insertedSpace.slug, accessToken),
      space: {
        id: insertedSpace.id,
        slug: insertedSpace.slug,
        name,
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

function serializeSavedRoom(space) {
  const readableSpace = decryptContentFields("spaces", space, ["name", "description", "public_name"]);
  return {
    id: readableSpace.id,
    slug: readableSpace.slug,
    name: readableSpace.name || readableSpace.slug,
    vibe: readableSpace.vibe,
    createdAt: readableSpace.created_at ? new Date(readableSpace.created_at).getTime() : null,
  };
}
