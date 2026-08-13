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

// Same character system as /demo: build, hair, outfit and one accessory, so no
// two collaborators are the same sprite recoloured.
const LOOKS = {
  scout:   { hair: "#4A382C", skin: "#E3B48D", shirt: "#5FCBBC", pants: "#6E7E96", glow: "#C6F5EC",
             hairStyle: "curly", outfit: "stripes", accessory: "glasses", accent: "#FFF8EC", build: "slim" },
  scribe:  { hair: "#6B4426", skin: "#F0D2AC", shirt: "#F3CE79", pants: "#8A7358", glow: "#FFF1CC",
             hairStyle: "bun", outfit: "collar", accessory: "earrings", accent: "#C7913F" },
  // dusty rose — §7 lists it in the palette and nothing else on the page uses it
  courier: { hair: "#3A322C", skin: "#C89370", shirt: "#F29C8D", pants: "#7A7189", glow: "#FFD2CA",
             hairStyle: "beanie", outfit: "vest", accessory: "lanyard", accent: "#CFBBF0", build: "broad" },
  builder: { hair: "#332C26", skin: "#A0714B", shirt: "#94CDEE", pants: "#6E7E96", glow: "#D8EEFF",
             hairStyle: "cap", outfit: "hoodie", accessory: "headphones", accent: "#6E9FD8" },
  human:   { hair: "#3E3128", skin: "#D9A277", shirt: "#FFFDF4", pants: "#5E6E86", glow: null,
             hairStyle: "short", outfit: "collar", accessory: "none", accent: "#DCE7E8" },
};

const LINE = "#59696E";
const SHOE = "#8A7358";

