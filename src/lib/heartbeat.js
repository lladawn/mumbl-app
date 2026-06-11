import { vibes } from "./constants";

export function makeHeartbeat(space) {
  const posts = space.posts || [];
  const reactions = posts.reduce((sum, post) => sum + countReactions(post), 0);
  const vibeLabel = vibes[space.vibe]?.label || "chill & honest";

  if (!posts.length) {
    return {
      weekOf: "this week",
      vibeRead: `${vibeLabel} room, no published team reads yet - still private, still forming.`,
      digest:
        "the heartbeat starts once the team publishes a few field notes. private dumps can stay private until someone decides a thread is useful enough to become team memory.",
      uplift:
        "save the honest version privately first. if a pattern keeps showing up, shape it into one field note and publish it when it feels ready.",
    };
  }

  const readCount = posts.length;
  const plural = readCount === 1 ? "read" : "reads";
  const vibeRead = `${vibeLabel} signal from ${readCount} published team ${plural} - enough to see what the team chose to remember.`;

  const digest = `this week had ${readCount} published team ${plural} and ${reactions} reaction${reactions === 1 ? "" : "s"}. that means the team did not just talk in the moment; someone saved the useful trail and let others read it back. overall: ${vibes[space.vibe]?.hint || "human, useful, honest"}.`;

  const uplift =
    reactions > readCount
      ? "pick the read people kept reacting to and name one small follow-up. no meeting ceremony. just make the useful part easier for the next person."
      : "publish one more field note from a private dump this week. the heartbeat gets sharper when the team has more chosen signal, not more noise.";

  return { weekOf: "this week", vibeRead, digest, uplift };
}

export function getReactionLabels(space, post) {
  const existing = Object.keys(post.reactions || {});
  const byType = {
    rant: ["i felt this", "therapy needed", "sending help"],
    win: ["legend", "we are not worthy", "ship it"],
    find: ["saving this", "same energy", "worth a look"],
    lol: ["deeply cursed", "same energy", "sending help"],
    dump: ["i felt this", "sat with this", "quietly true"],
    field_note: ["sat with this", "quietly true", "worth a reread"],
    thought: vibes[space.vibe].reactions,
  };
  return [...new Set([...(byType[post.type] || vibes[space.vibe].reactions), ...existing])].slice(0, 4);
}

export function countReactions(post) {
  return Object.values(post.reactions || {}).reduce((sum, reactionValue) => {
    return sum + (Array.isArray(reactionValue) ? reactionValue.length : reactionValue);
  }, 0);
}
