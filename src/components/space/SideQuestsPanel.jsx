"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acceptSideQuest,
  cancelSideQuest,
  createSideQuest,
  fetchSideQuestRoom,
  fetchSideQuests,
  heartbeatSideQuest,
  leaveSideQuestRoom,
  pickSideQuest,
  reportSideQuestRoom,
  sendSideQuestMessage,
} from "../../lib/api";
import { trackEvent } from "../../lib/analytics";

const BOARD_FAST_MS = 5000;
const BOARD_IDLE_MS = 12000;
const ROOM_MS = 2500;
const HIDDEN_MS = 45000;
const HEARTBEAT_MS = 8000;

export default function SideQuestsPanel({ space, onToast }) {
  const [cards, setCards] = useState([]);
  const [room, setRoom] = useState(null);
  const [kind, setKind] = useState("need");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState("");

  const ownedCards = useMemo(() => cards.filter((card) => card.mine), [cards]);
  const sortedCards = useMemo(() => [...cards].sort((a, b) => b.createdAt - a.createdAt), [cards]);

  async function refresh({ quiet = false } = {}) {
    try {
      if (room) {
        const data = await fetchSideQuestRoom(room.id);
        setRoom(data.room);
        return;
      }

      const data = await fetchSideQuests(space.slug);
      setCards(data.cards);
      if (data.room) setRoom(data.room);
      setLoadError("");
    } catch (error) {
      if (room) setRoom(null);
      setLoadError(error.message || "side quests are not ready here yet.");
      if (!quiet) onToast(error.message || "side quests got briefly weird.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function tick() {
      if (cancelled) return;
      await refresh({ quiet: true });
      if (cancelled) return;

      const hasOwnedCard = ownedCards.length > 0;
      const delay = document.hidden ? HIDDEN_MS : room ? ROOM_MS : hasOwnedCard ? BOARD_FAST_MS : BOARD_IDLE_MS;
      timeoutId = window.setTimeout(tick, delay);
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [space.slug, room?.id, ownedCards.length]);

  useEffect(() => {
    if (!ownedCards.length || room) return undefined;

    let cancelled = false;
    let timeoutId;

    async function beat() {
      if (cancelled || document.hidden) {
        timeoutId = window.setTimeout(beat, HEARTBEAT_MS);
        return;
      }

      await Promise.allSettled(ownedCards.map((card) => heartbeatSideQuest({ slug: space.slug, cardId: card.id })));
      if (!cancelled) timeoutId = window.setTimeout(beat, HEARTBEAT_MS);
    }

    beat();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [space.slug, room?.id, ownedCards.map((card) => card.id).join(":")]);

  async function handleCreate(event) {
    event.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    try {
      const { card } = await createSideQuest({ slug: space.slug, kind, context: context.trim() });
      setCards((existing) => [card, ...existing]);
      setContext("");
      trackEvent("side_quest_created", { kind });
      onToast(kind === "need" ? "side quest posted." : "quest board knows you're around.");
    } catch (error) {
      trackEvent("side_quest_create_failed", { kind });
      onToast(error.message || "couldn't post that side quest.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePick(card) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const result = await pickSideQuest({ slug: space.slug, cardId: card.id });
      trackEvent("side_quest_picked", { kind: card.kind, opened: result.opened });
      if (result.room) {
        setRoom(result.room);
        setCards((existing) => existing.filter((item) => item.id !== card.id));
        onToast("tiny room summoned.");
      } else {
        await refresh({ quiet: true });
        onToast("someone picked this up.");
      }
    } catch (error) {
      trackEvent("side_quest_pick_failed", { kind: card.kind });
      onToast(error.message || "couldn't pick that up.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAccept(card) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const { room: openedRoom } = await acceptSideQuest({ slug: space.slug, cardId: card.id });
      setRoom(openedRoom);
      setCards((existing) => existing.filter((item) => item.id !== card.id));
      trackEvent("side_quest_accepted", { kind: card.kind });
      onToast("tiny room summoned.");
    } catch (error) {
      trackEvent("side_quest_accept_failed", { kind: card.kind });
      onToast(error.message || "that knock wandered off.");
      await refresh({ quiet: true });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancel(card) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await cancelSideQuest({ slug: space.slug, cardId: card.id });
      setCards((existing) => existing.filter((item) => item.id !== card.id));
      trackEvent("side_quest_cancelled", { kind: card.kind });
      onToast("quest dissolved.");
    } catch (error) {
      trackEvent("side_quest_cancel_failed", { kind: card.kind });
      onToast(error.message || "couldn't dissolve that card.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !room || isSending) return;

    setIsSending(true);
    try {
      const { message: created } = await sendSideQuestMessage({ roomId: room.id, message: trimmed });
      setRoom({ ...room, messages: [...room.messages, created] });
      setMessage("");
      trackEvent("side_quest_message_sent");
    } catch (error) {
      trackEvent("side_quest_message_failed");
      onToast(error.message || "message bounced.");
    } finally {
      setIsSending(false);
    }
  }

  async function closeRoom(action) {
    if (!room || isBusy) return;
    const closingRoomId = room.id;
    setIsBusy(true);
    try {
      if (action === "report") {
        await reportSideQuestRoom(closingRoomId);
        trackEvent("side_quest_room_reported");
        onToast("quest reported and dissolved.");
      } else {
        await leaveSideQuestRoom(closingRoomId);
        trackEvent("side_quest_room_left");
        onToast("quest dissolved.");
      }
      setRoom(null);
      const data = await fetchSideQuests(space.slug);
      setCards(data.cards);
    } catch (error) {
      trackEvent("side_quest_room_close_failed", { action });
      onToast(error.message || "couldn't dissolve that room.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="panel side-quests-panel" aria-live="polite">
      <div className="side-quests-header">
        <div>
          <h3>side quests</h3>
          <p>{room ? "two-person mumbl. expires before it gets weird." : "tiny anonymous backchannels for this room."}</p>
        </div>
        <span>{room ? "room" : ownedCards.length ? "live" : "board"}</span>
      </div>

      {room ? (
        <TinyRoom room={room} message={message} setMessage={setMessage} isBusy={isBusy || isSending} onSend={handleSend} onLeave={() => closeRoom("leave")} onReport={() => closeRoom("report")} />
      ) : (
        <>
          <form className="side-quest-form" onSubmit={handleCreate}>
            <div className="side-quest-mode" role="tablist" aria-label="side quest type">
              <button className={kind === "need" ? "active" : ""} type="button" onClick={() => setKind("need")} disabled={isBusy}>
                need a side quest
              </button>
              <button className={kind === "open" ? "active" : ""} type="button" onClick={() => setKind("open")} disabled={isBusy}>
                open for side quests
              </button>
            </div>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              maxLength={140}
              placeholder={kind === "need" ? "e.g. this ticket is haunting me" : "e.g. ten spare minutes, decent takes"}
              disabled={isBusy}
            />
            <button className="share-button primary button-with-loader" type="submit" disabled={isBusy}>
              {isBusy && <span className="mini-loader" aria-hidden="true" />}
              {kind === "need" ? "post side quest" : "pin yourself up"}
            </button>
          </form>

          <div className="side-quest-list">
            {loadError && !sortedCards.length ? (
              <div className="side-quest-empty">side quests are still being wired in. try again after the room gets its tiny tunnels.</div>
            ) : sortedCards.length ? (
              sortedCards.map((card) => (
                <QuestCard card={card} key={card.id} isBusy={isBusy} onPick={() => handlePick(card)} onAccept={() => handleAccept(card)} onCancel={() => handleCancel(card)} />
              ))
            ) : (
              <div className="side-quest-empty">no quests on the board. suspiciously peaceful.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function QuestCard({ card, isBusy, onPick, onAccept, onCancel }) {
  const title = card.kind === "need" ? "needs a side quest" : "open for side quests";
  const action = card.kind === "need" ? "pick this up" : "borrow this brain";
  return (
    <article className={`side-quest-card ${card.mine ? "mine" : ""}`}>
      <div className="side-quest-card-top">
        <strong>{card.hasKnock ? "someone picked this up" : title}</strong>
        <span>{minutesLeft(card.expiresAt)}</span>
      </div>
      <p>{card.context || (card.kind === "need" ? "something is rattling around." : "available for a tiny detour.")}</p>
      <div className="side-quest-card-actions">
        {card.hasKnock ? (
          <button className="share-button primary" type="button" onClick={onAccept} disabled={isBusy}>
            summon tiny room
          </button>
        ) : card.mine ? (
          <button className="ghost-button" type="button" onClick={onCancel} disabled={isBusy}>
            dissolve
          </button>
        ) : (
          <button className="share-button primary" type="button" onClick={onPick} disabled={isBusy || card.knockedByMe}>
            {card.knockedByMe ? "knock sent" : action}
          </button>
        )}
      </div>
    </article>
  );
}

function TinyRoom({ room, message, setMessage, isBusy, onSend, onLeave, onReport }) {
  return (
    <div className="tiny-room">
      <div className="tiny-room-top">
        <strong>tiny room</strong>
        <span>{minutesLeft(room.expiresAt)}</span>
      </div>
      <div className="tiny-room-messages">
        {room.messages.length ? (
          room.messages.map((item) => (
            <p className={`tiny-room-message ${item.mine ? "mine" : ""}`} key={item.id}>
              {item.message}
            </p>
          ))
        ) : (
          <div className="tiny-room-empty">say the thing. optional bravery, mandatory brevity.</div>
        )}
      </div>
      <form className="tiny-room-compose" onSubmit={onSend}>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={360} placeholder="drop the tiny mumbl..." disabled={isBusy} required />
        <button className="share-button primary" type="submit" disabled={isBusy || !message.trim()}>
          send
        </button>
      </form>
      <div className="tiny-room-actions">
        <button className="ghost-button" type="button" onClick={onLeave} disabled={isBusy}>
          dissolve room
        </button>
        <button className="ghost-button danger" type="button" onClick={onReport} disabled={isBusy}>
          report weirdness
        </button>
      </div>
    </div>
  );
}

function minutesLeft(timestamp) {
  const minutes = Math.max(0, Math.ceil((timestamp - Date.now()) / 60000));
  return minutes <= 1 ? "1m" : `${minutes}m`;
}
