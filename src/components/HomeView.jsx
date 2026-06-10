"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRecentSlug } from "../hooks/useRecentSlug";
import { joinWaitlist } from "../lib/api";
import { feedbackRoom, publicDemoRoom } from "../lib/constants";
import JoinModal from "./JoinModal";

const contactEmail = "mumbl.wtf@gmail.com";
const teamNeedsMailHref = `mailto:${contactEmail}?subject=What%20my%20team%20needs`;
const calendlyHref = "https://calendly.com/lladawn";

const dumpLayers = [
  {
    label: "private dump",
    title: "write the messy middle while it is still happening.",
    copy: "one sentence, five paragraphs, a debugging trail, the thing you did not say in standup.",
  },
  {
    label: "field notes",
    title: "turn the useful thread into something teammates can learn from.",
    copy: "not a design doc. not a status update. the actual working process.",
  },
  {
    label: "team reads",
    title: "build an internal feed of how people actually work.",
    copy: "the in-between: tradeoffs, rough days, taste, judgment, and tiny lessons. a read can become a public profile note only if the writer chooses.",
  },
];

const adoptionSteps = [
  {
    time: "day 1",
    title: "someone starts dumping privately",
    copy: "no rollout. no training. just the thought they already had, saved somewhere it can become useful later.",
  },
  {
    time: "week 1",
    title: "a useful field note appears",
    copy: "a debugging path, a rough sprint lesson, a decision trail. the team reads the process, not just the outcome.",
  },
  {
    time: "week 4",
    title: "the room has memory",
    copy: "patterns start showing up. people feel less alone. the team has human context that Slack never held.",
  },
];

const teamSpacePosts = [
  {
    label: "anonymous engineer",
    type: "debugging read",
    text: "debugged auth for two days. here is the path and the tiny fix.",
    meta: "useful · 12",
  },
  {
    label: "anonymous engineer",
    type: "sprint read",
    text: "this sprint was not heavy because of code. it was unclear ownership.",
    meta: "i felt this · 9",
  },
  {
    label: "anonymous engineer",
    type: "people read",
    text: "remote work got quiet. we need fewer meetings and more honest async context.",
    meta: "same here · 6",
  },
];

const objections = [
  {
    question: "how is mumbl different from docs, tickets, or Slack?",
    answer:
      "docs keep decisions. tickets keep tasks. Slack keeps messages. mumbl keeps the messy middle: the rough thinking, debugging trails, tradeoffs, and human context behind the feature.",
  },
  {
    question: "why would people write here?",
    answer:
      "because the first step is private. people can dump while the thought is still rough, then share only the part that becomes useful for the room.",
  },
  {
    question: "will anonymous writing create chaos?",
    answer:
      "private dumps stay private. team reads are deliberate. the room measures resonance, not people, and there is no manager analytics view.",
  },
  {
    question: "what does mumbl give a team?",
    answer:
      "an internal feed of how work actually happened: the dead ends, taste, context, small wins, and human patterns that usually disappear between docs and shipped features.",
  },
];

const collabPaths = [
  "engineering teams willing to test Mumbl internally",
  "founders and managers who want culture without surveillance",
  "operators who can help with distribution into real teams",
  "builders/designers who care about making work feel human",
];

