"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trackEvent } from "../lib/analytics";
import { postTypes, validTabs, vibes } from "../lib/constants";
import { getCreatorToken, getPostEditToken } from "../lib/storage";
import { useRemoteSpace } from "../hooks/useRemoteSpace";
import ComposeBox from "./space/ComposeBox";
import HeartbeatView from "./space/HeartbeatView";
import LoadingMark from "./LoadingMark";
import PostCard from "./space/PostCard";
import SharePanel from "./space/SharePanel";
import PublicSpacePanel from "./space/PublicSpacePanel";
import RoomDescriptionPanel from "./space/RoomDescriptionPanel";
import RoomVibeBar from "./space/RoomVibeBar";
import SideQuestsPanel from "./space/SideQuestsPanel";
import SlackTeamReadsPanel from "./space/SlackTeamReadsPanel";
import Toast from "./Toast";

export default function SpacePageClient({ slug, tab }) {
  const router = useRouter();
  const activeTab = validTabs.includes(tab) ? tab : "reads";
  const postTypeFilter = activeTab === "wins" ? "win" : activeTab === "reads" ? "reads" : "";
  const {
    space,
    status,
    pageStatus,
    error,
    submitPost,
    toggleReaction,
    updatePost,
    deletePost,
    loadOlderPosts,
    dismissFirstPost,
    updateVisibility,
    updateDescription,
    startTeamReadsSlackSetup,
    pinTeamReadsSlackSpace,
    updateTeamReadsSlackPosting,
    deleteSpace,
  } = useRemoteSpace(slug, postTypeFilter);
  const [selectedType, setSelectedType] = useState("thought");
  const [composeAnonymous, setComposeAnonymous] = useState(true);
  const [hasCreatorToken, setHasCreatorToken] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setHasCreatorToken(Boolean(getCreatorToken(slug)) || space?.canManage === true);
  }, [slug, space?.canManage]);

  async function copyText(text, message, target = "copy") {
    try {
      await copyToClipboard(text);
      trackEvent("share_copied", { target });
      setToast(message);
    } catch {
      trackEvent("share_copy_failed", { target });
      setToast("copy did not work here. the link is still visible.");
    }
  }

  if (status === "loading" && !space) {
    return (
      <section className="create-view">
        <div className="panel loading-panel" aria-live="polite" aria-busy="true">
          <LoadingMark />
          <h2>checking the room.</h2>
          <p className="panel-copy">pulling the latest mumbl from the backend.</p>
        </div>
      </section>
    );
  }

  if (!space) {
    return (
      <section className="create-view">
        <div className="panel">
          <h2>{status === "not-found" ? "couldn't find that mumbl." : "backend is being difficult."}</h2>
          <p className="panel-copy">
            {status === "not-found"
              ? "the link might have wandered off. make a fresh space and give the team somewhere better than silence."
              : error || "try again after the Supabase setup is finished."}
          </p>
          <Link className="solid-button button-link" href="/create">
            create space
          </Link>
        </div>
      </section>
    );
  }

  if (status === "loading" && (space.postsPage?.type || "") !== postTypeFilter) {
    return (
      <section className="create-view">
        <div className="panel loading-panel" aria-live="polite" aria-busy="true">
          <LoadingMark />
          <h2>pulling that slice.</h2>
          <p className="panel-copy">keeping the room light while the older mumbls stay close.</p>
        </div>
      </section>
    );
  }

  const posts = [...space.posts].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="space-view">
      <div className="space-header">
        <div className="space-title">
          <h1>{space.name}</h1>
          <p>{vibes[space.vibe].label} · created {formatCreatedDate(space.createdAt)}</p>
          {space.description && <p className={`space-description vibe-${space.vibe}`}>{space.description}</p>}
          {space.isPublic && <span className="public-badge">contributing to mumbl explore</span>}
        </div>
      </div>

      <div className="space-grid">
        <div className="space-main">
          <div className="tab-row" role="tablist" aria-label="space tabs">
            <TabLink slug={space.slug} tab="reads" activeTab={activeTab}>
              reads
            </TabLink>
            <TabLink slug={space.slug} tab="heartbeat" activeTab={activeTab}>
              heartbeat
            </TabLink>
          </div>
          <a className="side-quest-mobile-link" href="#side-quests">
            <span>side quests</span>
            <small>tiny anonymous room with someone here</small>
          </a>

          {activeTab === "feed" && (
            <>
              <RoomVibeBar labels={space.roomVibe} />
              <ComposeBox
                space={space}
                postTypes={postTypes}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                composeAnonymous={composeAnonymous}
                setComposeAnonymous={setComposeAnonymous}
                dismissFirstPost={async () => {
                  try {
                    await dismissFirstPost();
                    trackEvent("first_post_prompt_dismissed");
                    setToast("share link unlocked.");
                  } catch (dismissError) {
                    trackEvent("first_post_prompt_dismiss_failed");
                    setToast(dismissError.message || "couldn't dismiss that prompt.");
                  }
                }}
                submitPost={async ({ content, displayName }) => {
                  try {
                    await submitPost({
                      type: selectedType,
                      content,
                      displayName,
                      isAnonymous: composeAnonymous,
                    });
                    trackEvent("post_created", { type: selectedType, anonymous: composeAnonymous, vibe: space.vibe });
                    setToast("dropped. the room heard it.");
                  } catch (submitError) {
                    trackEvent("post_create_failed", { type: selectedType, anonymous: composeAnonymous, vibe: space.vibe });
                    setToast(submitError.message || "couldn't post that yet.");
                    throw submitError;
                  }
                }}
              />
              <PostList
                posts={posts}
                space={space}
                toggleReaction={toggleReactionWithToast(toggleReaction, setToast)}
                updatePost={updatePostWithToast(updatePost, setToast)}
                deletePost={deletePostWithToast(deletePost, setToast)}
                loadOlderPosts={loadOlderPosts}
                pageStatus={pageStatus}
                canManage={hasCreatorToken}
              />
            </>
          )}

          {activeTab === "wins" && (
            <WinsView
              posts={posts}
              space={space}
              toggleReaction={toggleReactionWithToast(toggleReaction, setToast)}
              updatePost={updatePostWithToast(updatePost, setToast)}
              deletePost={deletePostWithToast(deletePost, setToast)}
              loadOlderPosts={loadOlderPosts}
              pageStatus={pageStatus}
              canManage={hasCreatorToken}
            />
          )}

          {activeTab === "reads" && (
            <ReadsView
              posts={posts}
              space={space}
              loadOlderPosts={loadOlderPosts}
              pageStatus={pageStatus}
              deletePost={deletePostWithToast(deletePost, setToast)}
              canManage={hasCreatorToken}
              startSetup={startTeamReadsSlackSetup}
              onToast={setToast}
            />
          )}

          {activeTab === "heartbeat" && <HeartbeatView space={space} />}
        </div>
        <aside className="side-panel">
          <SideQuestsPanel space={space} onToast={setToast} />
          <SharePanel space={space} copyText={copyText} />
          <div className="note-card">
            <h3>for the team</h3>
            <p>the heartbeat is generated from anonymised posts and reactions. no manager cave, no separate dashboard.</p>
          </div>
          {hasCreatorToken && <RoomDescriptionPanel space={space} updateDescription={updateDescription} onToast={setToast} />}
          {hasCreatorToken && (
            <SlackTeamReadsPanel
              space={space}
              startSetup={startTeamReadsSlackSetup}
              pinSpace={pinTeamReadsSlackSpace}
              updatePosting={updateTeamReadsSlackPosting}
              onToast={setToast}
            />
          )}
          {hasCreatorToken && <PublicSpacePanel space={space} updateVisibility={updateVisibility} onToast={setToast} />}
          {hasCreatorToken && (
            <SpaceDangerZonePanel
              space={space}
              deleteSpace={async () => {
                await deleteSpace();
                trackEvent("space_deleted");
                router.push("/dump?spaceDeleted=1");
              }}
              onToast={setToast}
            />
          )}
        </aside>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </section>
  );
}

