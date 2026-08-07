import Link from "next/link";

export const metadata = {
  title: "vision",
  description:
    "Mumbl exists to surface the human layer of work: the reasoning, taste, and growth that never makes it into a ticket, and to give people back the realest data they have — how they actually think.",
  alternates: { canonical: "/slack/vision" },
  openGraph: {
    title: "mumbl vision",
    description: "The human layer of work — the thinking, taste, and growth that never makes it into a ticket. Mumbl surfaces it.",
    url: "/slack/vision",
  },
  twitter: {
    title: "mumbl vision",
    description: "The human layer of work — the thinking, taste, and growth that never makes it into a ticket. Mumbl surfaces it.",
  },
};

// pixel save-slots: every tool saves the *output* of work. none save the layer.
const slots = [
  { id: "chat", label: "slack", saves: "messages" },
  { id: "doc", label: "docs", saves: "decisions" },
  { id: "ticket", label: "tickets", saves: "tasks" },
  { id: "code", label: "code", saves: "the result" },
];

const beliefs = [
  { id: "data", line: "your thinking is real data — about you.", tone: "coral" },
  { id: "one", line: "one honest sentence is enough.", tone: "mint" },
  { id: "team", line: "the team gets the layer back.", tone: "violet" },
];

function SlotSprite({ id }) {
  const art = {
    chat: (
      <>
        <rect x="2" y="3" width="12" height="8" fill="#cdd7e6" />
        <rect x="2" y="3" width="12" height="1" fill="#9aa7bd" />
        <rect x="5" y="11" width="3" height="2" fill="#cdd7e6" />
        <rect x="4" y="6" width="8" height="1" fill="#6d6760" />
        <rect x="4" y="8" width="5" height="1" fill="#6d6760" />
      </>
    ),
    doc: (
      <>
        <rect x="3" y="2" width="10" height="12" fill="#eee7d8" />
        <rect x="3" y="2" width="10" height="1" fill="#c7bda6" />
        <rect x="5" y="5" width="6" height="1" fill="#6d6760" />
        <rect x="5" y="7" width="6" height="1" fill="#6d6760" />
        <rect x="5" y="9" width="4" height="1" fill="#6d6760" />
      </>
    ),
    ticket: (
      <>
        <rect x="2" y="4" width="12" height="8" fill="#d7ead9" />
        <rect x="2" y="4" width="12" height="1" fill="#9cc0a2" />
        <rect x="5" y="7" width="2" height="2" fill="#2f6b45" />
        <rect x="8" y="7" width="4" height="1" fill="#6d6760" />
        <rect x="8" y="9" width="3" height="1" fill="#6d6760" />
      </>
    ),
    code: (
      <>
        <rect x="2" y="3" width="12" height="10" fill="#e2dced" />
        <rect x="4" y="6" width="1" height="1" fill="#604398" />
        <rect x="3" y="7" width="1" height="1" fill="#604398" />
        <rect x="4" y="8" width="1" height="1" fill="#604398" />
        <rect x="11" y="6" width="1" height="1" fill="#604398" />
        <rect x="12" y="7" width="1" height="1" fill="#604398" />
        <rect x="11" y="8" width="1" height="1" fill="#604398" />
        <rect x="7" y="5" width="1" height="6" fill="#604398" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 16 16" className="px-sprite" aria-hidden="true">{art[id]}</svg>
  );
}

function HumanLayerSprite() {
  return (
    <svg viewBox="0 0 16 16" className="px-sprite" aria-hidden="true">
      <rect x="6" y="1" width="1" height="2" fill="#ffd25a" />
      <rect x="9" y="1" width="1" height="2" fill="#ffd25a" />
      <rect x="5" y="4" width="6" height="5" fill="#f6c14f" />
      <rect x="4" y="5" width="8" height="3" fill="#ffd873" />
      <rect x="7" y="4" width="2" height="6" fill="#e79a3a" />
      <rect x="6" y="10" width="4" height="1" fill="#c96a55" />
      <rect x="5" y="11" width="6" height="2" fill="#7a4a2b" />
      <rect x="3" y="6" width="1" height="1" fill="#fff3c4" />
      <rect x="12" y="6" width="1" height="1" fill="#fff3c4" />
    </svg>
  );
}

export default function MissionPage() {
  return (
    <section className="mission-view pixel-screen">
      <header className="mv-hero">
        <p className="eyebrow">the vision</p>
        <h1>the human layer of work.</h1>
        <p className="mv-lede">
          Every team runs on a layer no tool captures — the reasoning, the taste, the gut calls, the way
          people actually grow. It lives in heads and DMs, and walks out the door when they do.
        </p>
      </header>

      <section className="mv-slots" aria-label="what tools save">
        <div className="mv-slots-head">
          <span className="eyebrow">every tool saves the output</span>
        </div>
        <div className="mv-slot-row">
          {slots.map((slot) => (
            <div className="mv-slot" key={slot.id}>
              <span className="mv-slot-art"><SlotSprite id={slot.id} /></span>
              <strong>{slot.label}</strong>
              <small>{slot.saves}</small>
            </div>
          ))}
          <div className="mv-slot mv-slot-mumbl">
            <span className="mv-slot-art"><HumanLayerSprite /></span>
            <strong>mumbl</strong>
            <small>how you think</small>
          </div>
        </div>
        <p className="mv-slot-caption">none of the others save the human layer. mumbl does.</p>
      </section>

      <section className="mv-beliefs" aria-label="mumbl beliefs">
        {beliefs.map((belief, i) => (
          <article className={`mv-belief mv-${belief.tone}`} key={belief.id}>
            <span className="mv-belief-num">0{i + 1}</span>
            <h2>{belief.line}</h2>
          </article>
        ))}
      </section>

      <section className="mv-loop" aria-label="how the layer comes back">
        <span className="eyebrow">how it comes back</span>
        <div className="mv-loop-row">
          <span className="mv-loop-step">a rough line</span>
          <span className="mv-loop-arrow" aria-hidden="true">→</span>
          <span className="mv-loop-step">stays yours</span>
          <span className="mv-loop-arrow" aria-hidden="true">→</span>
          <span className="mv-loop-step">compounds</span>
          <span className="mv-loop-arrow" aria-hidden="true">→</span>
          <span className="mv-loop-step mv-loop-end">the team sees how it thinks</span>
        </div>
      </section>

      <section className="mv-closing">
        <h2>the people are the product.</h2>
        <p>Tools captured the output of work for decades. The thinking behind it finally has somewhere to go.</p>
        <Link className="solid-button button-link" href="/api/slack/install">
          add mumbl to slack
        </Link>
      </section>
    </section>
  );
}
