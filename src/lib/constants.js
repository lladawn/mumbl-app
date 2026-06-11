export const vibes = {
  chill: {
    label: "chill & honest",
    hint: "warm, direct, no theater",
    placeholder: "what's been sitting in your head all week?",
    reactions: ["i felt this", "same energy", "quietly true"],
  },
  chaotic: {
    label: "chaotic good",
    hint: "fast, funny, a little feral",
    placeholder: "okay hear me out...",
    reactions: ["same energy", "sending help", "deeply cursed"],
  },
  professional: {
    label: "professional-ish",
    hint: "measured, still human",
    placeholder: "something worth saying, minus the meeting...",
    reactions: ["fair point", "i felt this", "worth a look"],
  },
  gremlin: {
    label: "gremlin mode",
    hint: "dry, weird, useful",
    placeholder: "i need to say this somewhere safe...",
    reactions: ["therapy needed", "we are not worthy", "logging this as a bug"],
  },
};

export const postTypes = {
  thought: { label: "thought", hint: "half-formed take", placeholder: "okay hear me out..." },
  rant: { label: "rant", hint: "needs saying", placeholder: "i need to say this somewhere safe..." },
  win: { label: "win", hint: "brag or shoutout", placeholder: "okay i need to brag for one second..." },
  find: { label: "find", hint: "link, tool, paper", placeholder: "sharing something useful i found..." },
  lol: { label: "lol", hint: "work got weird", placeholder: "this just happened and i cannot..." },
  dump: { label: "dump", hint: "longer, messier, real", placeholder: "what are you actually thinking about right now?" },
  field_note: { label: "field note", hint: "drafted from dumps", placeholder: "the week, made readable..." },
};

export const validTabs = ["feed", "wins", "reads", "heartbeat"];

export const publicDemoRoom = {
  slug: "it-works-on-my-machine",
  name: "it works on my machine",
  href: "/r/it-works-on-my-machine/reads",
  tagline: "sample team reads for seeing what mumbl gives back.",
  description: "Public sample room. Read a few published team notes here; real team rooms stay private by default.",
};

export const feedbackRoom = {
  slug: "help-shape-mumbl",
  name: "help shape mumbl",
  href: "/r/help-shape-mumbl",
  tagline: "the public room for beta thoughts, tiny bugs, and sharp product wishes.",
  description:
    "this is the room for the version of mumbl that earns a place in your team. tell us what felt useful, what felt off, and what you actually want.",
};
