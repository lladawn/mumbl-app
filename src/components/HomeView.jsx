"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { joinWaitlist } from "../lib/api";
import { trackConversionEvent, trackPublicCta } from "../lib/analytics";
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
    label: "private dump",
    title: "i keep saying it just needs polish...",
    copy: "but i think i am actually avoiding a rewrite.",
    meta: "only you",
  },
  {
    label: "team read",
    title: "naming the rewrite earlier",
    copy: "the drag was not polish. it was the cost of softening a hard truth until it became rework.",
    meta: "quietly true · 9",
  },
];

const objections = [
  {
    question: "why would i use this if we already have slack?",
    answer:
      "slack is where work talks in public. mumbl is where the thought can land privately first, before it becomes a polished point, a team read, or nothing at all.",
  },
  {
    question: "what is mumbl really for?",
    answer:
      "for the thoughts with signal inside them: the thing you keep almost saying, the concern you are not ready to make political, the lesson behind a weird week, the pattern you only notice after writing it down.",
  },
  {
    question: "do we actually need another tool?",
    answer:
      "maybe not if your team already remembers the human context behind work. most teams remember tickets and decisions, but lose the judgment, doubt, pressure, taste, and repair work in between.",
  },
  {
    question: "is this more documentation work?",
    answer:
      "no. a mumbl can start as one honest line in slack. the useful ones can become field notes later; the rest can stay private.",
  },
  {
    question: "does mumbl read our slack channels?",
    answer:
      "no. mumbl only saves what someone explicitly sends with /mumbl or the message shortcut. no channel history, no passive reading.",
  },
  {
    question: "who sees my private dumps?",
    answer:
      "only you. a dump becomes a team read only if you shape it into a field note and publish it.",
  },
  {
    question: "what becomes a team read?",
    answer:
      "a field note someone explicitly publishes. it can be anonymous or use a chosen mumbl handle. slack identity is never the author label.",
  },
  {
    question: "what is the heartbeat based on?",
    answer:
      "published team reads only. not private dumps, not slack history, not who joined, not who lurked.",
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
  "the team reads between tickets and shipped features",
  "a living memory of the work behind the work",
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
      trackConversionEvent("waitlist_submit_failed", { reason: "empty" });
      setWaitlistStatus("error");
      setWaitlistMessage("drop your email in first.");
      return;
    }
    if (!isValidEmail(email)) {
      trackConversionEvent("waitlist_submit_failed", { reason: "invalid" });
      setWaitlistStatus("error");
      setWaitlistMessage("drop in a real email and we'll save your spot.");
      return;
    }

    setWaitlistStatus("submitting");
    try {
      await joinWaitlist({ email });
      trackConversionEvent("waitlist_submitted", { source: "landing" });
      setWaitlistEmail("");
      setWaitlistStatus("success");
      setWaitlistMessage("you're on it. we'll keep it useful.");
    } catch (error) {
      trackConversionEvent("waitlist_submit_failed", { reason: "api" });
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
            <h1>mumbl remembers how work happened.</h1>
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
              <a
                className="slack-install-button"
                href="/api/slack/install"
                target="_blank"
                rel="noreferrer"
                onClick={() => trackPublicCta("slack_install", { source: "hero" })}
                aria-label="add mumbl to slack"
              >
                <SlackLogo className="slack-logo" />
                <span>
                  add to slack
                  <small>private dumps + team reads</small>
                </span>
                <em>beta</em>
              </a>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  trackPublicCta("join_existing_room", { source: "hero" });
                  setJoinOpen(true);
                }}
              >
                already have a link?
              </button>
            </div>
            <p className="slack-beta-copy">slack beta: save private dumps and publish team reads by choice. no channel history.</p>
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
                <strong>tiny fires crew in slack</strong>
              </div>
              <span>/mumbl</span>
            </div>
            <div className="mumbl-room-tabs" aria-label="example mumbl room tabs">
              <span className="active">private dump</span>
              <span>field note</span>
              <span>team read</span>
              <span>pattern</span>
            </div>
            <div className="mumbl-room-surface">
              <section className="slack-composer-demo" aria-label="example slack private dump">
                <div className="slack-channel-head">
                  <span># tiny-fires</span>
                  <em>any channel or dm</em>
                </div>
                <div className="slack-message-row">
                  <span className="slack-avatar" aria-hidden="true">you</span>
                  <p>the thought shows up mid-conversation. you do not need to make it public.</p>
                </div>
                <div className="slack-input-shell">
                  <span>/mumbl</span>
                  <strong>i keep saying "just needs polish," but i think i'm avoiding a rewrite.</strong>
                  <button type="button">send</button>
                </div>
                <div className="slack-ephemeral-card">
                  <span>only visible to you</span>
                  <strong>saved privately to mumbl</strong>
                  <p>keep the honest version now. shape it into a field note later if it can help the team.</p>
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
                <span>private pattern</span>
                <strong>softening hard truths before they become rework.</strong>
                <p>visible to you first. publish only when it can help the team.</p>
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

        {/*
          Hidden until the new Slack-native demo is ready. The old web-flow video
          made the landing page feel less current than the Slack beta story.
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
        */}

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
            <h2 id="cta-heading">try the slack-native loop with your team.</h2>
            <p>save private thoughts from slack, shape the useful ones, and publish team reads by choice.</p>
          </div>
          <div className="cta-panel">
            <a
              className="solid-button button-link"
              href="/api/slack/install"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackPublicCta("slack_install", { source: "bottom_cta" })}
            >
              <SlackLogo className="slack-logo cta-slack-logo" />
              add to slack
            </a>
            <a className="ghost-button button-link" href="#waitlist" onClick={() => trackPublicCta("waitlist_anchor", { source: "bottom_cta" })}>
              join the waitlist
            </a>
            <a className="ghost-button button-link" href={teamNeedsMailHref} onClick={() => trackPublicCta("email_team_needs", { source: "bottom_cta" })}>
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
            <a href="https://twitter.com/lla_dawn" rel="noreferrer" target="_blank" onClick={() => trackPublicCta("twitter_outbound", { source: "footer" })}>
              twitter @lla_dawn
            </a>
            <a href={teamNeedsMailHref} onClick={() => trackPublicCta("email_outbound", { source: "footer" })}>mumbl.wtf@gmail.com</a>
            <Link href="/privacy" onClick={() => trackPublicCta("privacy", { source: "footer" })}>
              privacy
            </Link>
            <a href={calendlyHref} rel="noreferrer" target="_blank" onClick={() => trackPublicCta("calendly_outbound", { source: "footer" })}>
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

function SlackLogo({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 122.8 122.8" aria-hidden="true" focusable="false">
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zM32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zM45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zM90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zM77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
        fill="#ECB22E"
      />
    </svg>
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
