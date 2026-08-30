import Link from "next/link";
import OfficeHero from "./OfficeHero";
import { demoSpaceState } from "../../src/server/officeDemo";

/**
 * /office — the product page.
 *
 * THE PAGE IS THE GAME. This is not a page that explains an office; the first
 * thing on it IS the office, running, from the same scene the product ships
 * (see OfficeHero.jsx). Nobody needs this product — they want one — so the page
 * is built to be looked at, not read. Every section is a real capture of the
 * shipping app with a handful of words next to it, and where a picture said the
 * thing, the paragraph is gone. One ask: get a desk.
 *
 * Copy is Phyllis's (docs/office-swag-copy.md), used as written. One label of
 * hers is deliberately NOT used: "the shape" for the privacy section. That
 * phrasing comes from the product's old "shape, not content" line, which was
 * retired this week because the app's IDENTITY leaves the machine and is
 * visible to anyone with your link. A two-word eyebrow is exactly how a retired
 * claim sneaks back in, so the section is labelled "what leaves" instead.
 *
 * PRIVACY, AND WHY IT IS A DISCLOSURE BLOCK RATHER THAN A SECTION.
 * The earlier version of this page made a privacy CLAIM in the main flow, and a
 * claim needs qualifying, which is how a swag page grew four paragraphs of
 * hedging. So the flow now makes no privacy promise at all — and the honest
 * detail survives WORD FOR WORD in <details> below, where it is one click from
 * anywhere. The rule that does not bend: a precise claim may be CUT, but it may
 * never be replaced by a vaguer, friendlier one. If you are editing this page
 * and the disclosure is in your way, the layout gives way, not the disclosure.
 *
 * Every image is a REAL capture from public/office-screens/ — the cast portraits
 * are crops of one screenshot of the running room, labels and all. No mockups.
 */

const description =
  "Your apps just got bodies. A pixel office that draws itself from the apps you actually use — Figma, VS Code, a Zoom call, Spotify.";

export const metadata = {
  title: "mumbl office — your apps just got bodies",
  description,
  alternates: { canonical: "/office" },
  openGraph: {
    title: "mumbl office — your apps just got bodies",
    description,
    url: "/office",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl office — your apps just got bodies",
    description,
  },
};

// The scene needs a cast to seat. Same seeded demo state /office/demo falls back
// to, resolved on the server so the hero has nothing to fetch before it moves.
const heroState = demoSpaceState("demo");

// Six desks, cropped out of one capture of the running room. The app's own name
// label is part of the screenshot — the product wrote those, not this page.
const cast = [
  { app: "Figma", src: "/office-screens/cast-figma.png", tone: "clay" },
  { app: "VS Code", src: "/office-screens/cast-vscode.png", tone: "sky" },
  { app: "Spotify", src: "/office-screens/cast-spotify.png", tone: "green" },
  { app: "Slack", src: "/office-screens/cast-slack.png", tone: "lilac" },
  { app: "Zoom", src: "/office-screens/cast-zoom.png", tone: "gold" },
  { app: "Terminal", src: "/office-screens/cast-terminal.png", tone: "mint" },
];

