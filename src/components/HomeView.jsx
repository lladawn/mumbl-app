"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { joinWaitlist } from "../lib/api";
import { publicDemoRoom } from "../lib/constants";
import JoinModal from "./JoinModal";

const contactEmail = "mumbl.wtf@gmail.com";
const teamNeedsMailHref = `mailto:${contactEmail}?subject=What%20my%20team%20needs`;
const calendlyHref = "https://calendly.com/lladawn";

const disappearingSignals = [
  "the wrong turns before the fix",
  "the judgment before the decision",
  "the emotion before burnout",
  "the quiet signal before someone checks out",
];

const loopSteps = [
  {
    label: "1. quick dump",
    title: "say the messy thought before it disappears.",
    copy: "type it or speak it. one line is enough. it stays private.",
  },
  {
    label: "2. field note",
    title: "shape what becomes useful.",
    copy: "select the rough notes that matter, make them readable, then decide where they belong.",
  },
  {
    label: "3. team read",
    title: "share team memory by choice.",
    copy: "coworkers see the path, tradeoffs, taste, and human context behind the work.",
  },
];

const demoRoomPosts = [
  {
    label: "field note",
    title: "auth fix: the three wrong turns",
    copy: "the timeout bug was easy once we stopped blaming oauth. useful path, saved.",
    meta: "useful · 12",
  },
  {
    label: "team read",
    title: "why this sprint felt heavy",
    copy: "not code volume. fuzzy ownership. next time: one owner before kickoff.",
    meta: "i felt this · 9",
  },
];

const objections = [
  {
    question: "what would someone actually dump?",
    answer:
      "the thought before it becomes polished: why a fix was harder than expected, what felt unclear, the tradeoff behind a decision, or the lesson you do not want the next person to relearn.",
  },
  {
    question: "why not just write this in slack?",
    answer:
      "slack is for the conversation happening now. mumbl is for the useful trail after the moment passes. a quick dump can stay private, become a field note, or turn into a team read when it is worth keeping.",
  },
  {
    question: "is this more documentation work?",
    answer:
      "mumbl starts smaller than a doc. say or type the messy version first, then clean up only the part that became useful.",
  },
  {
    question: "who sees my private dumps?",
    answer:
      "only you. private dumps do not become team memory unless you choose to shape and share them.",
  },
  {
    question: "who is mumbl for?",
    answer:
      "the team. mumbl gives engineers a place to keep the rough thinking behind the work: private first, shared only when useful. the heartbeat and reads go back to everyone who lived the week.",
  },
  {
    question: "will engineers actually write this?",
    answer:
      "they might save a rough thought in ten seconds, especially if it starts private and can be spoken instead of formatted. the polished lesson can come later, if there is one.",
  },
];

const memoryStripItems = [
  "private by default",
  "the path before the polished doc",
  "good writing gets a second life",
  "team lore becomes findable",
  "know the human behind the feature",
  "work feels better when people feel less hidden",
  "read how your coworkers actually think",
  "the internal feed between tickets and shipped features",
  "a living feed of the work behind the work",
  "write it while it is still messy",
  "slack is where work talks. mumbl is where work remembers.",
];

