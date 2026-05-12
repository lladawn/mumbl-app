const THEME_KEYWORDS = [
  ["sprint planning", ["sprint", "planning", "estimate", "points"]],
  ["deployment anxiety", ["deploy", "release", "rollback", "prod"]],
  ["test suite weather", ["test", "ci", "flaky", "pipeline", "build"]],
  ["unclear requirements", ["requirements", "spec", "ticket", "scope"]],
  ["tiny wins", ["win", "shipped", "fixed", "finally", "done"]],
];

export function makeHeartbeatCardFields({ heartbeat, posts, reactions }) {
  const topTheme = topThemeFor(posts);
  const energyLevel = energyScore(posts, reactions);
  const vibeWord = vibeWordFor(heartbeat.vibeRead, energyLevel);
  const cardLine = cardLineFor({ vibeWord, topTheme, posts });

  return { vibeWord, topTheme, energyLevel, cardLine };
}

function topThemeFor(posts) {
  if (!posts.length) return "quiet signal";
  const scores = new Map(THEME_KEYWORDS.map(([theme]) => [theme, 0]));
  for (const post of posts) {
    const content = (post.type + " " + post.content).toLowerCase();
    for (const [theme, keywords] of THEME_KEYWORDS) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        scores.set(theme, scores.get(theme) + 1);
      }
    }
  }
  const [theme, count] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return count ? theme : "general work weather";
}

function energyScore(posts, reactions) {
  if (!posts.length) return 24;
  const postSignal = Math.min(posts.length * 12, 60);
  const reactionSignal = Math.min((reactions?.length || 0) * 4, 35);
  return Math.max(12, Math.min(96, postSignal + reactionSignal));
}

function vibeWordFor(vibeRead, energyLevel) {
  const text = (vibeRead || "").toLowerCase();
  if (text.includes("heavy") || text.includes("rough")) return "heavy";
  if (text.includes("quiet")) return "quiet";
  if (text.includes("solid") || text.includes("momentum")) return "solid";
  if (energyLevel > 74) return "loud";
  if (energyLevel < 34) return "quiet";
  return "alive";
}

function cardLineFor({ vibeWord, topTheme, posts }) {
  if (!posts.length) return "the room is quiet, but the door is open.";
  return vibeWord + " week, " + topTheme + " in the air, and enough signal to call it real.";
}