export default function OfficePage() {
  return (
    <div className="sw">
      {/* ── HERO: the office, running ─────────────────────────────────── */}
      <section className="sw-hero">
        <p className="eyebrow sw-eyebrow">your office</p>
        <h1 className="sw-title">
          <span>your apps</span> <span>just got</span> <span>bodies.</span>
        </h1>

        <OfficeHero
          initialState={heroState}
          still="/office-screens/hero-stage.png"
          stillNarrow="/office-screens/hero-stage-narrow.png"
          alt="A pixel office seen from above: six desks labelled Spotify, Slack, Zoom, Terminal, Figma and VS Code, a person working at each, with a café off to one side"
        />

        <div className="sw-cta">
          <Link className="sw-button" href="/#waitlist">get a desk.</Link>
          <p className="sw-fine">macOS · private alpha · invite only</p>
        </div>
      </section>

      {/* ── THE CAST: one app, one body ───────────────────────────────── */}
      <section className="sw-band sw-band-cast">
        <p className="eyebrow sw-eyebrow">the cast</p>
        <div className="sw-cast">
          {cast.map((member, i) => (
            <figure className={`sw-card tone-${member.tone}`} key={member.app} style={{ "--d": `${i * 90}ms` }}>
              <img src={member.src} alt={`The ${member.app} desk in the office: a monitor, a WORKING pill, a person at the desk and the label ${member.app}`} width={250} height={275} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      {/* ── THE ROOM ──────────────────────────────────────────────────── */}
      <section className="sw-band sw-band-room">
        <p className="eyebrow sw-eyebrow">the room</p>
        <figure className="sw-frame">
          {/* the wide shot is unreadable at 390px — same capture, framed on the
              rally, for phones */}
          <picture>
            <source media="(max-width: 700px)" srcSet="/office-screens/detail-recroom-narrow.png" width={800} height={650} />
            <img
              src="/office-screens/detail-recroom.png"
              alt="Pia and Nadia rallying across a ping-pong table, paddles up, the ball mid-air, a scoreboard behind them reading 0 to 1. Both are pilled IDLE. Felix is at the arcade cabinet."
              width={1920}
              height={1200}
              loading="lazy"
            />
          </picture>
        </figure>
        <p className="sw-line">nobody is working in this part.</p>
      </section>

      {/* ── THE RECAP ─────────────────────────────────────────────────── */}
      <section className="sw-band sw-band-recap">
        <p className="eyebrow sw-eyebrow">the recap</p>
        <figure className="sw-frame sw-frame-card">
          <picture>
          <source media="(max-width: 700px)" srcSet="/office-screens/recap-card-narrow.png" width={560} height={580} />
          <img
            src="/office-screens/recap-card.png"
            alt="The end-of-day card: 'demo\u2019s day', Aug 18, 6 tools, 9h35 focused, most time in VS Code at 4h20, then Spotify 3h10, Figma 2h05, Zoom 1h40, Slack 55m, Notion 35m."
            width={1200}
            height={630}
            loading="lazy"
          />
          </picture>
        </figure>
        <p className="sw-line">the day ends as a card.</p>
      </section>

      {/* ── ONE ASK ───────────────────────────────────────────────────── */}
      <section className="sw-band sw-band-end">
        <p className="eyebrow sw-eyebrow">get in</p>
        <h2 className="sw-end-title">everyone&rsquo;s getting an office.</h2>
        <div className="sw-cta">
          <Link className="sw-button" href="/#waitlist">get a desk.</Link>
          <p className="sw-fine">macOS · private alpha · invite only</p>
        </div>
      </section>

      {/* ── DISCLOSURE ────────────────────────────────────────────────────
          Verbatim from the corrected version. Do not compress, soften, or
          summarise this. Cutting a precise claim is allowed; blurring one is
          not. See the file header. */}
      <details className="sw-disclosure">
        <summary>what leaves your Mac</summary>
        <div className="sw-disclosure-body">
          <p>
            What leaves: which app has focus and when it changed — <em>Figma · design</em>,{" "}
            <em>VS Code · coding</em>. That is what draws the office and what anyone with your link can
            see. If you would not want someone knowing you had Figma open, this is the part to know
            about.
          </p>
          <p>
            What never leaves: window titles, URLs, file names, clipboard contents, keystrokes, screen
            pixels. There is one function in the codebase — <code>redactForPublic</code> — and every byte
            shown to another person passes through it.
          </p>
          <p>
            The live event log expires after 15 minutes — the office shows you <em>now</em>, not a
            running transcript. History is opt-in and off unless you turn it on.
          </p>
          <p>
            One thing does persist, and it should be said plainly: so the day recap can exist, we keep a
            daily rollup of <em>which app, which category, how many seconds, how many stretches</em>.
            That is the whole row — no titles, no URLs, no file names, no task text. If you never open
            the recap, it is still being counted.
          </p>
          <p>
            The helper is macOS only: it reads one system notification —{" "}
            <code>NSWorkspace.didActivateApplicationNotification</code> — to know which app has focus.
            You can pause sharing from the menu bar at any time.
          </p>
        </div>
      </details>
    </div>
  );
}
