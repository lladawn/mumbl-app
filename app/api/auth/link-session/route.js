import { badRequest, ok, serverError } from "../../../../src/server/http";
import { hashToken } from "../../../../src/server/hash";
import { resolveRequestOwner } from "../../../../src/server/auth";
import { getSupabaseAdmin } from "../../../../src/server/supabase";
import { cleanString } from "../../../../src/server/validation";

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionToken = cleanString(body.sessionToken, 256);
    const creatorTokens = parseCreatorTokens(body.creatorTokens);
    const postEditTokens = parsePostEditTokens(body.postEditTokens);
    if (!sessionToken) return badRequest("session token is required");

    const owner = await resolveRequestOwner({ request, sessionToken });
    if (!owner.userId) return badRequest("login is required");

    const supabase = getSupabaseAdmin();
    const updates = await Promise.all([
      linkTable({ supabase, table: "dumps", owner }),
      linkTable({ supabase, table: "field_notes", owner }),
      linkTable({ supabase, table: "public_profiles", owner, tolerateMissing: true }),
      linkTable({ supabase, table: "dump_insights", owner, tolerateMissing: true }),
      linkCreatorSpaces({ supabase, owner, creatorTokens }),
      linkPostEditTokens({ supabase, owner, postEditTokens }),
      linkReactions({ supabase, owner }),
    ]);

    return ok({
      linked: true,
      dumps: updates[0],
      fieldNotes: updates[1],
      publicProfiles: updates[2],
      dumpInsights: updates[3],
      creatorSpaces: updates[4],
      editablePosts: updates[5],
      reactions: updates[6],
    });
  } catch (error) {
    return serverError(error);
  }
}

function parseCreatorTokens(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      slug: cleanString(item?.slug, 64),
      token: cleanString(item?.token, 256),
    }))
    .filter((item) => item.slug && item.token)
    .slice(0, 50);
}

function parsePostEditTokens(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      postId: cleanString(item?.postId, 64),
      token: cleanString(item?.token, 256),
    }))
    .filter((item) => item.postId && item.token)
    .slice(0, 200);
}

async function linkCreatorSpaces({ supabase, owner, creatorTokens }) {
  if (!creatorTokens.length) return 0;
  let linked = 0;
  for (const item of creatorTokens) {
    const { count, error } = await supabase
      .from("spaces")
      .update({ creator_user_id: owner.userId }, { count: "exact" })
      .eq("slug", item.slug)
      .eq("creator_token_hash", hashToken(item.token))
      .is("creator_user_id", null);
    if (isMissingColumnError(error)) return 0;
    if (error) throw error;
    linked += count || 0;
  }
  return linked;
}

async function linkPostEditTokens({ supabase, owner, postEditTokens }) {
  if (!postEditTokens.length) return 0;
  let linked = 0;
  for (const item of postEditTokens) {
    const { count, error } = await supabase
      .from("post_edit_tokens")
      .update({ owner_user_id: owner.userId }, { count: "exact" })
      .eq("post_id", item.postId)
      .eq("edit_token_hash", hashToken(item.token))
      .is("owner_user_id", null);
    if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
    if (error) throw error;
    linked += count || 0;
  }
  return linked;
}

async function linkReactions({ supabase, owner }) {
  if (!owner.sessionTokenHash || !owner.userId) return 0;
  const authReactionHash = hashToken(`auth-reaction:${owner.userId}`);
  const { data: localRows, error: localError } = await supabase
    .from("reactions")
    .select("id,post_id,label")
    .eq("session_token_hash", owner.sessionTokenHash);
  if (isMissingTableError(localError) || isMissingColumnError(localError)) return 0;
  if (localError) throw localError;

  let linked = 0;
  for (const row of localRows || []) {
    const { data: existing, error: existingError } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", row.post_id)
      .eq("label", row.label)
      .eq("session_token_hash", authReactionHash)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id) {
      const { error: deleteError } = await supabase.from("reactions").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
    } else {
      const { error: updateError } = await supabase.from("reactions").update({ session_token_hash: authReactionHash }).eq("id", row.id);
      if (updateError) throw updateError;
    }
    linked += 1;
  }
  return linked;
}

async function linkTable({ supabase, table, owner, tolerateMissing = false }) {
  const { count, error } = await supabase
    .from(table)
    .update({ user_id: owner.userId }, { count: "exact" })
    .eq("session_token_hash", owner.sessionTokenHash)
    .is("user_id", null);

  if (tolerateMissing && (isMissingTableError(error) || isMissingColumnError(error))) return 0;
  if (isMissingColumnError(error)) return throwMissingAuthMigration();
  if (error) throw error;
  return count || 0;
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || error?.code === "PGRST204" || (message.includes("could not find") && message.includes("column"));
}

function throwMissingAuthMigration() {
  const error = new Error("Dump auth migration is not applied yet. Run supabase/migrations/0016_dump_auth_ownership.sql.");
  error.status = 503;
  throw error;
}
