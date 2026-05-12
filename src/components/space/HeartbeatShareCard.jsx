export default function HeartbeatShareCard({ heartbeat }) {
  return (
    <article className="heartbeat-share-card">
      <div className="heartbeat-share-card-topline">
        <span>mumbl heartbeat</span>
        <span>weekly card</span>
      </div>
      <strong>{heartbeat.vibeWord || "alive"}</strong>
      <p>{heartbeat.cardLine || heartbeat.vibeRead}</p>
      <div className="heartbeat-share-card-grid">
        <span>theme: {heartbeat.topTheme || "general work weather"}</span>
        <span>energy: {heartbeat.energyLevel ?? 50}/100</span>
      </div>
    </article>
  );
}