function TabLink({ slug, tab, activeTab, children }) {
  return (
    <Link className={`tab-button button-link ${tab === activeTab ? "active" : ""}`} href={`/r/${slug}/${tab}`}>
      {children}
    </Link>
  );
}

function WinsView({ posts, space, toggleReaction, updatePost, deletePost, loadOlderPosts, pageStatus, canManage }) {
  return (
    <PostList
      posts={posts}
      space={space}
      toggleReaction={toggleReaction}
      updatePost={updatePost}
      deletePost={deletePost}
      loadOlderPosts={loadOlderPosts}
      pageStatus={pageStatus}
      canManage={canManage}
      emptyText="no wins yet. rude of the week, honestly."
    />
  );
}

function ReadsView({ posts, space, loadOlderPosts, pageStatus, deletePost, canManage, startSetup, onToast }) {
  return (
    <>
      <div className="reads-intro">
        <span>team reads</span>
        <p>Published field notes from private dumps and Slack drafts. Nothing lands here until someone chooses to publish it.</p>
        <div className="reads-intro-actions">
          <Link className="solid-button button-link" href="/dump">
            open your dump
          </Link>
          {canManage && !posts.length && !space.slackTeamReads && <SlackReadsSetupButton startSetup={startSetup} onToast={onToast} />}
        </div>
      </div>
      <PostList
        posts={posts}
        space={space}
        toggleReaction={async () => {}}
        deletePost={deletePost}
        loadOlderPosts={loadOlderPosts}
        pageStatus={pageStatus}
        emptyText="no team reads yet. save private dumps in Slack or Mumbl, draft the useful thread, then publish when it is ready."
        showReactions={false}
        canManage={canManage}
      />
    </>
  );
}

