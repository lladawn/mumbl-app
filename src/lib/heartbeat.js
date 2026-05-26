import { vibes } from "./constants";

export function makeHeartbeat(space) {
  const posts = space.posts || [];
  const wins = posts.filter((post) => post.type === "win").length;
  const rants = posts.filter((post) => post.type === "rant").length;
  const reactions = posts.reduce((sum, post) => sum + countReactions(post), 0);
  const vibeLabel = vibes[space.vibe]?.label || "chill & honest";

  if (!posts.length) {
    return {
      weekOf: "this week",
      vibeRead: `${vibeLabel} room, still mostly quiet - which is usually the moment before someone says the useful thing.`,
      digest:
        "the room is new, so the signal is still warming up. someone needs to go first, preferably with the kind of thought that would otherwise become a side DM. once one honest post lands, the reactions usually do the rest.",
      uplift:
        "drop one small true thing before sharing the link. doesn't need to be profound. it just needs to make the room feel real.",
    };
  }

  const vibeRead =
    rants > wins
      ? "rough edges showing, but the room is doing its job - the unsaid stuff is finally visible."
      : wins > rants
        ? "surprisingly solid week - not perfect, but there is real momentum in here."
        : "mixed week, honest signal - some friction, some wins, and enough reactions to know people are listening.";

  const digest = `this week had ${posts.length} mumbl${posts.length === 1 ? "" : "s"} and ${reactions} reaction${reactions === 1 ? "" : "s"}, which is already more signal than a dead random channel. ${
    rants ? "a few rough edges made it into the open, which is the point." : "not much venting yet, suspiciously peaceful."
  } ${
    wins ? "there were wins too, so the room did not become a complaint bucket with furniture." : "wins are still missing, and someone should probably fix that with one tiny brag."
  } overall: ${vibes[space.vibe]?.hint || "human, useful, honest"}.`;

  const uplift =
    rants > wins
      ? "pick one rant with reactions and ask a single follow-up in the feed. no meeting invite. just one useful question."
      : wins
        ? "someone reply to a win with the exact thing they appreciated. takes twenty seconds and lands better than a generic nice."
        : "react to one post you quietly agreed with. the lurkers are part of the signal too.";

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
