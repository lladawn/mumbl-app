"use client";

import Link from "next/link";
import { useState } from "react";
import { joinWaitlist } from "../lib/api";
import { trackConversionEvent, trackDemoEntry, trackPublicCta } from "../lib/analytics";

// The agent-collaborator pitch. The demo at /demo is the conversion driver here,
// not the form — the form is a research channel. See the build brief §6.
//
// The pixel art below reuses the demo's sprite geometry (14x20 person) and its
// palette, so the landing and /demo read as one world rather than two designs.

const LOOKS = {
  scout:   { hair: "#3B2A1E", skin: "#D9A277", shirt: "#2F6B63", pants: "#2A2E33", glow: "#7FD4C6" },
  scribe:  { hair: "#5A3418", skin: "#EBC49A", shirt: "#C8873F", pants: "#33302B", glow: "#F3C98B" },
  // dusty rose — §7 lists it in the palette and nothing else on the page uses it
  courier: { hair: "#4A2C1A", skin: "#EBC49A", shirt: "#C98A84", pants: "#2E2A33", glow: "#E8B5AF" },
  builder: { hair: "#1E1B18", skin: "#8C5F3C", shirt: "#3E5F8A", pants: "#242830", glow: "#8FB6E8" },
  human:   { hair: "#2B211A", skin: "#C98B5E", shirt: "#F0E2C8", pants: "#2A2E33", glow: null },
};

// one pixel person on a 14x20 integer grid — identical proportions to the demo
function Person({ look, ai = false }) {
  return (
    <>
      {ai && look.glow ? <rect x="1" y="0" width="12" height="20" fill={look.glow} opacity="0.22" /> : null}
      <rect x="4" y="1" width="6" height="3" fill={look.hair} />
      <rect x="3" y="2" width="8" height="4" fill={look.hair} />
      <rect x="4" y="4" width="6" height="4" fill={look.skin} />
      <rect x="4" y="3" width="6" height="1" fill={look.hair} />
      <rect x="5" y="6" width="1" height="1" fill="#14201F" />
      <rect x="8" y="6" width="1" height="1" fill="#14201F" />
      <rect x="3" y="8" width="8" height="7" fill={look.shirt} />
      <rect x="2" y="9" width="1" height="5" fill={look.shirt} />
      <rect x="11" y="9" width="1" height="5" fill={look.shirt} />
      <rect x="2" y="13" width="1" height="2" fill={look.skin} />
      <rect x="11" y="13" width="1" height="2" fill={look.skin} />
      <rect x="4" y="15" width="2" height="4" fill={look.pants} />
      <rect x="8" y="15" width="2" height="4" fill={look.pants} />
      <rect x="3" y="19" width="3" height="1" fill="#2A1D12" />
      <rect x="8" y="19" width="3" height="1" fill="#2A1D12" />
    </>
  );
}

// a standalone sprite for the beat cards
function AgentSprite({ look, ai = true, className = "" }) {
  return (
    <svg className={`px-agent ${className}`} viewBox="0 0 14 20" aria-hidden="true">
      <Person look={look} ai={ai} />
    </svg>
  );
}

function Window({ x }) {
  return (
    <>
      <rect x={x} y="2" width="28" height="13" fill="#0F2624" />
      <rect x={x + 2} y="4" width="24" height="9" fill="#E8B979" />
      <rect x={x + 2} y="4" width="24" height="4" fill="#F2D4A2" />
      <rect x={x + 13} y="2" width="1" height="13" fill="#0F2624" />
      <rect x={x} y="8" width="28" height="1" fill="#0F2624" />
    </>
  );
}

function Workstation({ cx, look, ai, bobClass }) {
  return (
    <>
      {/* monitor */}
      <rect x={cx - 9} y="20" width="18" height="11" fill="#14201F" />
      <rect x={cx - 7} y="22" width="14" height="7" fill="#2E4A46" />
      <rect x={cx - 6} y="23" width="8" height="1" fill="#6FA88A" opacity="0.7" />
      <rect x={cx - 6} y="25" width="5" height="1" fill="#9FD4C4" opacity="0.45" />
      {/* desk */}
      <rect x={cx - 16} y="31" width="32" height="3" fill="#A5713F" />
      <rect x={cx - 16} y="34" width="32" height="5" fill="#8A5E38" />
      {/* Collaborator. The positioning transform and the bob animation must live
          on separate <g> elements: a CSS transform overrides the SVG transform
          attribute, so animating the positioned node snaps it to the origin. */}
      <g transform={`translate(${cx - 7} 39)`}>
        <g className={bobClass}>
          <Person look={look} ai={ai} />
        </g>
      </g>
    </>
  );
}