// one pixel person on a 14x20 integer grid — identical proportions, traits and
// colours to the demo's makePerson(), so the page and /demo show one cast
function Person({ look, ai = false }) {
  const { hair, skin, shirt, pants, glow } = look;
  const hairStyle = look.hairStyle || "short";
  const outfit = look.outfit || "plain";
  const accessory = look.accessory || "none";
  const accent = look.accent || "#FFF8EC";
  const tx = look.build === "slim" ? 4 : 3;
  const tw = look.build === "slim" ? 6 : look.build === "broad" ? 9 : 8;
  const legL = tx + 1;
  const legR = tx + tw - 3;
  const plainTop = hairStyle === "short" || hairStyle === "long" || hairStyle === "bun";

  return (
    <>
      {ai && glow ? <rect x="1" y="0" width="12" height="20" fill={glow} opacity="0.22" /> : null}

      {/* hair, behind the face */}
      {hairStyle === "hood" ? (
        <>
          <rect x="2" y="1" width="10" height="8" fill={shirt} />
          <rect x="3" y="2" width="8" height="2" fill={hair} />
        </>
      ) : hairStyle === "curly" ? (
        <>
          <rect x="3" y="0" width="8" height="5" fill={hair} />
          <rect x="2" y="2" width="1" height="4" fill={hair} />
          <rect x="11" y="2" width="1" height="4" fill={hair} />
        </>
      ) : hairStyle === "long" ? (
        <>
          <rect x="4" y="1" width="6" height="3" fill={hair} />
          <rect x="3" y="2" width="8" height="4" fill={hair} />
          <rect x="2" y="3" width="1" height="9" fill={hair} />
          <rect x="11" y="3" width="1" height="9" fill={hair} />
        </>
      ) : hairStyle === "bun" ? (
        <>
          <rect x="5" y="0" width="4" height="2" fill={hair} />
          <rect x="4" y="1" width="6" height="3" fill={hair} />
          <rect x="3" y="2" width="8" height="4" fill={hair} />
        </>
      ) : hairStyle === "cap" ? (
        <>
          <rect x="4" y="1" width="6" height="3" fill={hair} />
          <rect x="3" y="2" width="8" height="4" fill={hair} />
          <rect x="3" y="1" width="8" height="2" fill={accent} />
          <rect x="2" y="3" width="5" height="1" fill={accent} />
          <rect x="3" y="3" width="8" height="1" fill={LINE} />
        </>
      ) : hairStyle === "beanie" ? (
        <>
          <rect x="3" y="2" width="8" height="4" fill={hair} />
          <rect x="3" y="1" width="8" height="3" fill={accent} />
          <rect x="3" y="3" width="8" height="1" fill={LINE} />
          <rect x="6" y="0" width="2" height="1" fill={accent} />
        </>
      ) : (
        <>
          <rect x="4" y="1" width="6" height="3" fill={hair} />
          <rect x="3" y="2" width="8" height="4" fill={hair} />
        </>
      )}

      {/* face */}
      <rect x="4" y="4" width="6" height="4" fill={skin} />
      {plainTop ? <rect x="4" y="3" width="6" height="1" fill={hair} /> : null}
      <rect x="5" y="6" width="1" height="1" fill={LINE} />
      <rect x="8" y="6" width="1" height="1" fill={LINE} />

      {/* body */}
      <rect x={tx} y="8" width={tw} height="7" fill={shirt} />
      <rect x={tx - 1} y="9" width="1" height="5" fill={shirt} />
      <rect x={tx + tw} y="9" width="1" height="5" fill={shirt} />
      <rect x={tx - 1} y="13" width="1" height="2" fill={skin} />
      <rect x={tx + tw} y="13" width="1" height="2" fill={skin} />

      {/* outfit */}
      {outfit === "hoodie" ? (
        <>
          <rect x={tx} y="8" width={tw} height="2" fill={accent} />
          <rect x="6" y="10" width="1" height="2" fill={accent} />
          <rect x="8" y="10" width="1" height="2" fill={accent} />
          <rect x={tx + 1} y="12" width={tw - 2} height="2" fill={LINE} />
        </>
      ) : outfit === "collar" ? (
        <>
          <rect x={tx} y="8" width="2" height="7" fill={accent} />
          <rect x={tx + tw - 2} y="8" width="2" height="7" fill={accent} />
          <rect x="6" y="8" width="2" height="1" fill="#FFF8EC" />
          <rect x="6" y="9" width="2" height="4" fill={pants} />
        </>
      ) : outfit === "stripes" ? (
        [9, 11, 13].map((y) => <rect key={y} x={tx} y={y} width={tw} height="1" fill={accent} />)
      ) : outfit === "overalls" ? (
        <>
          <rect x={tx + 1} y="8" width="1" height="3" fill={pants} />
          <rect x={tx + tw - 2} y="8" width="1" height="3" fill={pants} />
          <rect x={tx + 1} y="10" width={tw - 2} height="5" fill={pants} />
          <rect x={tx + 3} y="12" width="2" height="2" fill={accent} />
        </>
      ) : outfit === "vest" ? (
        <>
          <rect x={tx} y="8" width="2" height="7" fill={accent} />
          <rect x={tx + tw - 2} y="8" width="2" height="7" fill={accent} />
          <rect x={tx + 2} y="8" width={tw - 4} height="1" fill="#FFF8EC" />
        </>
      ) : outfit === "apron" ? (
        <>
          <rect x={tx + 1} y="9" width={tw - 2} height="6" fill={accent} />
          <rect x={tx + 2} y="8" width="1" height="2" fill={accent} />
          <rect x={tx + tw - 3} y="8" width="1" height="2" fill={accent} />
        </>
      ) : null}

      {/* legs */}
      <rect x={legL} y="15" width="2" height="4" fill={pants} />
      <rect x={legR} y="15" width="2" height="4" fill={pants} />
      <rect x={legL - 1} y="19" width="3" height="1" fill={SHOE} />
      <rect x={legR} y="19" width="3" height="1" fill={SHOE} />

      {/* one accessory */}
      {accessory === "glasses" ? (
        <>
          <rect x="4" y="6" width="1" height="1" fill={LINE} />
          <rect x="9" y="6" width="1" height="1" fill={LINE} />
          <rect x="6" y="6" width="2" height="1" fill={LINE} />
          <rect x="4" y="5" width="6" height="1" fill={LINE} />
        </>
      ) : accessory === "headphones" ? (
        <>
          <rect x="3" y="0" width="8" height="1" fill={LINE} />
          <rect x="2" y="3" width="2" height="3" fill={LINE} />
          <rect x="10" y="3" width="2" height="3" fill={LINE} />
          <rect x="2" y="4" width="1" height="1" fill={accent} />
          <rect x="11" y="4" width="1" height="1" fill={accent} />
        </>
      ) : accessory === "scarf" ? (
        <>
          <rect x={tx + 1} y="7" width={tw - 2} height="2" fill={accent} />
          <rect x={tx + tw - 3} y="9" width="2" height="3" fill={accent} />
        </>
      ) : accessory === "earrings" ? (
        <>
          <rect x="3" y="6" width="1" height="1" fill={accent} />
          <rect x="10" y="6" width="1" height="1" fill={accent} />
        </>
      ) : accessory === "lanyard" ? (
        <>
          <rect x="6" y="8" width="1" height="4" fill={LINE} />
          <rect x="8" y="8" width="1" height="4" fill={LINE} />
          <rect x="6" y="11" width="3" height="3" fill={accent} />
        </>
      ) : null}
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
      <rect x={x} y="2" width="28" height="13" fill="#FFF8EC" />
      <rect x={x + 2} y="4" width="24" height="9" fill="#BEE7F7" />
      <rect x={x + 2} y="4" width="24" height="4" fill="#DCF3FC" />
      <rect x={x + 5} y="5" width="7" height="2" fill="#FFFFFF" />
      <rect x={x + 16} y="9" width="6" height="2" fill="#FFFFFF" />
      <rect x={x + 2} y="11" width="24" height="2" fill="#B6E4C0" />
      <rect x={x + 13} y="2" width="1" height="13" fill="#FFF8EC" />
      <rect x={x} y="8" width="28" height="1" fill="#FFF8EC" />
    </>
  );
}

