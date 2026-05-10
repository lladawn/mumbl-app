import { getExploreSummary } from "../../src/server/explore";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "explore",
  description: "aggregate culture pulse from public mumbl spaces. no individual posts, no names, just the week taking shape.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "mumbl explore",
    description: "what engineering teams are collectively mumbling this week.",
    url: "/explore",
  },
  twitter: {
    title: "mumbl explore",
    description: "what engineering teams are collectively mumbling this week.",
  },
};

export default async function ExplorePage() {
  let explore;
  let error = "";
  try {
    explore = await getExploreSummary();
  } catch (caughtError) {
    error = caughtError.message || "couldn't read the public pulse yet.";
  }

  return (
    <section className="explore-view">
      <div className="explore-header">
        <p className="eyebrow">mumbl explore</p>
        <h1>what engineering teams are mumbling this week.</h1>
        <p>
          aggregate themes from public spaces. no individual posts, no names, no space names unless teams opt in.
        </p>
      </div>

      {error ? (
        <div className="panel">
          <h2>public pulse is offline.</h2>
          <p className="panel-copy">{error}</p>
        </div>
      ) : (
        <>
          <div className="explore-pulse">
            <h2>culture pulse</h2>
            <p>{explore.culturePulse}</p>
          </div>
          <div className="explore-themes">
            <ThemeCard title="top rant topic" value={explore.topRantTheme} />
            <ThemeCard title="most reacted win type" value={explore.topWinTheme} />
            <ThemeCard title="loudest day" value={explore.mostActiveDay} />
          </div>
        </>
      )}
    </section>
  );
}

function ThemeCard({ title, value }) {
  return (
    <article className="heartbeat-card digest">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  );
}
