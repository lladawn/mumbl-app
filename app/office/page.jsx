import Link from "next/link";

/**
 * /office — the product page.
 *
 * SHOW, DON'T TELL. The bar is that someone landing cold understands what this
 * is in about five seconds, without reading. So the page leads with a real
 * screenshot of a real office and a caption-length line, and tells the flow as
 * a sequence of actual captures with a few words each. Where an image and a
 * paragraph said the same thing, the paragraph is gone.
 *
 * Every image here is a REAL capture of the shipping product, served from
 * public/office-screens/. No mockups and no illustrations of things that do not
 * exist — if a claim had no real screenshot, the claim was cut instead.
 *
 * The only place prose still earns its keep is privacy, because "what leaves
 * your machine" cannot be shown in a picture and is the thing people are right
 * to be careful about. That section is deliberately the longest thing here and
 * should stay that way: a first pass at this rebuild compressed it for balance
 * and quietly dropped the two sentences that actually tell someone what they
 * would want to know ("...if you would not want someone knowing you had Figma
 * open" and "if you never open the recap, it is still being counted"). On this
 * page the layout gives way to the disclosure, never the other way round.
 */

const description =
  "A pixel office that draws itself from the apps you actually use — Figma, VS Code, a Zoom call, Spotify. Shape, not content: never a keystroke, title or URL.";

export const metadata = {
  title: "mumbl office — your apps become an office",
  description,
  alternates: { canonical: "/office" },
  openGraph: {
    title: "mumbl office — your apps become an office",
    description,
    url: "/office",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl office — your apps become an office",
    description,
  },
};

// The flow, told in three real captures. The captions are deliberately short:
// each image already says the thing, and repeating it in a paragraph is the
// failure mode this page was rebuilt to fix.
const flow = [
  {
    num: "01",
    title: "connect your Mac, once",
    caption: "One click, one authorize. Nothing is shared until you do.",
    src: "/office-screens/flow-helper.png",
    alt: "The mumbl menu-bar popover reading 'Your desk is empty' with a 'Connect my office' button, and a note that nothing is being shared yet",
    w: 720,
    h: 540,
  },
  {
    num: "02",
    title: "your office assembles itself",
    caption: "Every app you use lands a station. Nobody designs the room.",
    src: "/office-screens/flow-office.png",
    alt: "A pixel office seen from above, with work stations, a café, a lounge and a ping-pong table, people at each",
    w: 800,
    h: 600,
  },
  {
    num: "03",
    title: "the day ends in a recap",
    caption: "Where the hours went, as a card you can post.",
    src: "/office-screens/flow-recap.png",
    alt: "A day recap page reading 'you built something today', with time per app: VS Code 4h15m, Terminal 1h10m, Chrome 59m",
    w: 800,
    h: 600,
  },
];

const faqs = [
  {
    q: "can I use it today?",
    a: "It's a private alpha, macOS only. Join the waitlist and we'll reach out with a build — it's a real invite, not a mailing list. The demo office is live right now if you want to walk around one first.",
  },
  {
    q: "what actually leaves my machine?",
    a: "Which app has focus and when it changed — the app's identity and its category, like Figma · design or VS Code · coding. That's what draws the office and it's what anyone with your link can see. Never window titles, URLs, file names, clipboard, keystrokes or pixels.",
  },
  {
    q: "is anything kept?",
    a: "The live event log expires after 15 minutes. One thing does persist so the recap can exist: a daily rollup of which app, which category, how many seconds, how many stretches. That's the whole row — no titles, no URLs, no task text. You can pause sharing from the menu bar at any time.",
  },
  {
    q: "why macOS only?",
    a: "The helper uses one macOS system notification — NSWorkspace.didActivateApplicationNotification — to know which app has focus. Windows support isn't built yet.",
  },
];

