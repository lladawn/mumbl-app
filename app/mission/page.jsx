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
      "No signup for v1. No member count. No quiet list of lurkers. If someone opens the link, they are in. The room belongs to the posts, not the people being watched.",
  },
  {
    title: "the team gets the room back",
    copy:
      "Mumbl should not be a place where people pour thoughts into a void. Every week, the heartbeat gives the week back to everyone who lived it.",
  },
  {
    title: "ordinary days count",
    copy:
      "A win is beautiful, but most work is the strange run of days between wins. The tiny rant, the weird find, the joke that only your team understands. That is culture.",
  },
];

const promises = [
  "no manager-only dashboard",
  "no individual posts on explore",
  "no visitor, join, or lurker tracking",
  "no corporate wellness voice",
];

export default function MissionPage() {
  return (
    <section className="mission-view">
      <div className="mission-hero">
        <div className="mission-hero-copy">
          <p className="eyebrow">why mumbl exists</p>
          <h1>work is where you spend your life.</h1>
          <p>
            The right people make it feel like play. mumbl is a small room for the thoughts that usually die in standup,
            side chats, or your own head, and for the people who were hoping someone would say them first.
          </p>
        </div>

        <aside className="mission-note" aria-label="mumbl mission note">
          <span>the promise</span>
          <strong>
            A room where the thing you almost kept to yourself can become something the team carries together.
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
            Not a survey. Not a sentiment graph. Not a place for management to stare at people through numbers.
          </p>
          <p>
            A living team room. Anonymous first. Built for engineers who have things to say, but do not always want to
            perform the saying.
          </p>
        </div>
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
          Heartbeats are for the team, not management. They should feel like a sharp teammate read the room and said the
          useful thing out loud: what felt heavy, what was funny, what mattered, and one tiny nudge that might make next
          week less weird.
        </p>
      </div>

      <div className="mission-promises" aria-label="mumbl will not do these things">
        <p>the product line we keep</p>
        <div>
          {promises.map((promise) => (
            <span key={promise}>{promise}</span>
          ))}
        </div>
      </div>

      <div className="mission-closing">
        <h2>friendship is not a perk.</h2>
        <p>
          It is the difference between enduring work and actually living some of your life inside it. Mumbl exists for
          the tiny honest moments that help people find each other.
        </p>
        <Link className="solid-button button-link" href="/create">
          create a space
        </Link>
      </div>
    </section>
  );
}
