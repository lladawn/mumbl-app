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
    title: "connect it to your office",
    body: "Click “Connect my office”. Your browser opens on a page where you're already signed in, you check the name of the Mac asking, and you click Authorize. That's it — you never copy a token out of a web page.",
  },
  {
    num: "03",
    title: "just work",
    body: "Switch to Figma. Jump into VS Code. Take a Zoom call. Connect Claude Code or GitHub. Each app you focus lands a station in the room, live — a coding desk, a record player, a lit meeting room.",
  },
  {
    num: "04",
    title: "get a recap at the end of the day",
    body: "The day rolls up into a recap — which apps, how long, how many stretches, and the shape of the day as a card you can post. Built from the same shape data, never from anything you typed.",
  },
];

// The pairing step above is the one people are most suspicious of, so the copy
// stays specific about what the Mac actually receives. See app/pair and
// src/server/devicePairing.js: authorizing mints a token scoped to that ONE
// machine, valid only for posting activity to one office, and revocable on its
// own. The space-wide ingest token never travels.
const pairingNotes = [
  "one key per Mac, not a shared password",
  "it can post activity, and nothing else",
  "revoke one machine without touching the others",
  "the code expires in 10 minutes",
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
    q: "how do I actually install it?",
    a: "Today: you don't — it's invite-only. Not because we're drip-feeding scarcity, but because a Mac app has to be notarized by Apple before Gatekeeper will let a stranger open it, and we're still finishing that. Early-access invites come with a build that opens normally. Once notarization lands, the helper becomes a plain download on this page.",
  },
  {
    q: "what does the day recap keep?",
    a: "One row per app per day: which app, which category, how many seconds, how many separate stretches. That's the whole record — it's what makes the recap possible, and it persists rather than expiring like the live events do. No window titles, URLs, file names, or task text are stored anywhere, ever.",
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
        <p className="office-lead-quote">
          A pixel office assembles itself from those pings. A coding desk appears because you&apos;re coding.
          A record player spins because Spotify&apos;s on. A meeting room lights up because you&apos;re on a call.
          Nobody designs it — it just shows up, shaped like your actual day.
        </p>
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
        <h2>install, connect, then forget about it.</h2>
        <div className="office-steps">
          {steps.map((step) => (
            <div className="office-step" key={step.num}>
              <span className="office-step-num">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--muted)", margin: "18px 0 0", fontSize: "0.82rem", lineHeight: 1.6 }}>
          Step 02 is the one worth being picky about, so here is exactly what your Mac gets:
        </p>
        <ul className="office-privacy-list">
          {pairingNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
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
            The helper asks the OS exactly one question: which app just got focus? What it sends is that app&apos;s
            identity and category — <em>Figma · design</em>, <em>VS Code · coding</em>, <em>Zoom · call</em> — plus
            when the switch happened. That is the shape: it is what self-assembles the office, and it is what
            anyone with your link can see. If you would not want someone knowing you had Figma open, this is the
            part to know about.
          </p>
          <p>
            What never leaves: window titles, URLs, file names, clipboard contents, keystrokes, screen pixels.
            There is one function in the codebase — <code>redactForPublic</code> — and every byte shown to
            another person passes through it. Its entire job is refusing to let a task description, a file name,
            or a URL near a card someone else can see.
          </p>
          <p>
            The live event log expires after 15 minutes by default — the office shows you <em>now</em>, not a
            running transcript. History is opt-in and off unless you turn it on.
          </p>
          <p>
            One thing does persist, and it should be said plainly: so the day recap can exist, we keep a daily
            rollup of <em>which app, which category, how many seconds, how many stretches</em>. That is the whole
            row. No titles, no URLs, no file names, no task text — the same shape vocabulary as everything above,
            just totalled per day instead of expiring. If you never open the recap, it is still being counted.
          </p>
          <ul className="office-privacy-list">
            <li>shape only, not content</li>
            <li>live events ephemeral (15 min TTL)</li>
            <li>daily totals kept for the recap</li>
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

      {/* GET THE HELPER — the download surface, honestly gated */}
      <section>
        <p className="eyebrow">get the helper</p>
        <h2>macOS helper — invite-only while we finish notarizing.</h2>
        <div className="office-cta-panel">
          <h3>why there isn&apos;t a download button here yet</h3>
          <p>
            We could put a build behind a button today. You would download it, macOS would refuse to open it, and
            you would get a dialog telling you the app is damaged or from an unidentified developer — because
            Gatekeeper blocks anything that has not been notarized by Apple. That is not a scary-but-fine warning
            you can click past; for most people it is a dead end. We would rather not spend your first two minutes
            with mumbl on a wall.
          </p>
          <p>
            Notarization is an automated malware scan, not a review board — nobody is judging the app. It just
            needs a paid Apple developer account attached to the build, and that is the step we are on. When it
            is done the download becomes a normal download, and this section becomes a button.
          </p>
          <ul className="office-privacy-list">
            <li>macOS only for now</li>
            <li>notarization in progress</li>
            <li>invite-only until then</li>
          </ul>
          <div className="office-cta-buttons" style={{ marginTop: 20 }}>
            <Link className="solid-button button-link" href="/#waitlist">
              get early access
            </Link>
            <Link className="ghost-button button-link" href="/office/demo">
              walk around the demo instead
            </Link>
          </div>
          <p style={{ margin: "18px 0 0", fontSize: "0.78rem", lineHeight: 1.6 }}>
            Early access is a real invite with a real build, not a mailing list holding pattern. We are not going
            to guess a date at you.
          </p>
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
