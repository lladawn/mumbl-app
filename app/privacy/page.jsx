import Link from "next/link";

export const metadata = {
  title: "privacy",
  description:
    "Mumbl privacy: private dumps, anonymous-first team reads, and a Slack app that only saves what people explicitly choose.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "mumbl privacy",
    description: "Private dumps stay private. Anonymous team reads stay anonymous. Mumbl does not read Slack channel history.",
    url: "/privacy",
  },
  twitter: {
    title: "mumbl privacy",
    description: "Private dumps stay private. Anonymous team reads stay anonymous. Mumbl does not read Slack channel history.",
  },
};

const promises = [
  "we do not read Slack channel history",
  "we do not track presence, lurkers, or who opened a room",
  "we do not show Slack identity on anonymous team reads",
  "we do not build manager dashboards or individual analytics",
];

export default function PrivacyPage() {
  return (
    <section className="mission-view">
      <div className="mission-hero">
        <div className="mission-hero-copy">
          <p className="eyebrow">privacy</p>
          <h1>private first, anonymous where it matters.</h1>
          <p>
            Mumbl is built for thoughts that need a safer place to become useful. Private dumps stay private. Team reads
            are published only when someone chooses to publish them.
          </p>
        </div>

        <aside className="mission-note" aria-label="mumbl privacy promise">
          <span>the short version</span>
          <strong>if it would make people feel watched, scored, or quietly measured, it does not belong in Mumbl.</strong>
        </aside>
      </div>

      <div className="mission-beliefs" aria-label="mumbl privacy basics">
        <article className="mission-belief">
          <h2>what we store</h2>
          <p>
            Mumbl stores the private dumps, field-note drafts, room posts, reactions, and account details needed to make
            the product work. For Slack, Mumbl stores installation records, connected Slack user ids, and only the Slack
            message text someone explicitly saves.
          </p>
        </article>
        <article className="mission-belief">
          <h2>what we do not do</h2>
          <p>
            Mumbl does not read Slack channel history, monitor Slack presence, collect member lists for analytics, or
            track who quietly opens a room. Anonymous posts do not store display names.
          </p>
        </article>
        <article className="mission-belief">
          <h2>Slack permissions</h2>
          <p>
            The core Slack app uses slash commands and basic user profile/email scopes to connect explicit user actions
            to Mumbl. Optional team-read posting asks for write/private-channel permissions only when a room creator
            chooses to create a Slack reads channel.
          </p>
        </article>
      </div>

      <div className="mission-promises" aria-label="mumbl privacy promises">
        <p>the line</p>
        <div>
          <strong>Mumbl is not a surveillance layer on top of work.</strong>
          {promises.map((promise) => (
            <span key={promise}>{promise}</span>
          ))}
        </div>
      </div>

      <div className="mission-split">
        <article className="mission-statement">
          <span>your choices</span>
          <p>
            You choose what becomes a team read. You choose whether a team read is anonymous or published with a handle.
            You choose whether a Mumbl room mirrors published reads into Slack.
          </p>
        </article>

        <div className="mission-proof">
          <p>
            If you want data removed or have a privacy question, email{" "}
            <a href="mailto:mumbl.wtf@gmail.com">mumbl.wtf@gmail.com</a>.
          </p>
          <p>
            This page is a practical beta privacy note, not legal theater. It will become a fuller policy before broad
            public distribution.
          </p>
        </div>
      </div>

      <div className="mission-closing">
        <h2>keep the room human.</h2>
        <p>That is the product promise and the privacy model.</p>
        <Link className="solid-button button-link" href="/">
          back to mumbl
        </Link>
      </div>
    </section>
  );
}