function SlackReadsSetupButton({ startSetup, onToast }) {
  const [isStarting, setIsStarting] = useState(false);

  async function handleClick() {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const result = await startSetup();
      trackEvent("slack_team_reads_setup_started", { source: "reads_empty_state" });
      window.location.href = result.installUrl;
    } catch (error) {
      trackEvent("slack_team_reads_setup_failed", { source: "reads_empty_state" });
      onToast(error.message || "couldn't start the Slack team reads upgrade.");
      setIsStarting(false);
    }
  }

  return (
    <button className="ghost-button button-with-loader" type="button" onClick={handleClick} disabled={isStarting}>
      {isStarting && <span className="mini-loader" aria-hidden="true" />}
      {isStarting ? "opening Slack..." : "create Slack reads channel"}
    </button>
  );
}

function formatCreatedDate(timestamp) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function PostList({
  posts,
  space,
  toggleReaction,
  updatePost,
  deletePost,
  loadOlderPosts,
  pageStatus,
  emptyText = "quiet room. dangerous. drop the first mumbl.",
  showReactions = true,
  canManage = false,
}) {
  const page = space.postsPage || {};
  const hasMore = Boolean(page.hasMore);
  const loadedCount = posts.length;
  const totalCount = page.count || loadedCount;

  return (
    <div className="feed-list">
      {posts.length ? (
        posts.map((post) => (
          <PostCard
            post={post}
            space={space}
            toggleReaction={toggleReaction}
            updatePost={updatePost}
            deletePost={deletePost}
            showReactions={showReactions}
            canManage={canManage}
            canAuthorEdit={post.canAuthorEdit === true || (post.localEditTokenAllowed === true && Boolean(getPostEditToken(post.id)))}
            key={post.id}
          />
        ))
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
      {posts.length ? (
        <div className="feed-pagination" aria-live="polite">
          <span>
            showing {loadedCount} of {totalCount} mumbl{totalCount === 1 ? "" : "s"}
          </span>
          {hasMore ? (
            <button
              className="ghost-button"
              type="button"
              onClick={loadOlderPosts}
              disabled={pageStatus === "loading"}
              aria-busy={pageStatus === "loading"}
            >
              {pageStatus === "loading" ? "loading older..." : "load older"}
            </button>
          ) : (
            <span className="feed-end">you hit the basement</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function toggleReactionWithToast(toggleReaction, setToast) {
  return async (input) => {
    try {
      await toggleReaction(input);
      trackEvent("reaction_toggled", { label: input.label });
    } catch (error) {
      trackEvent("reaction_toggle_failed", { label: input.label });
      setToast(error.message || "reaction bounced. annoying, but fixable.");
      throw error;
    }
  };
}

function updatePostWithToast(updatePost, setToast) {
  return async (input) => {
    try {
      await updatePost(input);
      setToast("mumbl updated.");
    } catch (error) {
      setToast(error.message || "couldn't update that mumbl.");
      throw error;
    }
  };
}

function deletePostWithToast(deletePost, setToast) {
  return async (input) => {
    try {
      await deletePost(input);
      setToast("mumbl removed.");
    } catch (error) {
      setToast(error.message || "couldn't delete that mumbl.");
      throw error;
    }
  };
}

function SpaceDangerZonePanel({ space, deleteSpace, onToast }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = confirming && confirmText.trim() === space.slug;

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (!canDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteSpace();
    } catch (error) {
      onToast(error.message || "couldn't delete this space.");
      setIsDeleting(false);
    }
  }

  return (
    <section className="panel danger-zone-panel" aria-busy={isDeleting}>
      <div>
        <h3>danger zone</h3>
        <p className="panel-copy">
          Delete this room, its feed, reactions, side quests, heartbeats, and Slack room links. Published field notes stay in the author's dump, unlinked from this room.
        </p>
      </div>
      {confirming && (
        <label>
          type the room slug
          <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={space.slug} disabled={isDeleting} />
        </label>
      )}
      <div className="danger-zone-actions">
        {confirming && (
          <button className="ghost-button" type="button" onClick={() => setConfirming(false)} disabled={isDeleting}>
            cancel
          </button>
        )}
        <button className="ghost-button danger button-with-loader" type="button" onClick={handleDelete} disabled={isDeleting || (confirming && !canDelete)}>
          {isDeleting && <span className="mini-loader" aria-hidden="true" />}
          {confirming ? "delete room forever" : "delete this room"}
        </button>
      </div>
    </section>
  );
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some embedded browsers expose the Clipboard API but still deny writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("copy failed");
  }
}
