"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { postTypes, validTabs, vibes } from "../lib/constants";
import { countReactions } from "../lib/heartbeat";
import { loadSession } from "../lib/storage";
import { useMumblStore } from "../hooks/useMumblStore";
import ComposeBox from "./space/ComposeBox";
import HeartbeatView from "./space/HeartbeatView";
import PostCard from "./space/PostCard";
import SharePanel from "./space/SharePanel";
import Toast from "./Toast";

export default function SpacePageClient({ slug, tab }) {
  const { state, submitPost, toggleReaction, dismissFirstPost } = useMumblStore();
  const [selectedType, setSelectedType] = useState("thought");
  const [composeAnonymous, setComposeAnonymous] = useState(true);
  const [toast, setToast] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    setSessionToken(loadSession());
  }, []);
  const space = state.spaces[slug];

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(message);
    } catch {
      setToast("copy did not work here. the link is still visible.");
    }
  }

  if (!space) {
    return (
      <section className="create-view">
        <div className="panel">
          <h2>couldn't find that mumbl.</h2>
          <p className="panel-copy">
            the link might have wandered off. make a fresh space and give the team somewhere better than silence.
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
                dismissFirstPost={dismissFirstPost}
                submitPost={({ content, displayName }) => {
                  submitPost({
                    slug: space.slug,
                    type: selectedType,
                    content,
                    displayName,
                    isAnonymous: composeAnonymous,
                  });
                  setToast("dropped. the room heard it.");
                }}
              />
              <PostList
                posts={posts}
                space={space}
                sessionToken={sessionToken}
                toggleReaction={toggleReaction}
              />
            </>
          )}

          {activeTab === "wins" && (
            <WinsView
              posts={wins}
              space={space}
              sessionToken={sessionToken}
              toggleReaction={toggleReaction}
            />
          )}

          {activeTab === "heartbeat" && <HeartbeatView space={space} />}
        </div>
        <aside className="side-panel">
          <SharePanel space={space} copyText={copyText} />
          <div className="note-card">
            <h3>for the team</h3>
            <p>the heartbeat is generated from anonymised posts and reactions. no manager cave, no separate dashboard.</p>
          </div>
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

function WinsView({ posts, space, sessionToken, toggleReaction }) {
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
      <PostList posts={posts} space={space} sessionToken={sessionToken} toggleReaction={toggleReaction} emptyText="no wins yet. rude of the week, honestly." />
    </>
  );
}

function PostList({ posts, space, sessionToken, toggleReaction, emptyText = "quiet room. dangerous. drop the first mumbl." }) {
  return (
    <div className="feed-list">
      {posts.length ? (
        posts.map((post) => (
          <PostCard
            post={post}
            space={space}
            sessionToken={sessionToken}
            toggleReaction={toggleReaction}
            key={post.id}
          />
        ))
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </div>
  );
}