function Workstation({ cx, look, ai, bobClass }) {
  return (
    <>
      {/* monitor */}
      <rect x={cx - 9} y="20" width="18" height="11" fill="#9FB3BE" />
      <rect x={cx - 7} y="22" width="14" height="7" fill="#BBDCF0" />
      <rect x={cx - 6} y="23" width="8" height="1" fill="#FFFFFF" opacity="0.85" />
      <rect x={cx - 6} y="25" width="5" height="1" fill="#FFFFFF" opacity="0.6" />
      {/* desk, with a mug on it */}
      <rect x={cx - 16} y="31" width="32" height="3" fill="#F0D5A8" />
      <rect x={cx - 16} y="34" width="32" height="5" fill="#E3C094" />
      <rect x={cx + 10} y="29" width="3" height="3" fill="#F9CBDA" />
      {/* contact shadow, so nothing floats */}
      <ellipse cx={cx} cy="39" rx="17" ry="2" fill="#C9AE86" opacity="0.35" />
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
        <rect x="0" y="0" width="132" height="18" fill="#C7E9E5" />
        <rect x="0" y="16" width="132" height="2" fill="#A6D8D4" />
        <Window x={14} />
        <Window x={90} />
        {/* a framed print between the windows */}
        <rect x="56" y="4" width="14" height="10" fill="#CBA87C" />
        <rect x="58" y="6" width="10" height="6" fill="#FDF6E6" />
        <rect x="59" y="9" width="8" height="3" fill="#F4B3A6" />
        <rect x="61" y="7" width="3" height="3" fill="#F8DFA0" />

        {/* floor */}
        <rect x="0" y="18" width="132" height="42" fill="#DDBA88" />
        {[18, 24, 30, 36, 42, 48, 54].map((y) => (
          <rect key={y} x="0" y={y} width="132" height="3" fill="#D7B280" opacity="0.55" />
        ))}
        {/* the carpet the desks stand on */}
        <rect x="6" y="26" width="120" height="30" fill="#D2DAF0" />
        <rect x="6" y="26" width="120" height="1" fill="#AEB9DE" />
        <rect x="6" y="55" width="120" height="1" fill="#AEB9DE" />

        {/* morning light falling from the windows */}
        <polygon points="16,18 40,18 52,60 2,60" fill="#FFF3C4" opacity="0.28" />
        <polygon points="92,18 116,18 128,60 78,60" fill="#FFF3C4" opacity="0.28" />

        {/* bunting, because the room should feel lived in. The wire comes first
            so the flags hang off it rather than floating in the air. */}
        <rect x="0" y="19" width="132" height="1" fill="#C9AE86" opacity="0.7" />
        {[10, 26, 42, 58, 74, 90, 106, 122].map((x, i) => (
          <rect
            key={x}
            x={x}
            y="20"
            width="4"
            height="4"
            fill={["#F4B3A6", "#F8DFA0", "#9BD8B4", "#BEE7F7", "#CFBBF0", "#F9CBDA"][i % 6]}
          />
        ))}

        <Workstation cx={24} look={LOOKS.scout} ai bobClass="px-bob px-bob-a" />
        <Workstation cx={66} look={LOOKS.human} ai={false} bobClass="px-bob px-bob-b" />
        <Workstation cx={108} look={LOOKS.builder} ai bobClass="px-bob px-bob-c" />

        {/* plant, for the lived-in feel §7 asks for */}
        <ellipse cx="127" cy="49" rx="6" ry="2" fill="#C9AE86" opacity="0.35" />
        <rect x="124" y="44" width="6" height="5" fill="#CBA87C" />
        <rect x="123" y="38" width="8" height="6" fill="#9BD3A8" />
        <rect x="125" y="35" width="4" height="3" fill="#C0E8C4" />
      </svg>

      <span className="hero-pill hero-pill-working">working</span>
      <span className="hero-pill hero-pill-blocked">blocked</span>
      <span className="hero-pill hero-pill-done">done</span>
    </div>
  );
}