// A frame of the demo: warm room, agents at stations, light from the windows.
function WorkspaceScene() {
  return (
    <div className="hero-scene" aria-label="a pixel workspace: two AI collaborators and a teammate at their stations">
      <svg className="hero-scene-art" viewBox="0 0 132 60" role="img" aria-hidden="true">
        {/* wall */}
        <rect x="0" y="0" width="132" height="18" fill="#1B3B38" />
        <rect x="0" y="16" width="132" height="2" fill="#0F2624" />
        <Window x={14} />
        <Window x={90} />

        {/* floor */}
        <rect x="0" y="18" width="132" height="42" fill="#6B4A2F" />
        {[18, 24, 30, 36, 42, 48, 54].map((y) => (
          <rect key={y} x="0" y={y} width="132" height="3" fill="#63432A" opacity="0.55" />
        ))}

        {/* golden-hour light falling from the windows */}
        <polygon points="16,18 40,18 52,60 2,60" fill="#F2D4A2" opacity="0.06" />
        <polygon points="92,18 116,18 128,60 78,60" fill="#F2D4A2" opacity="0.06" />

        <Workstation cx={24} look={LOOKS.scout} ai bobClass="px-bob px-bob-a" />
        <Workstation cx={66} look={LOOKS.human} ai={false} bobClass="px-bob px-bob-b" />
        <Workstation cx={108} look={LOOKS.builder} ai bobClass="px-bob px-bob-c" />

        {/* plant, for the lived-in feel §7 asks for */}
        <rect x="124" y="44" width="6" height="5" fill="#6B4A2F" />
        <rect x="123" y="38" width="8" height="6" fill="#3E6B4A" />
        <rect x="125" y="35" width="4" height="3" fill="#4C7F58" />
      </svg>

      <span className="hero-pill hero-pill-working">working</span>
      <span className="hero-pill hero-pill-blocked">blocked</span>
      <span className="hero-pill hero-pill-done">done</span>
    </div>
  );
}

const beats = [
  {
    id: "see",
    title: "agents you can see",
    copy: "every agent is a character at a workstation. working, blocked, done — legible at a glance, without opening anything.",
    look: LOOKS.scout,
  },
  {
    id: "ask",
    title: "ask, and a collaborator arrives",
    copy: "say what you need help with. a new collaborator walks in, takes a free desk, and starts on it.",
    look: LOOKS.courier,
  },
  {
    id: "shared",
    title: "your team and your agents in one place",
    copy: "agent work stops being buried in one person's terminal and becomes something the room can see.",
    look: LOOKS.scribe,
  },
];

const teamSizes = ["just me", "2–10", "11–50", "51–200", "200+"];

