import { makeHeartbeat } from "../../lib/heartbeat";
import HeartbeatShareCard from "./HeartbeatShareCard";

export default function HeartbeatView({ space }) {
  const heartbeats = space.heartbeats?.length ? space.heartbeats : [makeHeartbeat(space)];
  const heartbeat = heartbeats[0];
  const recentHeartbeats = heartbeats.slice(0, 4).reverse();

  return (
    <>
      <div className="heartbeat-note">
        <span>generated every monday</span>
        <span>anonymous data only</span>
        <span>for the team, not management</span>
      </div>
      <div className="heartbeat-stack">
        <HeartbeatShareCard heartbeat={heartbeat} />
        <a className="share-button primary heartbeat-image-link" href={`/r/${space.slug}/heartbeat-card`} target="_blank" rel="noreferrer">
          open image card
        </a>
        <article className="heartbeat-card vibe">
          <h3>vibe this week</h3>
          <p>{heartbeat.vibeRead}</p>
        </article>
        <article className="heartbeat-card digest">
          <h3>digest</h3>
          <p>{heartbeat.digest}</p>
        </article>
        <article className="heartbeat-card uplift">
          <h3>uplift</h3>
          <p>{heartbeat.uplift}</p>
        </article>
      </div>

      <div className="heartbeat-history">
        <div className="heartbeat-history-header">
          <h3>vibe over time</h3>
          <span>last {recentHeartbeats.length} week{recentHeartbeats.length === 1 ? "" : "s"}</span>
        </div>
        <div className="vibe-bars" aria-label="vibe over time">
          {recentHeartbeats.map((item) => (
            <div className="vibe-bar-wrap" key={item.id || item.weekOf}>
              <div className="vibe-bar" style={{ height: `${vibeScore(item)}%` }} />
              <span>{formatWeek(item.weekOf)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="heartbeat-history-list">
        {heartbeats.slice(0, 8).map((item) => (
          <article className="note-card" key={item.id || item.weekOf}>
            <h3>{formatWeek(item.weekOf)}</h3>
            <p>{item.vibeRead}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function vibeScore(heartbeat) {
  const text = `${heartbeat.vibeRead} ${heartbeat.digest}`.toLowerCase();
  if (text.includes("solid") || text.includes("momentum") || text.includes("good")) return 82;
  if (text.includes("heavy") || text.includes("rough") || text.includes("grind")) return 46;
  if (text.includes("quiet")) return 38;
  return 64;
}

function formatWeek(weekOf) {
  if (!weekOf || weekOf === "this week") return "now";
  return weekOf.slice(5).replace("-", "/");
}