export default function HomeView() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState("idle");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const recentSlug = useRecentSlug();

  async function handleWaitlistSubmit(event) {
    event.preventDefault();
    const email = waitlistEmail.trim();

    setWaitlistMessage("");
    if (!email) {
      setWaitlistStatus("error");
      setWaitlistMessage("drop your email in first.");
      return;
    }
    if (!isValidEmail(email)) {
      setWaitlistStatus("error");
      setWaitlistMessage("drop in a real email and we'll save your spot.");
      return;
    }

    setWaitlistStatus("submitting");
    try {
      await joinWaitlist({ email });
      setWaitlistEmail("");
      setWaitlistStatus("success");
      setWaitlistMessage("you're on it. we'll keep it useful.");
    } catch (error) {
      setWaitlistStatus("error");
      setWaitlistMessage(error.message || "couldn't join the waitlist yet. try again in a minute.");
    }
  }

  return (
    <>
      <div className="home-view">
        <section className="hero landing-hero">
          <div className="hero-copy landing-hero-copy">
            <p className="eyebrow">private memory for the messy middle</p>
            <h1>your team remembers what shipped. mumbl remembers how it happened.</h1>
            <p>
              mumbl keeps the rough notes, wrong turns, and lessons that never make it into tickets or docs.
            </p>
            <form id="waitlist" className="waitlist-form" onSubmit={handleWaitlistSubmit} noValidate>
              <div>
                <label htmlFor="waitlist-email">join the waitlist</label>
                <p>we'll send the useful bits when mumbl is ready for more engineering teams.</p>
              </div>
              <div className="waitlist-controls">
                <input
                  id="waitlist-email"
                  type="email"
                  value={waitlistEmail}
                  onChange={(event) => {
                    setWaitlistEmail(event.target.value);
                    if (waitlistStatus !== "submitting") {
                      setWaitlistStatus("idle");
                      setWaitlistMessage("");
                    }
                  }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={waitlistStatus === "submitting"}
                />
                <button className="solid-button" type="submit" disabled={waitlistStatus === "submitting"}>
                  {waitlistStatus === "submitting" ? "joining..." : "join waitlist"}
                </button>
              </div>
              {waitlistMessage ? (
                <p className={`waitlist-message ${waitlistStatus === "success" ? "success" : "error"}`} role="status">
                  {waitlistMessage}
                </p>
              ) : null}
            </form>
            <div className="hero-actions">
              <Link className="ghost-button button-link" href={publicDemoRoom.href}>
                try the demo
              </Link>
              <button className="ghost-button" type="button" onClick={() => setJoinOpen(true)}>
                already have a link?
              </button>
            </div>
            <div className="landing-proof-strip" aria-label="mumbl promises">
              <span>private first</span>
              <span>shared by choice</span>
              <span>team memory that compounds</span>
            </div>
          </div>

          <div className="team-space-demo" aria-label="example mumbl team space">
            <div className="team-space-topbar">
              <div>
                <span className="demo-dot" aria-hidden="true" />
                <strong>platform room</strong>
              </div>
              <span>private by default</span>
            </div>
            <div className="mumbl-room-tabs" aria-label="example mumbl room tabs">
              <span className="active">quick dump</span>
              <span>field notes</span>
              <span>team reads</span>
              <span>heartbeat</span>
            </div>
            <div className="mumbl-room-surface">
              <section className="quick-dump-composer" aria-label="example quick dump composer">
                <div className="quick-dump-head">
                  <span>private dump</span>
                  <strong>say it before it disappears</strong>
                </div>
                <div className="voice-dump-row">
                  <span className="voice-button" aria-hidden="true">mic</span>
                  <div className="voice-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>voice-to-text or typed. messy is fine.</p>
                </div>
                <div className="composer-actions">
                  <span>still private</span>
                  <button className="ghost-button" type="button">shape into note</button>
                </div>
              </section>

              <section className="room-feed-preview" aria-label="example team reads">
                {demoRoomPosts.map((post) => (
                  <article className="room-read-card" key={post.title}>
                    <span>{post.label}</span>
                    <h3>{post.title}</h3>
                    <p>{post.copy}</p>
                    <em>{post.meta}</em>
                  </article>
                ))}
              </section>

              <aside className="room-memory-rail" aria-label="example room memory">
                <span>room memory</span>
                <strong>wrong turns, ownership lessons, and one useful fix path.</strong>
                <p>shared by choice, useful when the team needs the trail.</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="landing-section problem-section" aria-labelledby="problem-heading">
          <div>
            <p className="eyebrow">the gap</p>
            <h2 id="problem-heading">the human middle of work disappears.</h2>
            <p>
              slack keeps messages. docs keep decisions. tickets keep tasks. mumbl keeps the human path between them.
            </p>
          </div>
          <div className="signal-grid" aria-label="what disappears at work">
            {disappearingSignals.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="landing-section landing-dump" aria-labelledby="dump-heading">
          <div className="landing-section-head">
            <p className="eyebrow">the loop</p>
            <h2 id="dump-heading">say it fast. clean it up later. share only if it helps.</h2>
            <p>quick dumps can be typed or spoken. mumbl starts private, then sharing is deliberate.</p>
          </div>
          <div className="dump-layer-grid">
            {loopSteps.map((layer) => (
              <article className="dump-layer-card" key={layer.label}>
                <span>{layer.label}</span>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="memory-strip" aria-label="what mumbl remembers">
          <div className="memory-strip-track" aria-hidden="true">
            {[...memoryStripItems, ...memoryStripItems].map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
          <p className="sr-only">{memoryStripItems.join(". ")}</p>
        </section>

        <section className="landing-section demo-video-section" aria-labelledby="demo-video-heading">
          <div className="demo-video-copy">
            <p className="eyebrow">watch the loop</p>
            <h2 id="demo-video-heading">watch a quick dump become a team read in under a minute.</h2>
            <p>voice or type the thought, shape the useful part, and share only what helps the team understand the work.</p>
          </div>
          <div className="demo-video-frame">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src="https://www.youtube-nocookie.com/embed/cX6XQVzDXr8"
              title="mumbl product demo"
            />
          </div>
        </section>

        <section className="landing-section faq-section" aria-labelledby="faq-heading">
          <div>
            <p className="eyebrow">clear lines</p>
            <h2 id="faq-heading">honest questions before a team tries mumbl.</h2>
          </div>
          <div className="faq-list">
            {objections.map((item, index) => (
              <details className="faq-card" key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-section landing-cta" aria-labelledby="cta-heading">
          <div>
            <p className="eyebrow">early teams</p>
            <h2 id="cta-heading">help shape mumbl for real engineering teams.</h2>
            <p>join the waitlist for quick voice dumps, field notes, and team memory.</p>
          </div>
          <div className="cta-panel">
            <a className="solid-button button-link" href="#waitlist">
              join the waitlist
            </a>
            <Link className="ghost-button button-link" href="/create">
              create a room
            </Link>
            <Link className="ghost-button button-link" href={publicDemoRoom.href}>
              try the demo
            </Link>
            <a className="ghost-button button-link" href={teamNeedsMailHref}>
              tell us what your team needs
            </a>
          </div>
        </section>

        <footer className="landing-footer">
          <div>
            <Link className="brand" href="/" aria-label="go to mumbl home">
              <span className="brand-mark" aria-hidden="true">
                m
              </span>
              <span>mumbl</span>
            </Link>
            <p>private dumps become team reads, so the work between docs and shipped features does not disappear.</p>
          </div>
          <nav aria-label="mumbl footer links">
            <a href="https://twitter.com/lla_dawn" rel="noreferrer" target="_blank">
              twitter @lla_dawn
            </a>
            <a href={teamNeedsMailHref}>mumbl.wtf@gmail.com</a>
            <a href={calendlyHref} rel="noreferrer" target="_blank">
              book a call
            </a>
          </nav>
        </footer>
      </div>

      {joinOpen && (
        <JoinModal
          recentSlug={recentSlug}
          close={() => setJoinOpen(false)}
          navigate={(path) => router.push(path)}
        />
      )}
    </>
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function MiniPost({ avatar, text, reactions, tint = false }) {
  return (
    <div className={`mini-post ${text ? "with-copy" : ""}`}>
      <span className="avatar">{avatar}</span>
      {text ? (
        <span className="mini-copy">
          <strong>{text}</strong>
          <em>{reactions}</em>
        </span>
      ) : (
        <span className="mini-lines">
          <span className={`line ${tint ? "tint" : ""}`} />
          <span className="line" />
          <span className="line short" />
        </span>
      )}
    </div>
  );
}
