import { hashToken } from "./hash";
import { decryptSideQuestMessage, encryptSideQuestMessage } from "./encryption";

const CARD_MINUTES = 15;
const KNOCK_MINUTES = 2;
const ROOM_MINUTES = 15;
const ACTIVE_SECONDS = 20;

export function sideQuestSessionHash(sessionToken) {
  return hashToken(sessionToken);
}

export function sideQuestWindows(now = new Date()) {
  return {
    now: now.toISOString(),
    activeAfter: new Date(now.getTime() - ACTIVE_SECONDS * 1000).toISOString(),
    knockExpiresAt: new Date(now.getTime() + KNOCK_MINUTES * 60 * 1000).toISOString(),
    cardExpiresAt: new Date(now.getTime() + CARD_MINUTES * 60 * 1000).toISOString(),
    roomExpiresAt: new Date(now.getTime() + ROOM_MINUTES * 60 * 1000).toISOString(),
  };
}

export async function getSpaceBySlug(supabase, slug) {
  const { data: space, error } = await supabase.from("spaces").select("id,slug").eq("slug", slug).single();
  if (error) throw error;
  return space;
}

export async function fetchSideQuestState(supabase, { spaceId, sessionHash }) {
  const now = new Date().toISOString();
  const [cardsResult, roomsResult] = await Promise.all([
    supabase
      .from("side_quest_cards")
      .select("id,kind,context,owner_session_token_hash,status,knocked_by_session_token_hash,knock_expires_at,expires_at,created_at")
      .eq("space_id", spaceId)
      .in("status", ["open", "knocked"])
      .gt("expires_at", now)
      .or(`status.eq.open,knock_expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("side_quest_rooms")
      .select("*")
      .eq("space_id", spaceId)
      .eq("status", "open")
      .gt("expires_at", now)
      .or(`requester_session_token_hash.eq.${sessionHash},responder_session_token_hash.eq.${sessionHash}`)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (cardsResult.error) throw cardsResult.error;
  if (roomsResult.error) throw roomsResult.error;

  return {
    cards: cardsResult.data.map((card) => serializeCard(card, sessionHash)),
    room: roomsResult.data[0] ? await serializeRoomWithMessages(supabase, roomsResult.data[0], sessionHash) : null,
  };
}

export async function createSideQuestCard(supabase, { spaceId, sessionHash, kind, context }) {
  const windows = sideQuestWindows();
  const { data: card, error } = await supabase
    .from("side_quest_cards")
    .insert({
      space_id: spaceId,
      kind,
      context: context || null,
      owner_session_token_hash: sessionHash,
      owner_seen_at: windows.now,
      expires_at: windows.cardExpiresAt,
    })
    .select("id,kind,context,owner_session_token_hash,status,knocked_by_session_token_hash,knock_expires_at,expires_at,created_at")
    .single();
  if (error) throw error;
  return serializeCard(card, sessionHash);
}

export async function heartbeatSideQuestCard(supabase, { spaceId, cardId, sessionHash }) {
  const { error } = await supabase
    .from("side_quest_cards")
    .update({ owner_seen_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("space_id", spaceId)
    .eq("owner_session_token_hash", sessionHash)
    .in("status", ["open", "knocked"])
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
}

export async function pickSideQuestCard(supabase, { spaceId, cardId, sessionHash }) {
  const windows = sideQuestWindows();
  const { data, error } = await supabase.rpc("claim_side_quest_card", {
    p_space_id: spaceId,
    p_card_id: cardId,
    p_picker_hash: sessionHash,
    p_now: windows.now,
    p_active_after: windows.activeAfter,
    p_knock_expires_at: windows.knockExpiresAt,
    p_room_expires_at: windows.roomExpiresAt,
  });
  if (error) throw normalizeRpcError(error);

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.opened && result.room_id) {
    const room = await getOpenRoomForSession(supabase, { roomId: result.room_id, sessionHash });
    return { opened: true, room: await serializeRoomWithMessages(supabase, room, sessionHash) };
  }

  return { opened: false, room: null };
}

export async function acceptSideQuestKnock(supabase, { spaceId, cardId, sessionHash }) {
  const windows = sideQuestWindows();
  const { data: roomId, error } = await supabase.rpc("accept_side_quest_knock", {
    p_space_id: spaceId,
    p_card_id: cardId,
    p_owner_hash: sessionHash,
    p_now: windows.now,
    p_room_expires_at: windows.roomExpiresAt,
  });
  if (error) throw normalizeRpcError(error);

  const room = await getOpenRoomForSession(supabase, { roomId, sessionHash });
  return serializeRoomWithMessages(supabase, room, sessionHash);
}

export async function cancelSideQuestCard(supabase, { spaceId, cardId, sessionHash }) {
  const { data: card, error } = await supabase
    .from("side_quest_cards")
    .select("id,owner_session_token_hash")
    .eq("id", cardId)
    .eq("space_id", spaceId)
    .single();
  if (error) throw error;
  if (card.owner_session_token_hash !== sessionHash) {
    throw Object.assign(new Error("only the quest owner can dissolve this card"), { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("side_quest_cards")
    .update({ status: "cancelled", knocked_by_session_token_hash: null, knock_expires_at: null })
    .eq("id", card.id);
  if (updateError) throw updateError;
}

export async function getOpenRoomForSession(supabase, { roomId, sessionHash }) {
  const { data: room, error } = await supabase
    .from("side_quest_rooms")
    .select("*")
    .eq("id", roomId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error) throw error;
  assertRoomParticipant(room, sessionHash);
  return room;
}

export async function serializeRoomWithMessages(supabase, room, sessionHash) {
  assertRoomParticipant(room, sessionHash);
  const { data: messages, error } = await supabase
    .from("side_quest_messages")
    .select("id,sender_session_token_hash,message_ciphertext,message_iv,message_tag,message_version,created_at")
    .eq("room_id", room.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw error;

  return {
    id: room.id,
    status: room.status,
    expiresAt: new Date(room.expires_at).getTime(),
    createdAt: new Date(room.created_at).getTime(),
    messages: messages.map((message) => ({
      id: message.id,
      mine: message.sender_session_token_hash === sessionHash,
      message: decryptSideQuestMessage({
        ciphertext: message.message_ciphertext,
        iv: message.message_iv,
        tag: message.message_tag,
        version: message.message_version,
      }),
      createdAt: new Date(message.created_at).getTime(),
    })),
  };
}

export async function createSideQuestMessage(supabase, { room, sessionHash, message }) {
  assertRoomParticipant(room, sessionHash);
  const encrypted = encryptSideQuestMessage(message);
  const { data, error } = await supabase
    .from("side_quest_messages")
    .insert({
      room_id: room.id,
      sender_session_token_hash: sessionHash,
      message_ciphertext: encrypted.ciphertext,
      message_iv: encrypted.iv,
      message_tag: encrypted.tag,
      message_version: encrypted.version,
      expires_at: room.expires_at,
    })
    .select("id,created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    mine: true,
    message,
    createdAt: new Date(data.created_at).getTime(),
  };
}

export async function closeSideQuestRoom(supabase, { room, sessionHash, status }) {
  assertRoomParticipant(room, sessionHash);
  const now = new Date().toISOString();
  const patch = status === "reported" ? { status, reported_at: now, dissolved_at: now } : { status, dissolved_at: now };

  const { error: roomError } = await supabase.from("side_quest_rooms").update(patch).eq("id", room.id);
  if (roomError) throw roomError;

  if (status === "reported") {
    const { error: reportError } = await supabase
      .from("side_quest_reports")
      .upsert({ room_id: room.id, reporter_session_token_hash: sessionHash }, { onConflict: "room_id,reporter_session_token_hash" });
    if (reportError) throw reportError;
  }
}

export async function cleanupExpiredSideQuestData(supabase) {
  const now = new Date().toISOString();
  const { error: messageError } = await supabase.from("side_quest_messages").delete().lt("expires_at", now);
  if (messageError) throw messageError;

  const { error: roomError } = await supabase
    .from("side_quest_rooms")
    .update({ status: "dissolved", dissolved_at: now })
    .eq("status", "open")
    .lt("expires_at", now);
  if (roomError) throw roomError;
}

function assertRoomParticipant(room, sessionHash) {
  if (![room.requester_session_token_hash, room.responder_session_token_hash].includes(sessionHash)) {
    throw Object.assign(new Error("that tiny room is not yours"), { status: 404 });
  }
}

function serializeCard(card, sessionHash) {
  const mine = card.owner_session_token_hash === sessionHash;
  return {
    id: card.id,
    kind: card.kind,
    context: card.context || "",
    status: card.status,
    mine,
    knockedByMe: card.knocked_by_session_token_hash === sessionHash,
    hasKnock: mine && card.status === "knocked" && Boolean(card.knocked_by_session_token_hash),
    expiresAt: new Date(card.expires_at).getTime(),
    knockExpiresAt: card.knock_expires_at ? new Date(card.knock_expires_at).getTime() : null,
    createdAt: new Date(card.created_at).getTime(),
  };
}

function normalizeRpcError(error) {
  return Object.assign(new Error(error.message || "side quest action failed"), { status: 400 });
}
