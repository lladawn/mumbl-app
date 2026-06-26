import Link from "next/link";

export const metadata = {
  title: "mission",
  description:
    "Why mumbl exists: anonymous-first team rooms for the small honest moments that make work feel human.",
  alternates: { canonical: "/mission" },
  openGraph: {
    title: "mumbl mission",
    description: "A room where the thing you almost kept to yourself can become something the team carries together.",
    url: "/mission",
  },
  twitter: {
    title: "mumbl mission",
    description: "A room where the thing you almost kept to yourself can become something the team carries together.",
  },
};

const beliefs = [
  {
    title: "anonymous is the floor",
    copy:
      "no signup for v1. no member count. no quiet list of lurkers. if someone opens the link, they are in. the room belongs to the posts, not the people being watched.",
  },
  {
    title: "the team gets the room back",
    copy:
      "mumbl should not be a place where people pour thoughts into a void. every week, the heartbeat gives the week back to everyone who lived it.",
  },
  {
    title: "ordinary days count",
    copy:
      "a win is beautiful, but most work is the strange run of days between wins. the tiny rant, the weird find, the joke that only your team understands. that is culture.",
  },
];

const promises = [
  "no secret manager room",
  "no public wall of private posts",
  "no tracking who peeked in",
  "no wellness theater",
];

const memoryLines = [
  "Slack saves messages. Docs save decisions. Tickets save tasks.",
  "Mumbl saves the thinking in between: the wrong turns, the quiet concern, the lesson behind a weird week.",
  "The useful parts can become team reads. The rest can stay private.",
];

export default function MissionPage() {
  return (
    <section className="mission-view">
      <div className="mission-hero">
        <div className="mission-hero-copy">
          <p className="eyebrow">why mumbl exists</p>
          <h1>work is where you spend your life.</h1>
          <p>
            the right people make it feel like play. mumbl gives the human side of work somewhere to go: private dumps,
            team reads, and heartbeats for the thoughts that usually die in standup, side chats, or your own head.
          </p>
        </div>

        <aside className="mission-note" aria-label="mumbl mission note">
          <span>the promise</span>
          <strong>
            a room where the thing you almost kept to yourself can become something the team carries together.
          </strong>
        </aside>
      </div>

      <div className="mission-split">
        <article className="mission-statement">
          <span>mumbl is for the moment when</span>
          <p>
            someone says the half-formed thing, the tired thing, the funny thing, the thing that felt too small for a
            meeting, and the room quietly answers: yeah, us too.
          </p>
        </article>

        <div className="mission-proof">
          <p>
            not a survey. not a sentiment graph. not a place for management to stare at people through numbers.
          </p>
          <p>
            a living team room. anonymous first. built for engineers who have things to say, but do not always want to
            perform the saying.
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
          <span>the heartbeat promise</span>
          <h2>the week your team had together, named and given back.</h2>
        </div>
        <p>
          heartbeats are for the team, not management. they should feel like a sharp teammate read the room and said the
          useful thing out loud: what felt heavy, what was funny, what mattered, and one tiny nudge that might make next
          week less weird.
        </p>
      </div>

      <div className="mission-promises" aria-label="the line mumbl does not cross">
        <p>the line we do not cross</p>
        <div>
          <strong>if it makes people feel watched, scored, or managed, it stays out.</strong>
          {promises.map((promise) => (
            <span key={promise}>{promise}</span>
          ))}
        </div>
      </div>

      <div className="mission-closing">
        <h2>friendship is not a perk.</h2>
        <p>
          it is the difference between enduring work and actually living some of your life inside it. mumbl exists for
          the tiny honest moments that help people find each other.
        </p>
        <Link className="solid-button button-link" href="/create">
          create a room
        </Link>
      </div>
    </section>
  );
}
