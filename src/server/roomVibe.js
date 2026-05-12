export function getTopReactionLabels(reactions, limit = 3) {
  const counts = new Map();
  for (const reaction of reactions || []) {
    counts.set(reaction.label, (counts.get(reaction.label) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label]) => label);
}

export function startOfTodayIso() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}