export default function OfficePage() {
  return (
    <div className="office-landing">
      {/* HERO — image first. The picture is the pitch. */}
      <section className="office-hero">
        <p className="eyebrow">office · private alpha</p>
        <h1>Your apps become an office.</h1>
        <p className="office-hero-line">
          Open Figma and a design desk appears. Take a call and the meeting room lights up.
          It draws itself from your real workday.
        </p>
        <img
          className="office-hero-img"
          src="/office-screens/hero-office.png"
          alt="A pixel office with six desks, each labelled with a real app — Spotify, Slack, Zoom, Terminal, Figma, VS Code — and a person working at each"
          width={1560}
          height={1146}
        />
        <div className="office-hero-actions">
          <Link className="solid-button button-link" href="/office/demo">
            walk around a live office
          </Link>
          <Link className="ghost-button button-link" href="/#waitlist">
            join the alpha waitlist
          </Link>
        </div>
      </section>

      {/* THE FLOW — three real captures, a few words each */}
      <section>
        <p className="eyebrow">how it works</p>
        <h2>three things happen. you do one of them.</h2>
        <div className="office-flow">
          {flow.map((step) => (
            <figure className="office-flow-step" key={step.num}>
              <div className="office-flow-shot">
                <img src={step.src} alt={step.alt} width={step.w} height={step.h} loading="lazy" />
              </div>
              <figcaption>
                <span className="office-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* IT'S A PLACE — one more real capture, almost no words */}
      <section>
        <p className="eyebrow">not a dashboard</p>
        <h2>it&apos;s a room. people are in it.</h2>
        <img
          className="office-wide-img"
          src="/office-screens/detail-recroom.png"
          alt="The rec room of a pixel office: two people rallying at a ping-pong table with a chalk scoreboard, another at an arcade cabinet"
          width={1920}
          height={1200}
          loading="lazy"
        />
        <p className="office-wide-caption">
          Idle teammates drift to the café and the rec room. Two people on a call sit at the same table.
          The room is the status page.
        </p>
      </section>

      {/* PRIVACY — the one place words beat pictures */}
      <section>
        <p className="eyebrow">privacy</p>
        <h2>shape, not content.</h2>
        <div className="office-privacy-box">
          <p>
            What leaves: which app has focus and when it changed —{" "}
            <em>Figma · design</em>, <em>VS Code · coding</em>. That is what draws the office and what
            anyone with your link can see. If you would not want someone knowing you had Figma open,
            this is the part to know about.
          </p>
          <p>
            What never leaves: window titles, URLs, file names, clipboard contents, keystrokes, screen
            pixels. There is one function in the codebase — <code>redactForPublic</code> — and every byte
            shown to another person passes through it.
          </p>
          <p>
            The live event log expires after 15 minutes — the office shows you <em>now</em>, not a running
            transcript. History is opt-in and off unless you turn it on.
          </p>
          <p>
            One thing does persist, and it should be said plainly: so the day recap can exist, we keep a
            daily rollup of <em>which app, which category, how many seconds, how many stretches</em>. That
            is the whole row — no titles, no URLs, no file names, no task text. If you never open the
            recap, it is still being counted.
          </p>
          <ul className="office-privacy-list">
            <li>no keystrokes or URLs</li>
            <li>live events 15 min TTL</li>
            <li>daily totals kept for the recap</li>
            <li>pause with one click</li>
          </ul>
        </div>
      </section>

      {/* CTA — the existing waitlist, honestly labelled */}
      <section>
        <div className="office-cta-panel">
          <p className="eyebrow">try it</p>
          <h3>private alpha — macOS, invite only.</h3>
          <p>
            Join the waitlist and we&apos;ll reach out with a build. It&apos;s early and we&apos;d rather
            hand it to people who&apos;ll tell us what&apos;s wrong with it.
          </p>
          <div className="office-cta-buttons">
            <Link className="solid-button button-link" href="/#waitlist">
              join the alpha waitlist
            </Link>
            <Link className="ghost-button button-link" href="/office/demo">
              see the demo first
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ — collapsed, so it costs nothing to scroll past */}
      <section>
        <p className="eyebrow">honest questions</p>
        <h2>the short answers.</h2>
        <div className="office-faq-list">
          {faqs.map((item) => (
            <details className="office-faq-card" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
