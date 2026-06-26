"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDump,
  deleteDump,
  deleteDumps,
  deleteFieldNote,
  draftFieldNote,
  fetchDumpMap,
  fetchDumps,
  fetchPublicProfileForSession,
  fetchSavedRooms,
  publishFieldNote,
  savePublicProfile,
  setFieldNotePublic,
  testGeneratePatternInsight,
  updateDump,
  updateFieldNote,
} from "../lib/api";
import { AUTH_CHANGED_EVENT, linkCurrentDumpSession } from "../lib/auth";
import { getRecentSlug, getRoomAccessToken, saveRoomAccessToken } from "../lib/storage";
import { EditIcon, TrashIcon } from "./ActionIcons";
import Toast from "./Toast";

const placeholders = [
  "what are you actually thinking about right now?",
  "say the thing you didn't say in standup.",
  "what happened today?",
  "what's been sitting in your head all week?",
  "dump it here.",
];

const MAX_DUMP_CHARS = 4000;
const patternGraphUiEnabled = process.env.NEXT_PUBLIC_ENABLE_PATTERN_GRAPH === "true";

export default function DumpPageClient({ mode = "home" }) {
  const [dumps, setDumps] = useState([]);
  const [status, setStatus] = useState("loading");
  const [fieldNotes, setFieldNotes] = useState([]);
  const [activePanel, setActivePanel] = useState("dumps");
  const [content, setContent] = useState("");
  const [wantsReflection, setWantsReflection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [recentSlug, setRecentSlug] = useState("");

  const [savedRooms, setSavedRooms] = useState([]);
  const [publishAnonymous, setPublishAnonymous] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicProfileStatus, setPublicProfileStatus] = useState("loading");
  const [publicHandleDraft, setPublicHandleDraft] = useState("");
  const [publicNameDraft, setPublicNameDraft] = useState("");
  const [publicBioDraft, setPublicBioDraft] = useState("");
  const [publicModalOpen, setPublicModalOpen] = useState(false);
  const [selectedDumpIds, setSelectedDumpIds] = useState([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [publishingNoteId, setPublishingNoteId] = useState("");
  const [mutatingNoteId, setMutatingNoteId] = useState("");
  const [publicMutatingNoteId, setPublicMutatingNoteId] = useState("");
  const [speechSupported, setSpeechSupported] = useState(null);
  const [speechStatus, setSpeechStatus] = useState("idle");
  const [interimSpeech, setInterimSpeech] = useState("");
  const [toast, setToast] = useState("");
  const recognitionRef = useRef(null);
  const ignoreSpeechResultsRef = useRef(false);
  const placeholder = placeholders[(dumps.length + content.length) % placeholders.length];

  useEffect(() => {
    setRecentSlug(getRecentSlug(""));
    const params = new URLSearchParams(window.location.search);
    if (params.get("fieldNote")) {
      setActivePanel("notes");
      setToast("draft ready. review it before it goes anywhere.");
    }
    if (params.get("spaceDeleted")) {
      setToast("room deleted. field notes from it stayed in your dump.");
      window.history.replaceState({}, "", "/dump");
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      ignoreSpeechResultsRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadDumpState(() => mounted);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function handleAuthChanged(event) {
      if (!mounted) return;
      setStatus("loading");
      setSelectedDumpIds([]);
      setConfirmBulkDelete(false);
      setExpandedId("");
      if (event.detail?.status === "anonymous") {
        setDumps([]);
        setFieldNotes([]);
        setSavedRooms([]);
        setPublicProfile(null);
        setPublicProfileStatus("loading");
      }
      await loadDumpState(() => mounted);
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, []);

  const map = useMemo(() => makeDumpMap(dumps), [dumps]);
  const selectedDumps = dumps.filter((dump) => selectedDumpIds.includes(dump.id));

  async function handleSave(event) {
    event.preventDefault();
    stopSpeechRecognition({ discardResults: true });
    const trimmed = content.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      const result = await createDump({ content: trimmed, wantsReflection });
      setDumps((current) => [result.dump, ...current]);
      setContent("");
      setWantsReflection(false);
      setExpandedId(result.dump.id);
      setToast("it's in the dump. no one can see it but you.");
    } catch (error) {
      setToast(error.message || "couldn't keep that yet.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDumpKeyDown(event) {
    if (event.key !== "Enter" || !event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleUpdateDump(dump, nextContent, nextWantsReflection) {
    try {
      const result = await updateDump({ dumpId: dump.id, content: nextContent, wantsReflection: nextWantsReflection });
      setDumps((current) => current.map((item) => (item.id === dump.id ? result.dump : item)));
      setToast("saved.");
      return result.dump;
    } catch (error) {
      setToast(error.message || "couldn't save that edit.");
      throw error;
    }
  }

  async function handleDeleteDump(dump) {
    try {
      await deleteDump(dump.id);
      setDumps((current) => current.filter((item) => item.id !== dump.id));
      setSelectedDumpIds((current) => current.filter((id) => id !== dump.id));
      setExpandedId((current) => (current === dump.id ? "" : current));
      setToast("deleted from your dump.");
    } catch (error) {
      setToast(error.message || "couldn't delete that dump.");
      throw error;
    }
  }

  async function handleBulkDeleteDumps() {
    if (!selectedDumpIds.length) {
      setToast("select dumps to delete first.");
      return;
    }
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }

    setBulkDeleting(true);
    try {
      const ids = [...selectedDumpIds];
      const result = await deleteDumps({ dumpIds: ids });
      setDumps((current) => current.filter((dump) => !ids.includes(dump.id)));
      setSelectedDumpIds([]);
      setExpandedId((current) => (ids.includes(current) ? "" : current));
      setConfirmBulkDelete(false);
      const deletedCount = result.deleted ?? ids.length;
      setToast(`${deletedCount} dump${deletedCount === 1 ? "" : "s"} deleted.`);
    } catch (error) {
      setToast(error.message || "couldn't delete those dumps.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDraftFieldNote() {
    if (!selectedDumpIds.length || pendingDraft) {
      setToast("pick one or more dumps first.");
      return;
    }
    if (selectedDumpIds.length > 10) {
      setToast("draft with 10 dumps or fewer. bulk delete can use the whole selection.");
      return;
    }

    setPendingDraft(true);
    try {
      const result = await draftFieldNote({ dumpIds: selectedDumpIds });
      setFieldNotes((current) => [result.fieldNote, ...current]);
      setSelectedDumpIds([]);
      setActivePanel("notes");
      setToast(result.visibilityReminder || "draft ready. read it before it goes anywhere.");
    } catch (error) {
      setToast(error.message || "couldn't draft that field note.");
    } finally {
      setPendingDraft(false);
    }
  }

  function handleSelectAllShown() {
    setSelectedDumpIds(dumps.map((dump) => dump.id));
    setConfirmBulkDelete(false);
  }

  function handleClearSelection() {
    setSelectedDumpIds([]);
    setConfirmBulkDelete(false);
  }

  async function handlePublishFieldNote(fieldNote, edits, manualInvite = "", shareSlug = "") {
    const manualRoom = parseManualRoomInvite(manualInvite);
    if (manualInvite.trim() && !shareSlug && (!manualRoom.slug || !manualRoom.accessToken)) {
      setToast("paste the full invite link, including ?key=...");
      return;
    }
    if (manualRoom.slug && manualRoom.accessToken) saveRoomAccessToken(manualRoom.slug, manualRoom.accessToken);
    const slug = (manualRoom.slug || shareSlug || recentSlug).trim();
    if (!slug || publishingNoteId) {
      setToast("choose a saved room or paste the full invite link.");
      return;
    }

    setPublishingNoteId(fieldNote.id);
    try {
      const result = await publishFieldNote({
        fieldNoteId: fieldNote.id,
        slug,
        title: edits.title,
        content: edits.content,
        isAnonymous: publishAnonymous,
        displayName,
      });
      setFieldNotes((current) => current.map((item) => (item.id === fieldNote.id ? result.fieldNote : item)));
      setRecentSlug(slug);
      setDisplayName("");
      setToast("published to team reads.");
    } catch (error) {
      setToast(error.message || "couldn't publish that field note.");
    } finally {
      setPublishingNoteId("");
    }
  }

  async function handleUpdateFieldNote(fieldNote, edits) {
    setMutatingNoteId(fieldNote.id);
    try {
      const result = await updateFieldNote({ fieldNoteId: fieldNote.id, title: edits.title, content: edits.content });
      setFieldNotes((current) => current.map((item) => (item.id === fieldNote.id ? result.fieldNote : item)));
      setToast(fieldNote.isPublished ? "updated in team reads." : "draft saved.");
    } catch (error) {
      setToast(error.message || "couldn't save that field note.");
      throw error;
    } finally {
      setMutatingNoteId("");
    }
  }

  async function handleDeleteFieldNote(fieldNote) {
    setMutatingNoteId(fieldNote.id);
    try {
      await deleteFieldNote(fieldNote.id);
      setFieldNotes((current) => current.filter((item) => item.id !== fieldNote.id));
      setToast(fieldNote.isPublished ? "removed from team reads." : "draft deleted.");
    } catch (error) {
      setToast(error.message || "couldn't delete that field note.");
      throw error;
    } finally {
      setMutatingNoteId("");
    }
  }

  async function handleSavePublicProfile(event) {
    event?.preventDefault();
    if (publicProfileStatus === "saving") return;

    setPublicProfileStatus("saving");
    try {
      const result = await savePublicProfile({
        handle: publicHandleDraft,
        displayName: publicNameDraft,
        bio: publicBioDraft,
      });
      setPublicProfile(result.profile);
      setPublicHandleDraft(result.profile.handle || "");
      setPublicNameDraft(result.profile.displayName || "");
      setPublicBioDraft(result.profile.bio || "");
      setPublicProfileStatus("ready");
      setToast(`@${result.profile.handle} is yours. choose which field notes go public.`);
    } catch (error) {
      setPublicProfileStatus("ready");
      setToast(error.message || "couldn't save that public handle.");
    }
  }

  async function handleToggleFieldNotePublic(fieldNote, isPublic) {
    if (!publicProfile?.handle) {
      setToast("choose a public handle first.");
      return;
    }

    setPublicMutatingNoteId(fieldNote.id);
    try {
      const result = await setFieldNotePublic({ fieldNoteId: fieldNote.id, isPublic, handle: publicProfile.handle });
      setFieldNotes((current) => current.map((item) => (item.id === fieldNote.id ? result.fieldNote : item)));
      setToast(isPublic ? `added to @${publicProfile.handle}.` : `removed from @${publicProfile.handle}.`);
    } catch (error) {
      setToast(error.message || "couldn't update your public profile.");
    } finally {
      setPublicMutatingNoteId("");
    }
  }

  function toggleSelected(dumpId) {
    setConfirmBulkDelete(false);
    setSelectedDumpIds((current) =>
      current.includes(dumpId) ? current.filter((id) => id !== dumpId) : [...current, dumpId],
    );
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechStatus("unsupported");
      setToast("mic not available here. typing still works.");
      return;
    }

    if (isSaving) return;

    stopSpeechRecognition({ discardResults: true });
    ignoreSpeechResultsRef.current = false;
    setInterimSpeech("");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setSpeechStatus("listening");
    };

    recognition.onresult = (event) => {
      if (ignoreSpeechResultsRef.current) return;

      let finalTranscript = "";
      let nextInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || "";
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          nextInterim += transcript;
        }
      }

      if (finalTranscript.trim()) {
        setContent((current) => appendSpeechTranscript(current, finalTranscript));
      }

      setInterimSpeech(nextInterim.trim());
    };

    recognition.onerror = (event) => {
      ignoreSpeechResultsRef.current = true;
      recognitionRef.current = null;
      setInterimSpeech("");
      setSpeechStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "blocked" : "error");
      setToast(speechErrorMessage(event.error));
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterimSpeech("");
      setSpeechStatus((current) => (current === "blocked" || current === "error" || current === "unsupported" ? current : "idle"));
      ignoreSpeechResultsRef.current = false;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setSpeechStatus("error");
      setToast("couldn't start the mic. try again in a second.");
    }
  }

  function stopSpeechRecognition({ discardResults = false } = {}) {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setInterimSpeech("");
      if (speechStatus === "listening" || speechStatus === "stopping") setSpeechStatus("idle");
      return;
    }

    ignoreSpeechResultsRef.current = discardResults;
    setInterimSpeech("");
    setSpeechStatus("stopping");

    try {
      if (discardResults) {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      recognitionRef.current = null;
      setSpeechStatus("idle");
    }
  }

  function toggleSpeechRecognition() {
    if (speechStatus === "listening" || speechStatus === "stopping") {
      stopSpeechRecognition();
      return;
    }

    startSpeechRecognition();
  }

  if (mode === "map") {
    return <DumpMap dumps={dumps} fieldNotes={fieldNotes} map={map} status={status} toast={toast} setToast={setToast} />;
  }

  return (
    <section className={`dump-view ${mode === "new" ? "dump-view-focus" : ""}`}>
      <div className="dump-hero compact">
        <div>
          <p className="eyebrow">private · first</p>
          <h1>your dump</h1>
          <p>Write the messy thing. Keep it private. Turn only the useful thread into a field note later.</p>
        </div>
        <div className="dump-nav">
          {patternGraphUiEnabled && (
            <>
              <Link className="ghost-button button-link" href="/dump/map">
                see the map
              </Link>
              <Link className="ghost-button button-link" href="/patterns">
                patterns
              </Link>
            </>
          )}
          <button className="ghost-button" type="button" onClick={() => setPublicModalOpen(true)}>
            go public
          </button>
          {recentSlug && (
            <Link className="ghost-button button-link" href={roomLinkFor(recentSlug)}>
              team reads
            </Link>
          )}
        </div>
      </div>

      <div className="dump-workspace">
        <form className="dump-composer" onSubmit={handleSave} aria-busy={isSaving}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleDumpKeyDown}
            maxLength={MAX_DUMP_CHARS}
            placeholder={placeholder}
            autoFocus={mode === "new"}
            disabled={isSaving}
            required
          />
          <div className={`dump-voice-draft ${interimSpeech ? "active" : ""}`} aria-live="polite">
            {interimSpeech ? interimSpeech : "voice draft appears here while you talk."}
          </div>
          <div className="dump-composer-bottom">
            <label className="reflection-toggle">
              <input
                type="checkbox"
                checked={wantsReflection}
                onChange={(event) => setWantsReflection(event.target.checked)}
                disabled={isSaving}
              />
              reflect after saving
            </label>
            <div className="dump-composer-meta">
              <button
                className={`voice-dump-button ${speechStatus === "listening" ? "listening" : ""}`}
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={isSaving || speechStatus === "stopping" || speechSupported === false}
                aria-pressed={speechStatus === "listening"}
              >
                <span className="voice-dump-dot" aria-hidden="true" />
                {speechButtonLabel({ speechSupported, speechStatus })}
              </button>
              <span>{content.trim().length} chars</span>
            </div>
          </div>
          <div className="dump-actions">
            <button className="solid-button button-with-loader" type="submit" disabled={isSaving}>
              {isSaving && <span className="mini-loader" aria-hidden="true" />}
              {isSaving ? "keeping..." : "keep private"}
            </button>
          </div>
        </form>

        <aside className="dump-rail">
          <div className="dump-rail-card private-card">
            <span>private space</span>
            <strong>Nothing here goes to the team until you publish a field note.</strong>
          </div>
          <div className="dump-rail-card draft-card">
            <span>make readable</span>
            <strong>{selectedDumpIds.length ? `${selectedDumpIds.length} selected` : "select dumps from history"}</strong>
            <p>{selectedDumps.length ? selectedDumps.map((dump) => firstLine(dump.content)).join(" · ") : "Pick related dumps. Mumbl turns the thread into a publishable field note. You edit. Then you decide."}</p>
            <button
              className="share-button button-with-loader"
              type="button"
              onClick={handleDraftFieldNote}
              disabled={!selectedDumpIds.length || pendingDraft}
            >
              {pendingDraft && <span className="mini-loader" aria-hidden="true" />}
              {pendingDraft ? "drafting..." : "draft a good read"}
            </button>
          </div>
        </aside>
      </div>

      <div className="dump-panel-tabs" role="tablist" aria-label="dump workspace">
        <button className={activePanel === "dumps" ? "active" : ""} type="button" onClick={() => setActivePanel("dumps")}>
          private dumps <span>{dumps.length}</span>
        </button>
        <button className={activePanel === "notes" ? "active" : ""} type="button" onClick={() => setActivePanel("notes")}>
          field notes <span>{fieldNotes.length}</span>
        </button>
      </div>

      {activePanel === "dumps" ? (
        <section className="dump-history">
          <div className="dump-section-heading">
            <div>
              <span>history</span>
              <h2>private dumps</h2>
            </div>
            <div className="dump-history-actions">
              <small>{selectedDumpIds.length ? `${selectedDumpIds.length} selected` : `${dumps.length} saved`}</small>
              {dumps.length ? (
                <div className="dump-bulk-actions">
                  <button className="ghost-button" type="button" onClick={selectedDumpIds.length === dumps.length ? handleClearSelection : handleSelectAllShown} disabled={bulkDeleting}>
                    {selectedDumpIds.length === dumps.length ? "clear selection" : "select all shown"}
                  </button>
                  <button
                    className="ghost-button danger button-with-loader"
                    type="button"
                    onClick={handleBulkDeleteDumps}
                    disabled={!selectedDumpIds.length || bulkDeleting}
                  >
                    {bulkDeleting && <span className="mini-loader" aria-hidden="true" />}
                    {confirmBulkDelete ? "delete selected forever" : "delete selected"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="dump-feed">
            {status === "loading" ? <div className="empty-state">opening your dump...</div> : null}
            {status === "ready" && !dumps.length ? (
              <div className="empty-state">nothing here yet. what's been sitting in your head?</div>
            ) : null}
            {dumps.map((dump) => (
              <DumpCard
                dump={dump}
                key={dump.id}
                expanded={expandedId === dump.id}
                setExpandedId={setExpandedId}
                selected={selectedDumpIds.includes(dump.id)}
                toggleSelected={() => toggleSelected(dump.id)}
                updateDump={handleUpdateDump}
                deleteDump={handleDeleteDump}
              />
            ))}
          </div>
        </section>
      ) : (
          <FieldNoteDrafts
            fieldNotes={fieldNotes}
            recentSlug={recentSlug}
            savedRooms={savedRooms}
          publishAnonymous={publishAnonymous}
          setPublishAnonymous={setPublishAnonymous}
          displayName={displayName}
          setDisplayName={setDisplayName}
          publishingNoteId={publishingNoteId}
          mutatingNoteId={mutatingNoteId}
          handlePublishFieldNote={handlePublishFieldNote}
          handleUpdateFieldNote={handleUpdateFieldNote}
          handleDeleteFieldNote={handleDeleteFieldNote}
        />
      )}

      {publicModalOpen && (
        <GoPublicModal
          close={() => setPublicModalOpen(false)}
          fieldNotes={fieldNotes}
          publicProfile={publicProfile}
          publicProfileStatus={publicProfileStatus}
          publicHandleDraft={publicHandleDraft}
          publicNameDraft={publicNameDraft}
          publicBioDraft={publicBioDraft}
          publicMutatingNoteId={publicMutatingNoteId}
          setPublicHandleDraft={setPublicHandleDraft}
          setPublicNameDraft={setPublicNameDraft}
          setPublicBioDraft={setPublicBioDraft}
          handleSavePublicProfile={handleSavePublicProfile}
          handleToggleFieldNotePublic={handleToggleFieldNotePublic}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </section>
  );

  async function loadDumpState(isMounted = () => true) {
    try {
      await repairLoggedInSessionLink();
      const [result, profileResult, roomsResult] = await Promise.all([fetchDumps(), fetchPublicProfileForSession(), fetchSavedRooms()]);
      if (!isMounted()) return;
      setDumps(result.dumps || []);
      setFieldNotes(result.fieldNotes || []);
      setSavedRooms(roomsResult.savedRooms || []);
      const nextProfile = profileResult.profile || null;
      setPublicProfile(nextProfile);
      setPublicProfileStatus(profileResult.migrationRequired ? "migration" : "ready");
      if (nextProfile) {
        setPublicHandleDraft(nextProfile.handle || "");
        setPublicNameDraft(nextProfile.displayName || "");
        setPublicBioDraft(nextProfile.bio || "");
      }
      setStatus("ready");
    } catch (error) {
      if (!isMounted()) return;
      setStatus("error");
      setPublicProfileStatus("error");
      setToast(error.message || "couldn't open your dump yet.");
    }
  }

  async function repairLoggedInSessionLink() {
    try {
      await linkCurrentDumpSession();
    } catch {
      // The following fetch will surface auth/migration errors in the normal page flow.
    }
  }
}

function roomLinkFor(slug) {
  const accessToken = getRoomAccessToken(slug);
  return `/r/${slug}/reads${accessToken ? `?key=${encodeURIComponent(accessToken)}` : ""}`;
}

function parseManualRoomInvite(value) {
  const raw = (value || "").trim();
  if (!raw) return { slug: "", accessToken: "" };

  try {
    const url = new URL(raw, "https://mumbl.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const roomIndex = parts.indexOf("r");
    const slug = roomIndex >= 0 ? parts[roomIndex + 1] || "" : parts[0] || "";
    return {
      slug: decodeURIComponent(slug),
      accessToken: url.searchParams.get("key") || url.searchParams.get("accessToken") || "",
    };
  } catch {
    const [slugPart, query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    return {
      slug: slugPart.replace(/^\/?r\//, "").replace(/\/reads$/, ""),
      accessToken: params.get("key") || params.get("accessToken") || "",
    };
  }
}

function appendSpeechTranscript(current, transcript) {
  const cleanTranscript = transcript.replace(/\s+/g, " ").trim();
  if (!cleanTranscript) return current;

  const needsSpace = current && !/\s$/.test(current);
  const nextText = `${current}${needsSpace ? " " : ""}${cleanTranscript}`;
  return nextText.slice(0, MAX_DUMP_CHARS);
}

function speechButtonLabel({ speechSupported, speechStatus }) {
  if (speechSupported === false || speechStatus === "unsupported") return "mic not available here";
  if (speechStatus === "listening") return "listening...";
  if (speechStatus === "stopping") return "catching that...";
  return "talk it out";
}

function speechErrorMessage(error) {
  if (error === "not-allowed" || error === "service-not-allowed") return "mic permission was blocked. typing still works.";
  if (error === "no-speech") return "didn't catch anything. try talking a little closer.";
  if (error === "audio-capture") return "couldn't find a mic on this device.";
  if (error === "network") return "speech service dropped. your typed dump is still safe.";
  return "voice stopped. typing still works.";
}

function DumpCard({ dump, expanded, setExpandedId, selected, toggleSelected, updateDump, deleteDump }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(dump.content);
  const [editReflection, setEditReflection] = useState(Boolean(dump.aiReflection));
  const [isMutating, setIsMutating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditContent(dump.content);
    setEditReflection(Boolean(dump.aiReflection));
  }, [dump.content, dump.aiReflection]);

  async function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed || isMutating) return;
    setIsMutating(true);
    try {
      await updateDump(dump, trimmed, editReflection);
      setIsEditing(false);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsMutating(true);
    try {
      await deleteDump(dump);
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <article className={`dump-card ${expanded ? "expanded" : ""} ${selected ? "selected" : ""}`}>
      <div className="dump-card-main">
        <button className="dump-card-open" type="button" onClick={() => setExpandedId(expanded ? "" : dump.id)}>
          <span className={`dump-pill ${dump.visibility}`}>{dump.visibility}</span>
          <strong>{firstLine(dump.content)}</strong>
          <span>{formatDumpDate(dump.createdAt)}</span>
        </button>
        <button className={`dump-select ${selected ? "active" : ""}`} type="button" onClick={toggleSelected}>
          {selected ? "selected" : "select"}
        </button>
      </div>
      {expanded && (
        <div className="dump-card-body">
          {isEditing ? (
            <>
              <textarea
                className="dump-edit-textarea"
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                maxLength={4000}
                disabled={isMutating}
              />
              <div className="dump-composer-bottom edit-bottom">
                <label className="reflection-toggle">
                  <input
                    type="checkbox"
                    checked={editReflection}
                    onChange={(event) => setEditReflection(event.target.checked)}
                    disabled={isMutating}
                  />
                  reflect on save
                </label>
                <span>{editContent.trim().length} chars</span>
              </div>
            </>
          ) : (
            <p>{dump.content}</p>
          )}
          {!isEditing && dump.aiReflection && (
            <div className="dump-reflection">
              <span>ai heard this</span>
              <p>{dump.aiReflection.replace(/^ai heard this:\s*/i, "")}</p>
            </div>
          )}
          <div className="dump-card-actions">
            {isEditing ? (
              <>
                <button className="solid-button button-with-loader" type="button" onClick={handleSaveEdit} disabled={isMutating}>
                  {isMutating && <span className="mini-loader" aria-hidden="true" />}
                  save edit
                </button>
                <button className="ghost-button" type="button" onClick={() => setIsEditing(false)} disabled={isMutating}>
                  cancel
                </button>
              </>
            ) : (
              <>
                <button className="ghost-button icon-action-button" type="button" onClick={() => setIsEditing(true)} aria-label="edit dump" title="edit dump">
                  <EditIcon />
                </button>
                <button
                  className={`ghost-button danger ${confirmDelete ? "" : "icon-action-button"}`}
                  type="button"
                  onClick={handleDelete}
                  disabled={isMutating}
                  aria-label="delete dump"
                  title="delete dump"
                >
                  {confirmDelete ? "delete forever" : <TrashIcon />}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function FieldNoteDrafts({
  fieldNotes,
  recentSlug,
  savedRooms,
  publishAnonymous,
  setPublishAnonymous,
  displayName,
  setDisplayName,
  publishingNoteId,
  mutatingNoteId,
  handlePublishFieldNote,
  handleUpdateFieldNote,
  handleDeleteFieldNote,
}) {
  return (
    <section className="field-note-drafts">
      <div className="field-note-drafts-header">
        <span>field notes</span>
        <p>Drafts and published notes live here. Team reads only sees published notes.</p>
      </div>
      {!fieldNotes.length && <div className="empty-state">no field notes yet. select a few dumps and draft one when a thread appears.</div>}
      {fieldNotes.map((fieldNote) => (
        <FieldNoteDraft
          fieldNote={fieldNote}
          key={fieldNote.id}
          recentSlug={recentSlug}
          savedRooms={savedRooms}
          publishAnonymous={publishAnonymous}
          setPublishAnonymous={setPublishAnonymous}
          displayName={displayName}
          setDisplayName={setDisplayName}
          publishingNoteId={publishingNoteId}
          mutatingNoteId={mutatingNoteId}
          handlePublishFieldNote={handlePublishFieldNote}
          handleUpdateFieldNote={handleUpdateFieldNote}
          handleDeleteFieldNote={handleDeleteFieldNote}
        />
      ))}
    </section>
  );
}

function FieldNoteDraft({
  fieldNote,
  recentSlug,
  savedRooms,
  publishAnonymous,
  setPublishAnonymous,
  displayName,
  setDisplayName,
  publishingNoteId,
  mutatingNoteId,
  handlePublishFieldNote,
  handleUpdateFieldNote,
  handleDeleteFieldNote,
}) {
  const [title, setTitle] = useState(fieldNote.title);
  const [noteContent, setNoteContent] = useState(fieldNote.content);
  const [isEditing, setIsEditing] = useState(!fieldNote.isPublished);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareSlug, setShareSlug] = useState("");
  const [manualInvite, setManualInvite] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const isPublished = fieldNote.isPublished;
  const isMutating = mutatingNoteId === fieldNote.id || publishingNoteId === fieldNote.id;

  useEffect(() => {
    setTitle(fieldNote.title);
    setNoteContent(fieldNote.content);
  }, [fieldNote.title, fieldNote.content]);

  useEffect(() => {
    if (fieldNote.isPublished) setIsEditing(false);
  }, [fieldNote.isPublished]);

  async function saveEdits() {
    const trimmedTitle = title.trim();
    const trimmedContent = noteContent.trim();
    if (!trimmedTitle || !trimmedContent || isMutating) return;
    await handleUpdateFieldNote(fieldNote, { title: trimmedTitle, content: trimmedContent });
    setIsEditing(false);
  }

  async function deleteNote() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await handleDeleteFieldNote(fieldNote);
  }

  return (
    <article className={`field-note-card ${isPublished ? "published" : ""}`}>
      <div className="field-note-card-top">
        <div className="field-note-pills">
          <span className={`dump-pill ${isPublished ? "team" : "private"}`}>{isPublished ? "published" : "draft"}</span>
          {fieldNote.isPublic && <span className="dump-pill public">public</span>}
        </div>
        <small>{fieldNote.sourceDumpIds.length} dump{fieldNote.sourceDumpIds.length === 1 ? "" : "s"}</small>
      </div>
      {isEditing ? (
        <>
          <label>
            title
            <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={isMutating} />
          </label>
          <label>
            field note
            <textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} disabled={isMutating} />
          </label>
        </>
      ) : (
        <div className="field-note-read">
          <h3>{fieldNote.title}</h3>
          <p>{fieldNote.content}</p>
        </div>
      )}
      {!isPublished && (
        <div className="dump-share-fields">
          {savedRooms.length ? (
            <label>
              publish to
              <select
                value={showManualInput ? "__manual__" : shareSlug}
                onChange={(event) => {
                  if (event.target.value === "__manual__") {
                    setShowManualInput(true);
                    setShareSlug("");
                  } else {
                    setShowManualInput(false);
                    setManualInvite("");
                    setShareSlug(event.target.value);
                  }
                }}
                disabled={isMutating}
              >
                <option value="">{recentSlug ? `recent: ${recentSlug}` : "choose a saved room"}</option>
                {savedRooms.map((room) => (
                  <option value={room.slug} key={room.id || room.slug}>
                    {room.name || room.slug}
                  </option>
                ))}
                <option value="__manual__">+ add by invite link</option>
              </select>
            </label>
          ) : null}
          {(!savedRooms.length || showManualInput) && (
            <label>
              invite link
              <input
                value={manualInvite}
                onChange={(event) => setManualInvite(event.target.value)}
                placeholder="/r/backend-team/reads?key=..."
                disabled={isMutating}
                autoFocus={showManualInput}
              />
            </label>
          )}
          <label className={`display-name-row ${publishAnonymous ? "hidden" : ""}`}>
            display handle
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. sam from infra"
              disabled={isMutating}
            />
          </label>
        </div>
      )}
      <div className="dump-actions field-note-actions">
        {isEditing ? (
          <>
            <button className="solid-button button-with-loader" type="button" onClick={saveEdits} disabled={isMutating}>
              {mutatingNoteId === fieldNote.id && <span className="mini-loader" aria-hidden="true" />}
              save note
            </button>
            <button className="ghost-button" type="button" onClick={() => setIsEditing(false)} disabled={isMutating}>
              cancel
            </button>
          </>
        ) : (
          <button
            className="ghost-button icon-action-button"
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={isMutating}
            aria-label="edit field note"
            title="edit field note"
          >
            <EditIcon />
          </button>
        )}
        {!isPublished && (
          <>
            <button
              className={`anon-toggle ${publishAnonymous ? "" : "off"}`}
              type="button"
              onClick={() => setPublishAnonymous(!publishAnonymous)}
              disabled={isMutating}
            >
              {publishAnonymous ? "anonymous on" : "posting with handle"}
            </button>
            <button
              className="solid-button button-with-loader"
              type="button"
              onClick={async () => {
                await handlePublishFieldNote(fieldNote, { title, content: noteContent }, manualInvite, shareSlug);
                setShareSlug("");
                setManualInvite("");
                setShowManualInput(false);
              }}
              disabled={isMutating}
            >
              {publishingNoteId === fieldNote.id && <span className="mini-loader" aria-hidden="true" />}
              publish to team reads
            </button>
          </>
        )}
        <button
          className={`ghost-button danger ${confirmDelete ? "" : "icon-action-button"}`}
          type="button"
          onClick={deleteNote}
          disabled={isMutating}
          aria-label={isPublished ? "remove field note" : "delete field note"}
          title={isPublished ? "remove field note" : "delete field note"}
        >
          {confirmDelete ? (isPublished ? "remove forever" : "delete forever") : <TrashIcon />}
        </button>
      </div>
    </article>
  );
}

function GoPublicModal({
  close,
  fieldNotes,
  publicProfile,
  publicProfileStatus,
  publicHandleDraft,
  publicNameDraft,
  publicBioDraft,
  publicMutatingNoteId,
  setPublicHandleDraft,
  setPublicNameDraft,
  setPublicBioDraft,
  handleSavePublicProfile,
  handleToggleFieldNotePublic,
}) {
  const publishedNotes = fieldNotes.filter((note) => note.isPublished);
  const publicCount = fieldNotes.filter((note) => note.isPublic).length;
  const profileDisabled = publicProfileStatus === "saving" || publicProfileStatus === "migration";

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal go-public-modal" role="dialog" aria-modal="true" aria-labelledby="go-public-title" onClick={(event) => event.stopPropagation()}>
        <div className="go-public-head">
          <div>
            <p className="eyebrow">go public</p>
            <h2 id="go-public-title">{publicProfile ? `@${publicProfile.handle}` : "claim a handle"}</h2>
            <p>
              {publicProfileStatus === "migration"
                ? "Public profiles need migration 0015 before this can save."
                : "Choose the field notes that belong on your public working-process shelf. Nothing is added by default."}
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={close}>
            close
          </button>
        </div>

        <form className="go-public-form" onSubmit={handleSavePublicProfile}>
          <div className="public-profile-fields">
            <label>
              handle
              <input
                value={publicHandleDraft}
                onChange={(event) => setPublicHandleDraft(event.target.value)}
                placeholder="disha"
                disabled={profileDisabled}
              />
            </label>
            <label>
              display name
              <input
                value={publicNameDraft}
                onChange={(event) => setPublicNameDraft(event.target.value)}
                placeholder="Disha"
                disabled={profileDisabled}
              />
            </label>
          </div>
          <label>
            bio
            <input
              value={publicBioDraft}
              onChange={(event) => setPublicBioDraft(event.target.value)}
              placeholder="building, debugging, learning in public"
              disabled={profileDisabled}
            />
          </label>
          <div className="public-profile-actions">
            <button className="solid-button button-with-loader" type="submit" disabled={profileDisabled}>
              {publicProfileStatus === "saving" && <span className="mini-loader" aria-hidden="true" />}
              {publicProfile ? "save handle" : "claim handle"}
            </button>
            {publicProfile && (
              <Link className="ghost-button button-link" href={`/@${publicProfile.handle}`} target="_blank" rel="noreferrer">
                view profile
              </Link>
            )}
            <small>{publicCount} public field note{publicCount === 1 ? "" : "s"}</small>
          </div>
        </form>

        <div className="go-public-picker">
          <div className="go-public-picker-head">
            <span>choose field notes</span>
            <small>{publishedNotes.length} published</small>
          </div>
          {!publishedNotes.length && (
            <div className="empty-state">publish a field note to team reads first. then you can choose it for your public profile.</div>
          )}
          {publishedNotes.map((note) => {
            const isMutating = publicMutatingNoteId === note.id;
            return (
              <label className={`public-note-option ${note.isPublic ? "selected" : ""}`} key={note.id}>
                <input
                  type="checkbox"
                  checked={note.isPublic}
                  onChange={(event) => handleToggleFieldNotePublic(note, event.target.checked)}
                  disabled={!publicProfile || isMutating}
                />
                <span>
                  <strong>{note.title}</strong>
                  <small>{note.isPublic ? "on your public profile" : "private to team reads"}</small>
                </span>
                {isMutating && <span className="mini-loader" aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DumpMap({ dumps, fieldNotes, map, status, toast, setToast }) {
  const [graphState, setGraphState] = useState({ status: "loading", graph: null, memory: null });
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [testToolsEnabled, setTestToolsEnabled] = useState(false);
  const [isTestingInsight, setIsTestingInsight] = useState(false);

  const loadGraph = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) {
        setGraphState((current) => ({ ...current, status: "loading" }));
      }
      const result = await fetchDumpMap();
      setGraphState({ status: "ready", graph: result.graph, memory: result.memory });
      setTestToolsEnabled(result.testToolsEnabled === true);
      return result;
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    async function loadMountedGraph() {
      try {
        const result = await fetchDumpMap();
        if (!mounted) return;
        setGraphState({ status: "ready", graph: result.graph, memory: result.memory });
        setTestToolsEnabled(result.testToolsEnabled === true);
      } catch (error) {
        if (!mounted) return;
        setGraphState({ status: "error", graph: null, memory: null });
        setToast(error.message || "couldn't build the graph yet.");
      }
    }
    loadMountedGraph();
    return () => {
      mounted = false;
    };
  }, [setToast]);

  async function handleTestGenerateInsight() {
    if (isTestingInsight) return;
    setIsTestingInsight(true);
    try {
      const result = await testGeneratePatternInsight();
      await loadGraph({ quiet: true });
      setToast(result.pattern ? "test insight generated. map refreshed." : result.message || "no insight generated yet.");
    } catch (error) {
      setToast(error.message || "couldn't generate a test insight.");
    } finally {
      setIsTestingInsight(false);
    }
  }

  const graph = graphState.graph || {
    nodes: [],
    edges: [],
    source: "local",
    syncedCount: 0,
    patterns: [],
    insights: [],
  };
  const evidenceNodes = graph.nodes.filter((node) => node.kind === "dump");
  const themes = graph.nodes.filter((node) => node.kind === "theme");
  const sourceName = "private dumps";
  const patterns = graph.patterns?.length
    ? graph.patterns
    : [
        {
          id: "pattern-local",
          title: themes[0] ? `${themes[0].label} keeps coming back` : "No repeat pattern yet",
          read: themes[0]?.detail || "There is not enough repeated material yet to say something useful without overreaching.",
          why: `${dumps.length} private dump${dumps.length === 1 ? "" : "s"} saved.`,
          nextStep: dumps.length > 2 ? "Draft the useful version, then decide if it belongs in Team Reads." : "Add a little more raw material before trusting the pattern.",
          fieldNoteSeed: themes[0] ? `What I am noticing about ${themes[0].label}` : "Nothing to draft yet.",
          privacy: "review before sharing",
          tone: "blue",
          evidenceIds: evidenceNodes.slice(0, 3).map((node) => node.id),
        },
      ];
  const selectedPattern = patterns.find((pattern) => pattern.id === selectedPatternId) || patterns[0] || null;
  const patternEvidence = evidenceNodes.filter((node) => selectedPattern?.evidenceIds?.includes(node.id)).slice(0, 4);
  const summary = graph.summary || {
    headline: themes[0] ? `${themes[0].label} keeps coming back` : "No strong pattern yet",
    detail: graphState.memory?.source === "pattern_graph" ? `Reading your ${sourceName} for repeat work patterns.` : map.summary,
    nextStep: dumps.length > 2 ? "Turn one useful thread into a field note when it is ready for the team." : "Add more raw material before trusting the read.",
  };
  const insights = graph.insights?.length
    ? graph.insights
    : [
        {
          label: "source",
          value: sourceName,
          detail: "Logged-in private dumps shape this map. Nothing gets posted.",
          tone: "blue",
        },
      ];
  const memoryStatus = graphState.memory || {};
  const sourceCount = dumps.length;
  const isGraphLoading = graphState.status === "loading";
  const statusLabel =
    isGraphLoading ? "checking memory" : memoryStatus.label || (memoryStatus.configured ? "memory ready" : "local only");
  const statusValue =
    isGraphLoading
      ? "checking..."
      : memoryStatus.status === "active"
        ? "private patterns ready"
        : memoryStatus.status === "unavailable"
          ? "local, lower confidence"
          : memoryStatus.status === "waiting"
            ? "waiting for sources"
            : "local read";
  const statusDetail = memoryStatus.syncError || memoryStatus.detail || "";

  useEffect(() => {
    if (!selectedPatternId && patterns[0]) {
      setSelectedPatternId(patterns[0].id);
    }
    if (selectedPatternId && !patterns.some((pattern) => pattern.id === selectedPatternId)) {
      setSelectedPatternId(patterns[0]?.id || "");
    }
  }, [patterns, selectedPatternId]);

  return (
    <section className="dump-view">
      <div className="dump-hero">
        <div>
          <p className="eyebrow">private patterns</p>
          <h1>your working map</h1>
          <p>See what keeps coming up, what it might mean, and which thread is worth turning into a team read.</p>
        </div>
        <div className="dump-nav">
          <Link className="ghost-button button-link" href="/patterns">
            patterns
          </Link>
          <Link className="ghost-button button-link" href="/dump">
            back to dump
          </Link>
        </div>
      </div>
      <div className="dump-map-panel">
        {status === "loading" ? <div className="empty-state">looking for patterns...</div> : null}
        {status !== "loading" && sourceCount < 1 ? (
          <div className="empty-state">write a logged-in private dump to start your working map.</div>
        ) : null}
        {status !== "loading" && sourceCount >= 1 && (
          <>
            <div className={`dump-graph-status ${memoryStatus.status || "local"}`}>
              <span>{statusLabel}</span>
              <strong>{statusValue}</strong>
              {testToolsEnabled && (
                <button className="ghost-button dump-map-test-button" type="button" onClick={handleTestGenerateInsight} disabled={isTestingInsight || isGraphLoading}>
                  {isTestingInsight ? "generating..." : "regenerate"}
                </button>
              )}
              {statusDetail && <p>{statusDetail}</p>}
            </div>

            {isGraphLoading ? (
              <div className="dump-map-loading">
                <strong>reading your {sourceName}...</strong>
                <p>Pattern reads stay private to your logged-in dump.</p>
              </div>
            ) : (
              <>
                <div className={`dump-map-summary ${selectedPattern?.tone || "blue"}`}>
                  <div className="dump-map-summary-copy">
                    <span>strongest read</span>
                    <strong>{summary.headline}</strong>
                    <p>{summary.detail}</p>
                  </div>
                  <div className="dump-map-next">
                    <span>next move</span>
                    <p>{summary.nextStep}</p>
                    <Link className="solid-button button-link" href="/dump">
                      draft a field note
                    </Link>
                  </div>
                </div>

                <div className="dump-insight-strip" aria-label="Map confidence">
                  {insights.slice(0, 3).map((insight) => (
                    <div className={`dump-insight ${insight.tone || "blue"}`} key={`${insight.label}-${insight.value}`}>
                      <span>{insight.label}</span>
                      <strong>{insight.value}</strong>
                      <p>{insight.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="dump-pattern-board">
                  <div className="dump-pattern-list" aria-label="Private pattern insights">
                    {patterns.map((pattern) => (
                      <button
                        className={`dump-pattern-card ${pattern.tone || "blue"} ${selectedPattern?.id === pattern.id ? "active" : ""}`}
                        key={pattern.id}
                        type="button"
                        onClick={() => setSelectedPatternId(pattern.id)}
                      >
                        <span>{pattern.privacy}</span>
                        <strong>{pattern.title}</strong>
                        <p>{pattern.nextStep}</p>
                      </button>
                    ))}
                  </div>

                  <article className={`dump-pattern-detail ${selectedPattern?.tone || "blue"}`}>
                    <span>selected read</span>
                    <h2>{selectedPattern?.title || "No pattern selected"}</h2>
                    <p>{selectedPattern?.read || "Pick a pattern to see the read."}</p>
                    <div className="dump-pattern-meta">
                      <div>
                        <small>why this matters</small>
                        <strong>{selectedPattern?.why || "Waiting for enough private material."}</strong>
                      </div>
                      <div>
                        <small>field note angle</small>
                        <strong>{selectedPattern?.fieldNoteSeed || "Nothing to publish yet."}</strong>
                      </div>
                    </div>
                    <div className="dump-pattern-evidence">
                      <small>private evidence</small>
                      {patternEvidence.length ? (
                        patternEvidence.map((dump) => (
                          <div className="dump-pattern-evidence-item" key={dump.id}>
                            <span>{formatDumpDate(dump.createdAt)}</span>
                            <strong>{dump.label}</strong>
                          </div>
                        ))
                      ) : (
                        <p>No connected evidence yet. Keep dumping and the graph will get a richer read.</p>
                      )}
                    </div>
                  </article>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </section>
  );
}

function makeDumpMap(dumps) {
  const buckets = [
    { label: "stuck threads", tone: "clay", words: ["stuck", "blocked", "waiting", "confused"] },
    { label: "process static", tone: "gold", words: ["meeting", "standup", "process", "planning"] },
    { label: "ship energy", tone: "mint", words: ["shipped", "fixed", "win", "done"] },
    { label: "heavy weather", tone: "violet", words: ["tired", "burn", "hard", "rough"] },
  ];
  const threads = buckets
    .map((bucket) => ({
      ...bucket,
      count: dumps.filter((dump) => bucket.words.some((word) => dump.content.toLowerCase().includes(word))).length,
    }))
    .filter((bucket) => bucket.count > 0);

  const top = threads.slice().sort((a, b) => b.count - a.count)[0];
  return {
    threads: threads.length ? threads : [{ label: "loose thoughts", tone: "blue", count: dumps.length }],
    summary: top
      ? `lately you've been dumping around ${top.label}. still private. still yours.`
      : "a few loose thoughts are down. the shape appears after you give it a little more material.",
  };
}

function firstLine(content) {
  return content.split(/\n/).find(Boolean)?.slice(0, 96) || "untitled dump";
}

function formatDumpDate(timestamp) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}
