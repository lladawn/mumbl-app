import Link from "next/link";

export const metadata = {
  title: "vision",
  description:
    "Mumbl exists to surface the human layer of work: the reasoning, taste, and growth that never makes it into a ticket, and to give people back the realest data they have — how they actually think.",
  alternates: { canonical: "/vision" },
  openGraph: {
    title: "mumbl vision",
    description: "The human layer of work — the thinking, taste, and growth that never makes it into a ticket. Mumbl surfaces it.",
    url: "/vision",
  },
  twitter: {
    title: "mumbl vision",
    description: "The human layer of work — the thinking, taste, and growth that never makes it into a ticket. Mumbl surfaces it.",
  },
};

const beliefs = [
  {
    title: "your thinking is real data — about you",
    copy:
      "the reasoning, taste, and growth inside your work used to vanish the moment it happened. technology can finally hold it. mumbl captures that layer and gives it back to the person who made it, so you can see how you actually think and how far you have come.",
  },
  {
    title: "one sentence is enough",
    copy:
      "the habit is near zero friction. catch a thought the moment it appears, one rough line at a time. it is not one more thing to do — it is the small act of putting your own thinking into words, which is where thinking gets sharper and people grow.",
  },
  {
    title: "the team gets the layer back",
    copy:
      "what starts as a private line compounds. the reasoning, the patterns, the way a week actually felt — it returns to the people who lived it, until the team can see how it really thinks over time.",
  },
];

const memoryLines = [
  "Slack saves messages. Docs save decisions. Tickets save tasks. Code saves the result.",
  "None of them save the human layer: the reasoning, the taste, the rejected options, the gut calls, the way a person actually grows through the work.",
  "Mumbl saves that layer — and over time, it becomes a living record of how you and your team really think.",
];

export default function MissionPage() {
  return (
    <section className="mission-view">
      <div className="mission-hero">
        <div className="mission-hero-copy">
          <p className="eyebrow">the vision</p>
          <h1>the human layer of work.</h1>
          <p>
            every team runs on a layer no tool captures: the reasoning, the taste, the rejected options, the
            way people actually think and grow through their work. it never makes it into a ticket or a PR. it
            lives in heads and DMs, and it walks out the door when people do. mumbl exists to surface that layer
            in every kind of work — and to give people back the realest data they have: how they actually think.
          </p>
        </div>

        <aside className="mission-note" aria-label="mumbl vision note">
          <span>the bet</span>
          <strong>
            the original thinking and growth happening inside work is the biggest data we are throwing away. mumbl
            is where it stops getting lost — and starts coming back to you.
          </strong>
        </aside>
      </div>

      <div className="mission-split">
        <article className="mission-statement">
          <span>mumbl is for the thinking that</span>
          <p>
            never survives the work: the half-formed insight, the tradeoff you felt before you could prove it, the
            lesson a hard week taught you, the reason you chose the boring thing. the part that makes you you, and
            makes a team a team.
          </p>
        </article>

        <div className="mission-proof">
          <p>
            more and more, thinking is something we hand off and forget. the answer arrives, the reasoning never
            forms, and nothing is left to look back on.
          </p>
          <p>
            mumbl is the quiet counterweight: a place where putting one honest thought into words stays yours,
            compounds, and turns into a layer of human context no other tool holds.
          </p>
        </div>
      </div>

      <div className="mission-memory" aria-label="what mumbl saves">
        {memoryLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <div className="mission-beliefs" aria-label="mumbl beliefs">
        {beliefs.map((belief) => (
          <article className="mission-belief" key={belief.title}>
            <h2>{belief.title}</h2>
            <p>{belief.copy}</p>
          </article>
        ))}
      </div>

      <div className="mission-heartbeat">
        <div>
          <span>where this is going</span>
          <h2>slack is where it starts. the layer is bigger than any one tool.</h2>
        </div>
        <p>
          we begin in Slack because that is where the thought first appears — a rough line the moment context
          shows up. but the human layer lives in every kind of work, not just engineering and not just chat. what
          we are building is the place that layer goes, wherever the work happens. this is the first step of a much
          longer one.
        </p>
      </div>

      <div className="mission-closing">
        <h2>the people are the product.</h2>
        <p>
          tools have captured the output of work for decades. the thinking behind it — the part that actually grows
          people and teams — has had nowhere to go. mumbl is where it finally does.
        </p>
        <Link className="solid-button button-link" href="/api/slack/install">
          add mumbl to slack
        </Link>
      </div>
    </section>
  );
}