export default function AgentLandingView() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [agentTools, setAgentTools] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();

    setMessage("");
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      trackConversionEvent("waitlist_submit_failed", { reason: trimmed ? "invalid" : "empty" });
      setStatus("error");
      setMessage("drop in a real email and we'll save your spot.");
      return;
    }

    setStatus("submitting");
    try {
      await joinWaitlist({ email: trimmed, company, teamSize, agentTools, source: "agent_landing" });
      trackConversionEvent("waitlist_submitted", { source: "agent_landing" });
      setEmail("");
      setCompany("");
      setTeamSize("");
      setAgentTools("");
      setStatus("success");
      setMessage("you're in. we'll show you the next build before anyone else.");
    } catch (error) {
      trackConversionEvent("waitlist_submit_failed", { reason: "api" });
      setStatus("error");
      setMessage(error.message || "couldn't join the waitlist yet. try again in a minute.");
    }
  }

  return (
    <section className="agent-landing pixel-screen">
      <header className="agent-hero">
        <div className="agent-hero-copy">
          <p className="eyebrow">mumbl — early build</p>
          <h1>agent work still feels like a terminal.</h1>
          <p className="agent-hero-lede">
            Most people use a code editor instead — same power, legible surface. Mumbl is a workspace where
            your AI agents are collaborators you can see.
          </p>
          <div className="agent-hero-actions">
            <a
              className="px-button button-link agent-primary-cta"
              href="/demo"
              onClick={() => {
                trackDemoEntry("agent_landing_hero");
                trackPublicCta("demo", { source: "hero" });
              }}
            >
              open the demo →
            </a>
            <a className="text-link" href="#waitlist">or join the waitlist</a>
          </div>
          <p className="agent-hero-hint">
            walkable, no signup. type <b>&ldquo;I need help with competitor research&rdquo;</b> and watch what happens.
          </p>
          <p className="agent-hero-note">
            A prototype: the interface is real, the agents are scripted. Nothing is connected to your tools yet.
          </p>
        </div>

        <WorkspaceScene />
      </header>

      <section className="agent-beats" aria-label="what mumbl does">
        {beats.map((beat) => (
          <article className={`agent-beat agent-beat-${beat.id}`} key={beat.id}>
            <AgentSprite look={beat.look} />
            <h2>{beat.title}</h2>
            <p>{beat.copy}</p>
          </article>
        ))}
      </section>

      <section className="agent-argument" aria-labelledby="argument-heading">
        <p className="eyebrow">the whole argument</p>
        <h2 id="argument-heading">the same work, two surfaces.</h2>
        <p>
          A terminal shows you a wall of scrolling text that only one person is reading. The same agents,
          rendered as a room, tell you who is stuck and who is finished without you reading a single line.
          Press <b>T</b> inside the demo to flip between them.
        </p>
        <a
          className="px-button button-link"
          href="/demo"
          onClick={() => {
            trackDemoEntry("agent_landing_argument");
            trackPublicCta("demo", { source: "argument" });
          }}
        >
          see it flip →
        </a>
      </section>

      <section className="agent-waitlist" id="waitlist" aria-labelledby="waitlist-heading">
        <div>
          <p className="eyebrow">early access</p>
          <h2 id="waitlist-heading">tell us what your agents do.</h2>
          <p>
            We&apos;re picking the first real integration based on what teams actually run. The third question
            is the one that decides it.
          </p>
          <div className="agent-waitlist-art" aria-hidden="true">
            <AgentSprite look={LOOKS.scout} />
            <AgentSprite look={LOOKS.courier} />
            <AgentSprite look={LOOKS.builder} />
            <AgentSprite look={LOOKS.human} ai={false} />
          </div>
        </div>

        <form className="agent-waitlist-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="agent-email">email</label>
          <input
            id="agent-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== "submitting") { setStatus("idle"); setMessage(""); }
            }}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={status === "submitting"}
          />

          <label htmlFor="agent-company">company</label>
          <input
            id="agent-company"
            type="text"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="where you work"
            autoComplete="organization"
            disabled={status === "submitting"}
          />

          <label htmlFor="agent-team-size">team size</label>
          <select
            id="agent-team-size"
            value={teamSize}
            onChange={(event) => setTeamSize(event.target.value)}
            disabled={status === "submitting"}
          >
            <option value="">pick one</option>
            {teamSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>

          <label htmlFor="agent-tools">which AI agents or tools does your team use today?</label>
          <textarea
            id="agent-tools"
            value={agentTools}
            onChange={(event) => setAgentTools(event.target.value)}
            placeholder="claude code, cursor, a pile of cron jobs, nothing yet…"
            rows={3}
            disabled={status === "submitting"}
          />

          <button className="px-button" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "saving…" : "save my spot"}
          </button>

          {message ? (
            <p className={`waitlist-message ${status === "success" ? "success" : "error"}`} role="status">
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <footer className="agent-footer">
        <p>mumbl is also a place for the human layer of work — the part no ticket captures.</p>
        <div>
          <Link href="/slack">mumbl for slack</Link>
        </div>
      </footer>
    </section>
  );
}
