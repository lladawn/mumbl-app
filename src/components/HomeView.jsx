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

const familiarScenarios = [
  {
    title: "you read a PR and had no idea why",
    copy:
      "The code was fine. The reasoning, tradeoff, rejected option, and gut call were nowhere.",
  },
  {
    title: "you caught the rewrite risk before anyone wanted to say it",
    copy:
      "It was still being called polish work, but you could feel the shape of a bigger problem.",
  },
  {
    title: "someone left and took the system map with them",
    copy:
      "The onboarding doc had the commands. It did not have why the architecture bent that way.",
  },
];

const loopSteps = [
  {
    label: "01",
    title: "catch the thought in Slack",
    copy: "Use /mumbl or the message shortcut when the context appears. One rough line is enough.",
  },
  {
    label: "02",
    title: "shape it when it is ready",
    copy: "Turn the useful parts into something worth sharing once the reasoning is clear enough.",
  },
  {
    label: "03",
    title: "publish the context",
    copy: "Share it as a team read. The team gets the why, not just the shipped thing.",
  },
];

const memoryLayers = [
  {
    title: "the reason behind the PR",
    copy: "Not just what changed. Why the team chose it, what felt risky, and what someone noticed too early to prove.",
  },
  {
    title: "the judgment behind the work",
    copy: "The taste, tradeoffs, instincts, and hard-won lessons that usually stay in heads and DMs.",
  },
  {
    title: "the way your team thinks over time",
    copy: "A private record of original thinking your team can return to when people join, leave, or forget.",
  },
];

const demoRoomPosts = [
  {
    author: "maya",
    team: "staff eng",
    label: "rewrite",
    title: "i kept calling it a polish issue. it was a rewrite i was avoiding.",
    copy: "three weeks of almost done and i finally just said it in /mumbl. writing it down was when i saw it clearly.",
  },
  {
    author: "arjun",
    team: "tech lead",
    label: "decision",
    title: "why we chose boring queues over the clever thing",
    copy: "the clever version looked better in the design doc. the boring version fails in ways we know how to repair.",
  },
  {
    author: "nina",
    team: "backend",
    label: "incident",
    title: "the deploy was fine. the handoff was not.",
    copy: "nothing broke, but three people had to reconstruct the same context. next time the note should exist before the merge.",
  },
  {
    author: "leo",
    team: "eng lead",
    label: "lesson",
    title: "what i wish i'd written down before the last sprint",
    copy: "the context that would have saved us two days. it lived in my head. now it doesn't have to.",
  },
];

