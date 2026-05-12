export default function DailyPromptCard({ prompt, activePromptId, onRespond, onSkip, onShuffle }) {
  if (!prompt) return null;
  const isActive = activePromptId === prompt.id;
  const label = prompt.isShuffled ? "daily mumbl · shuffled" : "daily mumbl";

  return (
    <section className={"daily-prompt-card " + (isActive ? "active" : "")} aria-label="daily mumbl prompt">
      <div>
        <span>{label}</span>
        <p>{prompt.text}</p>
      </div>
      <div className="daily-prompt-actions">
        <button className="ghost-button" type="button" onClick={onShuffle} disabled={isActive}>
          shuffle
        </button>
        {isActive ? (
          <button className="ghost-button" type="button" onClick={onSkip}>
            skip
          </button>
        ) : (
          <button className="solid-button" type="button" onClick={onRespond}>
            answer
          </button>
        )}
      </div>
    </section>
  );
}