// The loop the product is actually selling, on repeat: you ask, someone walks
// in, takes a desk, and the room shows you the work moving. Static copy can
// describe this; only motion makes it obvious.
function WorkLoop() {
  return (
    <figure className="work-loop">
      <div className="work-loop-stage">
        <svg className="work-loop-art" viewBox="0 0 160 52" role="img" aria-hidden="true">
          {/* wall, door, floor */}
          <rect x="0" y="0" width="160" height="12" fill="#C7E9E5" />
          <rect x="0" y="11" width="160" height="1" fill="#A6D8D4" />
          <rect x="2" y="1" width="14" height="11" fill="#CBA87C" />
          <rect x="4" y="3" width="10" height="9" fill="#EBCB9F" />
          <rect x="11" y="7" width="2" height="2" fill="#E9B36A" />
          <rect x="0" y="12" width="160" height="40" fill="#DDBA88" />
          <rect x="0" y="18" width="160" height="1" fill="#C09B69" />
          <rect x="0" y="30" width="160" height="1" fill="#C09B69" />
          <rect x="30" y="14" width="126" height="32" fill="#D2DAF0" />

          {/* a station that is already occupied — the room is not empty, and the
              newcomer walks past someone mid-task on the way to the free desk */}
          <rect x="42" y="14" width="26" height="14" fill="#9FB3BE" />
          <rect x="44" y="16" width="22" height="10" fill="#9BD8B4" />
          <rect x="46" y="18" width="12" height="1" fill="#FFFFFF" opacity="0.85" />
          <rect x="46" y="21" width="16" height="1" fill="#FFFFFF" opacity="0.85" />
          <rect x="36" y="28" width="38" height="3" fill="#F0D5A8" />
          <rect x="36" y="31" width="38" height="5" fill="#E3C094" />
          <ellipse cx="55" cy="36" rx="20" ry="2" fill="#C9AE86" opacity="0.35" />
          <g transform="translate(48 30)">
            <Person look={LOOKS.scout} ai />
          </g>

          {/* the free desk they are heading for */}
          <rect x="112" y="14" width="26" height="14" fill="#9FB3BE" />
          <rect x="114" y="16" width="22" height="10" fill="#BBDCF0" />
          <rect x="116" y="18" width="12" height="1" fill="#FFFFFF" opacity="0.85" />
          <rect x="116" y="21" width="16" height="1" fill="#FFFFFF" opacity="0.85" />
          <rect x="106" y="28" width="38" height="3" fill="#F0D5A8" />
          <rect x="106" y="31" width="38" height="5" fill="#E3C094" />
          <ellipse cx="125" cy="36" rx="20" ry="2" fill="#C9AE86" opacity="0.35" />

          {/* a plant, so the strip is a room and not a diagram */}
          <rect x="150" y="40" width="6" height="5" fill="#CBA87C" />
          <rect x="149" y="34" width="8" height="6" fill="#9BD3A8" />

          {/* the walker passes in front of the desks, so nothing clips oddly */}
          <g className="loop-walker">
            <g transform="translate(0 30)">
              <Person look={LOOKS.courier} ai />
            </g>
          </g>
        </svg>

        <span className="loop-bubble">&ldquo;help me with competitor research&rdquo;</span>
        <span className="hero-pill loop-pill loop-pill-working">working</span>
        <span className="hero-pill loop-pill loop-pill-done">done</span>
      </div>

      <figcaption className="work-loop-steps">
        <span className="loop-step loop-step-1">you ask</span>
        <span className="loop-step loop-step-2">a collaborator walks in and takes a desk</span>
        <span className="loop-step loop-step-3">the room shows the work moving</span>
      </figcaption>
    </figure>
  );
}

