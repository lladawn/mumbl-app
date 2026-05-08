import { makeHeartbeat } from "../../lib/heartbeat";

export default function HeartbeatView({ space }) {
  const heartbeat = space.heartbeats[0] || makeHeartbeat(space);

  return (
    <>
      <div className="heartbeat-note">
        <span>generated every monday</span>
        <span>anonymous data only</span>
        <span>for the team, not management</span>
      </div>
      <div className="heartbeat-stack">
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
    </>
  );
}