const memoryStripItems = [
  "private by default",
  "the path before the polished doc",
  "good writing should not get buried in tickets",
  "the team lore should not live in DMs",
  "know the human behind the feature",
  "work feels better when people feel less hidden",
  "read how your coworkers actually think",
  "the internal feed between tickets and shipped features",
  "a living feed of the work behind the work",
  "write it while it is still messy",
  "Slack is where work talks. mumbl is where work remembers.",
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
            <p className="eyebrow">the working-memory layer for teams</p>
            <h1>turn messy engineering work into team memory.</h1>
            <p>
              engineers dump privately, share field notes by choice, and build a feed of how work actually happened.
            </p>
            <div className="hero-actions">
              <Link className="solid-button button-link" href="/dump">
                start your dump
              </Link>
              <Link className="solid-button button-link" href="/create">
                create a room
              </Link>
              <Link className="ghost-button button-link" href={publicDemoRoom.href}>
                try the demo room
              </Link>
              <button className="ghost-button" type="button" onClick={() => setJoinOpen(true)}>
                already have a link?
              </button>
            </div>
            <form className="waitlist-form" onSubmit={handleWaitlistSubmit} noValidate>
              <div>
                <label htmlFor="waitlist-email">join the waitlist</label>
                <p>we'll send the useful bits when mumbl is ready for more teams.</p>
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
            <div className="landing-proof-strip" aria-label="mumbl promises">
              <span>dump first, share later</span>
              <span>built for the in-between</span>
              <span>team memory, not analytics</span>
            </div>
          </div>

          <div className="team-space-demo" aria-label="example mumbl team space">
            <div className="team-space-topbar">
              <div>
                <span className="demo-dot" aria-hidden="true" />
                <strong>backend gremlins</strong>
              </div>
              <span>anonymous room</span>
            </div>
            <div className="team-space-tabs" aria-label="example room views">
              <span className="active">team reads</span>
              <span>private dumps</span>
              <span>heartbeats</span>
            </div>
            <div className="team-space-body">
              <div className="team-feed-preview">
                {teamSpacePosts.map((post) => (
                  <article className="team-feed-post" key={post.text}>
                    <div className="team-post-meta">
                      <span>{post.label}</span>
                      <em>{post.type}</em>
                    </div>
                    <p>{post.text}</p>
                    <div className="team-post-footer">
                      <span>{post.meta}</span>
                      <span>anonymous reply</span>
                    </div>
                  </article>
                ))}
              </div>
              <aside className="team-demo-rail" aria-label="example private dump and heartbeat">
                <div className="private-dump-card">
                  <span>private dump</span>
                  <strong>
                    i found the timeout fix, but the weird part was three wrong guesses before it.
                  </strong>
                  <p>still private. later, the useful trail can become a team read.</p>
                </div>
                <div className="heartbeat-preview">
                  <span>room heartbeat</span>
                  <strong>debugging trails, fuzzy ownership, and one tiny win everyone nearly missed.</strong>
                </div>
              </aside>
            </div>
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
            <p className="eyebrow">watch the product</p>
            <h2 id="demo-video-heading">see how a private dump becomes something a team can read.</h2>
            <p>
              watch the actual flow: write privately, shape the useful part, and share it into a room without turning it
              into a status update.
            </p>
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

        <section className="landing-section landing-dump" aria-labelledby="dump-heading">
          <div className="landing-section-head">
            <p className="eyebrow">the loop</p>
            <h2 id="dump-heading">start private. share when it becomes useful.</h2>
            <p>docs remember decisions. Slack remembers messages. mumbl remembers how the work actually happened.</p>
          </div>
          <div className="dump-layer-grid">
            {dumpLayers.map((layer) => (
              <article className="dump-layer-card" key={layer.label}>
                <span>{layer.label}</span>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section adoption-strip" aria-labelledby="adoption-heading">
          <div className="landing-section-head">
            <p className="eyebrow">how adoption actually starts</p>
            <h2 id="adoption-heading">not a company initiative. a tiny personal habit that becomes useful.</h2>
            <p>built for engineering teams where the real context is getting lost.</p>
          </div>
          <div className="adoption-steps">
            {adoptionSteps.map((step) => (
              <article className="adoption-step" key={step.time}>
                <span>{step.time}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section faq-section" aria-labelledby="faq-heading">
          <div>
            <p className="eyebrow">fair doubts</p>
            <h2 id="faq-heading">questions teams ask before trying mumbl.</h2>
          </div>
          <div className="faq-list">
            {objections.map((item) => (
              <article className="faq-card" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section collab-section" aria-labelledby="collab-heading">
          <div>
            <p className="eyebrow">early collaborators</p>
            <h2 id="collab-heading">we are looking for the people who feel this problem before it has a category.</h2>
          </div>
          <div className="collab-list">
            {collabPaths.map((path) => (
              <span key={path}>{path}</span>
            ))}
          </div>
        </section>

        <section className="landing-section landing-talk" aria-labelledby="talk-heading">
          <div className="landing-talk-copy">
            <p className="eyebrow">talk to us</p>
            <h2 id="talk-heading">want to tell us what your team needs?</h2>
            <p>
              bring us the rough workflow, the team moment, or the custom setup you wish existed. we can talk it through
              async or on a call.
            </p>
          </div>
          <div className="talk-options">
            <a
              className="talk-card"
              href={calendlyHref}
              rel="noreferrer"
              target="_blank"
            >
              <span>book a call</span>
              <strong>for pilots, custom company setup, or a deeper culture conversation.</strong>
              <em>schedule time</em>
            </a>
            <a className="talk-card" href={teamNeedsMailHref}>
              <span>email us</span>
              <strong>send the team context, company setup question, or moment mumbl should exist for.</strong>
              <em>{contactEmail}</em>
            </a>
            <Link className="talk-card" href={feedbackRoom.href} rel="noreferrer" target="_blank">
              <span>share a note</span>
              <strong>drop feedback in the public mumbl room and help shape the product.</strong>
              <em>open room</em>
            </Link>
          </div>
        </section>

        <section className="landing-section landing-cta" aria-labelledby="cta-heading">
          <div>
            <p className="eyebrow">start small</p>
            <h2 id="cta-heading">start with the thought already sitting in your head.</h2>
            <p>
              start with your own dump, create a private space for your team, or tell us the missing context your team
              keeps losing.
            </p>
          </div>
          <div className="cta-panel">
            <Link className="solid-button button-link" href="/dump">
              start your dump
            </Link>
            <Link className="solid-button button-link" href="/create">
              create a room
            </Link>
            <Link className="ghost-button button-link" href={publicDemoRoom.href}>
              try the demo room
            </Link>
            <Link className="ghost-button button-link" href={feedbackRoom.href}>
              shape mumbl with us
            </Link>
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
