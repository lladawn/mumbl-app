"use client";

import Link from "next/link";
import { useState } from "react";
import { postTypes, validTabs, vibes } from "../lib/constants";
import { countReactions } from "../lib/heartbeat";
import { useRemoteSpace } from "../hooks/useRemoteSpace";
import ComposeBox from "./space/ComposeBox";
import HeartbeatView from "./space/HeartbeatView";
import LoadingMark from "./LoadingMark";
import PostCard from "./space/PostCard";
import SharePanel from "./space/SharePanel";
import PublicSpacePanel from "./space/PublicSpacePanel";
import Toast from "./Toast";

export default function SpacePageClient({ slug, tab }) {
  const { space, status, error, submitPost, toggleReaction, dismissFirstPost, updateVisibility } = useRemoteSpace(slug);
  const [selectedType, setSelectedType] = useState("thought");
  const [composeAnonymous, setComposeAnonymous] = useState(true);
  const [toast, setToast] = useState("");

  async function copyText(text, message) {
    try {
      await copyToClipboard(text);
      setToast(message);
    } catch {
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

  const activeTab = validTabs.includes(tab) ? tab : "feed";
  const posts = [...space.posts].sort((a, b) => b.createdAt - a.createdAt);
  const wins = posts.filter((post) => post.type === "win");

  return (
    <section className="space-view">
      <div className="space-header">
        <div className="space-title">
          <h1>{space.name}</h1>
          <p>
            {space.memberCount} in here · {vibes[space.vibe].label} · anonymous · always
          </p>
          {space.isPublic && <span className="public-badge">contributing to mumbl explore</span>}
        </div>
        <div className="pips" aria-label="member avatars">
          {["?", "r", "k", "j", "+"].map((pip) => (
            <span className="pip" key={pip}>
              {pip}
            </span>
          ))}
        </div>
      </div>

      <div className="space-grid">
        <div className="space-main">
          <div className="tab-row" role="tablist" aria-label="space tabs">
            <TabLink slug={space.slug} tab="feed" activeTab={activeTab}>
              feed · {posts.length}
            </TabLink>
            <TabLink slug={space.slug} tab="wins" activeTab={activeTab}>
              wins · {wins.length}
            </TabLink>
            <TabLink slug={space.slug} tab="heartbeat" activeTab={activeTab}>
              heartbeat
            </TabLink>
          </div>

          {activeTab === "feed" && (
            <>
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
                    setToast("share link unlocked.");
                  } catch (dismissError) {
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
                    setToast("dropped. the room heard it.");
                  } catch (submitError) {
                    setToast(submitError.message || "couldn't post that yet.");
                    throw submitError;
                  }
                }}
              />
              <PostList posts={posts} space={space} toggleReaction={toggleReactionWithToast(toggleReaction, setToast)} />
            </>
          )}

          {activeTab === "wins" && (
            <WinsView posts={wins} space={space} toggleReaction={toggleReactionWithToast(toggleReaction, setToast)} />
          )}

          {activeTab === "heartbeat" && <HeartbeatView space={space} />}
        </div>
        <aside className="side-panel">
          <SharePanel space={space} copyText={copyText} />
          <div className="note-card">
            <h3>for the team</h3>
            <p>the heartbeat is generated from anonymised posts and reactions. no manager cave, no separate dashboard.</p>
          </div>
          <PublicSpacePanel space={space} updateVisibility={updateVisibility} onToast={setToast} />
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

function WinsView({ posts, space, toggleReaction }) {
  const reactionCount = space.posts.reduce((sum, post) => sum + countReactions(post), 0);
  const namedPosters = new Set(space.posts.map((post) => (post.isAnonymous ? "anon" : post.displayName)).filter(Boolean));

  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <strong>{posts.length}</strong>
          <span>wins this week</span>
        </div>
        <div className="stat-card">
          <strong>{namedPosters.size}</strong>
          <span>members posted</span>
        </div>
        <div className="stat-card">
          <strong>{reactionCount}</strong>
          <span>reactions given</span>
        </div>
      </div>
      <PostList posts={posts} space={space} toggleReaction={toggleReaction} emptyText="no wins yet. rude of the week, honestly." />
    </>
  );
}

function PostList({ posts, space, toggleReaction, emptyText = "quiet room. dangerous. drop the first mumbl." }) {
  return (
    <div className="feed-list">
      {posts.length ? (
        posts.map((post) => <PostCard post={post} space={space} toggleReaction={toggleReaction} key={post.id} />)
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </div>
  );
}

function toggleReactionWithToast(toggleReaction, setToast) {
  return async (input) => {
    try {
      await toggleReaction(input);
    } catch (error) {
      setToast(error.message || "reaction bounced. annoying, but fixable.");
    }
  };
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
