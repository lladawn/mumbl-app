import Link from "next/link";

const description =
  "A tiny macOS menubar app watches which apps you're focused on — Figma, VS Code, a Zoom call — and a pixel office assembles itself from the shape of your real workday. One click makes a card you can post. Shape, not content — never a single keystroke or URL.";

export const metadata = {
  title: "mumbl office — your workday, drawn live",
  description,
  alternates: { canonical: "/office" },
  openGraph: {
    title: "mumbl office — your workday, drawn live",
    description,
    url: "/office",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl office — your workday, drawn live",
    description,
  },
};

const steps = [
  {
    num: "01",
    title: "install the menubar helper",
    body: "A small macOS app sits quietly in your menu bar. It asks the OS one question: which app just got focus? Nothing else. No Accessibility permission, no window titles, no keystrokes.",
  },
  {
    num: "02",
    title: "just work",
    body: "Switch to Figma. Jump into VS Code. Take a Zoom call. Connect Claude Code or GitHub. The helper notices the shape of what you're doing — never the content — and sends a brief ping.",
  },
  {
    num: "03",
    title: "your office fills in",
    body: "A pixel office assembles itself from those pings. A coding desk appears because you're coding. A record player spins because Spotify's on. A meeting room lights up because you're on a call. Nobody designs it — it just shows up, shaped like your actual day.",
  },
];

const whyCards = [
  {
    title: "ambient presence",
    body: "Your team and your AI agents are in the same room. Walk up to a desk and see what's happening — working, blocked, on a call — without interrupting anyone.",
  },
  {
    title: "a shareable card that's actually honest",
    body: "One click turns your office into a postable card: the vibe of your day, which rooms lit up, how busy it looks. Not once a year and curated — right now and honest. That's the stranger, more interesting thing to share.",
  },
  {
    title: "no two offices look alike",
    body: "The office self-assembles from whatever you actually used. A design table exists iff you opened Figma. A record player exists iff Spotify was playing. It's a fingerprint, not a template — curiosity bait for anyone who sees your card.",
  },
];

const faqs = [
  {
    q: "is this macOS only right now?",
    a: "Yes. The helper uses a single macOS system notification — NSWorkspace.didActivateApplicationNotification — to know which app has focus. Windows support is on the roadmap but isn't built yet. If you're on a Mac, you can get early access below.",
  },
  {
    q: "what data actually leaves my machine?",
    a: "Only the shape of the work: which app category (coding, design, call, music…) and when. Never window titles, URLs, file names, clipboard, keystrokes, or screen pixels. The data that leaves is the same data that's safe to post publicly.",
  },
  {
    q: "is it private?",
    a: "Shape is visible to anyone you share your office link with; task details and content are never captured at all. Events expire after 15 minutes by default — the office shows you now, not a permanent record. History is off unless you explicitly enable it. You can pause sharing from the menu bar with one click.",
  },
  {
    q: "how does the shareable card work?",
    a: "Every office has a public link at mumbl.wtf/office/[yourname]. That page shows only the shape: which stations are lit, how busy it looks, the vibe. One button copies a share card you can post to X or Slack. The card carries your link — that's the loop.",
  },
  {
    q: "when can I connect my own live data?",
    a: "We're in private beta right now. The demo at /office/demo shows a real seeded cast so you can see how it feels. Self-serve live data is what we're building toward — get early access below and you'll be first.",
  },
];