const objections = [
  {
    question: "do we actually need another tool?",
    answer:
      "probably not if your team already knows each other's reasoning, taste, and hard-won lessons. most remote engineering teams don't. they know each other's output. mumbl is for that gap.",
  },
  {
    question: "do I have to write a lot?",
    answer:
      "no. one rough line is the whole point. you're catching a thought, not writing a doc. the habit works because it's near zero effort, and putting even one sentence into words is where thinking gets sharper.",
  },
  {
    question: "what do I actually get back?",
    answer:
      "your own thinking over time: how you reasoned, what you sensed early, how you've grown. the realest data you have is how you actually think, and until now it had nowhere to go.",
  },
  {
    question: "what happens to a thought after I dump it?",
    answer:
      "your call. keep it private forever, or turn the useful part into a team read when it's ready. nothing leaves your hands until you decide it should.",
  },
  {
    question: "can my thinking become something more, like a digital twin?",
    answer:
      "that's where this is heading, and it's your choice. your thinking stays yours and nothing is trained on it without your explicit consent. if you want to build something from how you actually think, that's a door you open, never a default.",
  },
  {
    question: "isn't this just journaling?",
    answer:
      "kind of, and that's the point. but the bar to write is near zero, it starts as one line from Slack instead of a blank page, and it is private by default so people think honestly instead of performing.",
  },
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
        <section className="hero landing-hero direct-landing-hero">
          <div className="hero-copy landing-hero-copy">
            <p className="eyebrow">slack app for teams - beta</p>
            <h1>save the why behind your team's work — one line from Slack.</h1>
            <p>
              Hit /mumbl in Slack to capture a thought the moment it happens, then publish the ones worth
              sharing as a team read. It is your team's internal record: about the people behind the work,
              not just the product they ship.
            </p>
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
                  <small>private first team reads</small>
                </span>
                <em>beta</em>
              </a>
              <a className="ghost-button button-link" href="#team-reads" onClick={() => trackPublicCta("team_reads_anchor", { source: "hero" })}>
                see examples
              </a>
              <a className="ghost-button button-link" href={calendlyHref} target="_blank" rel="noreferrer" onClick={() => trackPublicCta("calendly_outbound", { source: "hero" })}>
                talk it through
              </a>
            </div>
            <p className="slack-beta-copy">no channel history. mumbl only saves what you explicitly send it.</p>
            <div className="landing-proof-strip" aria-label="mumbl promises">
              <span>private by default</span>
              <span>shared by choice</span>
              <span>no channel history</span>
            </div>
          </div>
        </section>

        <section id="team-reads" className="landing-section team-reads-showcase" aria-labelledby="team-reads-heading">
          <p className="eyebrow">what team reads look like</p>
          <h2 id="team-reads-heading">read the reasoning, not just the result.</h2>
          <div className="team-read-list">
            {demoRoomPosts.map((post) => (
              <article className="team-read-example" key={post.title}>
                <div>
                  <span>{post.author}</span>
                  <span>{post.team}</span>
                  <em>{post.label}</em>
                </div>
                <h3>{post.title}</h3>
                <p>{post.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-dump" aria-labelledby="dump-heading">
          <div className="landing-section-head">
            <p className="eyebrow">what mumbl does</p>
            <h2 id="dump-heading">save engineering context before it turns into archaeology.</h2>
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

        <section className="landing-section familiar-section" aria-labelledby="familiar-heading">
          <div className="landing-section-head">
            <p className="eyebrow">sounds familiar?</p>
            <h2 id="familiar-heading">mumbl is for the moments senior engineers keep having.</h2>
          </div>
          <div className="familiar-list">
            {familiarScenarios.map((scenario) => (
              <article className="familiar-card" key={scenario.title}>
                <h3>{scenario.title}</h3>
                <p>{scenario.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section human-layer-section" aria-labelledby="human-layer-heading">
          <div className="human-layer-copy">
            <p className="eyebrow">why it matters</p>
            <h2 id="human-layer-heading">the human layer of work starts with the context people already have.</h2>
            <p>
              Mumbl is not trying to replace docs, tickets, or Slack. It catches the original thinking before it
              disappears, then turns the parts worth keeping into team reads.
            </p>
          </div>
          <div className="human-layer-list">
            {memoryLayers.map((layer) => (
              <article className="human-layer-card" key={layer.title}>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
              </article>
            ))}
          </div>
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
            <p className="eyebrow">honest questions</p>
            <h2 id="faq-heading">before your team tries mumbl.</h2>
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
            <h2 id="cta-heading">give your team a place to think out loud.</h2>
            <p>Private by default. Shared by choice. Installs in 30 seconds.</p>
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
            <form id="waitlist" className="waitlist-form compact" onSubmit={handleWaitlistSubmit} noValidate>
              <label htmlFor="waitlist-email">waitlist email</label>
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
                  {waitlistStatus === "submitting" ? "joining..." : "join"}
                </button>
              </div>
              {waitlistMessage ? (
                <p className={`waitlist-message ${waitlistStatus === "success" ? "success" : "error"}`} role="status">
                  {waitlistMessage}
                </p>
              ) : null}
            </form>
            <Link className="ghost-button button-link" href="/vision" onClick={() => trackPublicCta("vision", { source: "bottom_cta" })}>
              read the vision
            </Link>
            <a className="ghost-button button-link" href={calendlyHref} target="_blank" rel="noreferrer" onClick={() => trackPublicCta("calendly_outbound", { source: "bottom_cta" })}>
              book a call
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
            <p>team memory that is actually human.</p>
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
