export default function RoomVibeBar({ labels = [] }) {
  return (
    <div className="room-vibe-bar" aria-label="today's room vibe">
      <span>today's room vibe</span>
      <strong>{labels.length ? labels.join(" / ") : "waiting for the first reaction"}</strong>
    </div>
  );
}