export default function OfficePage() {
  return (
    <div className="office-landing">
      {/* HERO */}
      <section>
        <div className="office-hero-head">
          <p className="eyebrow">office · private beta</p>
          <h1>Your office, drawn from your real workday.</h1>
          <p>
            A pixel office that assembles itself from the apps you actually use — Figma, VS Code, a Zoom call,
            Spotify — so what you share is honest without being exposing. Shape, not content. Your day, not your diary.
          </p>
        </div>
        <div className="office-hero-actions">
          <Link className="solid-button button-link" href="/office/demo">
            see a live office
          </Link>
          <Link className="ghost-button button-link" href="/#waitlist">
            get early access
          </Link>
        </div>

        {/* Screenshots */}
        <div className="office-screens">
          <img
            src="/office-screens/live-per-app-office.png"
            alt="A live pixel office with per-app stations: VS Code, Figma, Zoom, and Spotify each rendered as distinct desks"
            className="office-screen-img"
            width={480}
            height={300}
          />
          <img
            src="/office-screens/office-disha.png"
            alt="Disha's pixel office, with a coding desk and meeting room lit up"
            className="office-screen-img"
            width={480}
            height={300}
          />
          <img
            src="/office-screens/share-card.png"
            alt="The shareable office card — shows the shape of the day, never any content"
            className="office-screen-img"
            width={480}
            height={300}
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <p className="eyebrow">how it works</p>
        <h2>three steps, then forget about it.</h2>
        <div className="office-steps">
          {steps.map((step) => (
            <div className="office-step" key={step.num}>
              <span className="office-step-num">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY */}
      <section>
        <p className="eyebrow">why it matters</p>
        <h2>the shareable card is the viral part.</h2>
        <div className="office-why-list">
          {whyCards.map((card) => (
            <div className="office-why-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRIVACY */}
      <section>
        <p className="eyebrow">privacy</p>
        <h2>shape, not content.</h2>
        <div className="office-privacy-box">
          <h3>what leaves your machine (and what never does)</h3>
          <p>
            The helper asks the OS exactly one question: which app just got focus? From that it derives a shape
            token — <em>coding</em>, <em>design</em>, <em>call</em>, <em>music</em> — and sends that. The shape
            is what self-assembles the office and what anyone with your link can see.
          </p>
          <p>
            What never leaves: window titles, URLs, file names, clipboard contents, keystrokes, screen pixels.
            There is one function in the codebase — <code>redactForPublic</code> — and every byte shown to
            another person passes through it. Its entire job is refusing to let a task description, a file name,
            or a URL near a card someone else can see.
          </p>
          <p>
            Events expire after 15 minutes by default. The office shows you <em>now</em>, not a permanent record
            someone could screenshot and hold against you later. History is opt-in and off unless you turn it on.
          </p>
          <ul className="office-privacy-list">
            <li>shape only, not content</li>
            <li>events ephemeral (15 min TTL)</li>
            <li>no keystrokes or URLs</li>
            <li>pause with one click</li>
            <li>history off by default</li>
          </ul>
        </div>
      </section>

      {/* SEE IT */}
      <section>
        <p className="eyebrow">see it</p>
        <h2>the demo office is live now.</h2>
        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: "0.9rem", lineHeight: 1.6 }}>
          The demo at <Link href="/office/demo" style={{ textDecoration: "underline" }}>/office/demo</Link> runs
          a real seeded cast so you can walk around and see how the office feels. Your own live data isn't
          self-serve yet — that&apos;s what early access is for.
        </p>
        <div className="office-hero-actions">
          <Link className="solid-button button-link" href="/office/demo">
            open the demo office
          </Link>
        </div>
      </section>

      {/* TRY IT — HONEST */}
      <section>
        <div className="office-cta-panel">
          <p className="eyebrow">try it</p>
          <h3>private beta — honest about where we are.</h3>
          <p>
            Live data and self-serve aren&apos;t open yet. The demo is real; your own office connected to your
            real workday is what we&apos;re building toward. Get early access and you&apos;ll be first — we&apos;ll
            keep it useful, not spammy.
          </p>
          <div className="office-cta-buttons">
            <Link className="solid-button button-link" href="/office/demo">
              see a live office
            </Link>
            <Link className="ghost-button button-link" href="/#waitlist">
              get early access
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <p className="eyebrow">honest questions</p>
        <h2>before you try mumbl office.</h2>
        <div className="office-faq-list">
          {faqs.map((item, i) => (
            <details className="office-faq-card" key={item.q} open={i === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