// The argument, shown rather than claimed: the same four agents as a log, and
// as a room. The blocked one is the point — buried on the left, obvious on the
// right.
function ListVsRoom() {
  const roster = [
    { look: LOOKS.scout, cx: 22, pill: "working" },
    { look: LOOKS.courier, cx: 66, pill: "blocked" },
    { look: LOOKS.builder, cx: 110, pill: "done" },
  ];
  return (
    <div className="vs-grid">
      <figure className="vs-card vs-card-list">
        <figcaption>the same work, as a list</figcaption>
        <pre>
{`[scout]   fetch pricing/6 → ok
[scribe]  drafted 340 words
[auditor] query signups_daily → ok
[auditor] query activation → DENIED
[builder] 38 passing, 2 failing
[scribe]  done — awaiting review`}
        </pre>
        <p>you read every line to find the one that needs you.</p>
      </figure>

      <figure className="vs-card vs-card-room">
        <figcaption>the same work, as a room</figcaption>
        <div className="vs-room">
          <svg viewBox="0 0 132 46" role="img" aria-hidden="true">
            <rect x="0" y="0" width="132" height="46" fill="#D2DAF0" />
            <rect x="0" y="0" width="132" height="1" fill="#AEB9DE" />
            {roster.map(({ look, cx }) => (
              <g key={cx}>
                <rect x={cx - 9} y="6" width="18" height="11" fill="#9FB3BE" />
                <rect x={cx - 7} y="8" width="14" height="7" fill="#BBDCF0" />
                <rect x={cx - 16} y="17" width="32" height="3" fill="#F0D5A8" />
                <rect x={cx - 16} y="20" width="32" height="4" fill="#E3C094" />
                <ellipse cx={cx} cy="24" rx="17" ry="2" fill="#C9AE86" opacity="0.3" />
                <g transform={`translate(${cx - 7} 25)`}>
                  <Person look={look} ai />
                </g>
              </g>
            ))}
          </svg>
          {roster.map(({ cx, pill }) => (
            <span
              key={pill}
              className={`hero-pill vs-pill hero-pill-${pill}`}
              style={{ left: `${(cx / 132) * 100}%` }}
            >
              {pill}
            </span>
          ))}
        </div>
        <p>one look tells you who is stuck. nobody had to read anything.</p>
      </figure>
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

      <WorkLoop />

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

        <ListVsRoom />

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
