export const sampleSpace = {
  id: "demo",
  slug: "backend-gremlins",
  name: "backend gremlins",
  vibe: "gremlin",
  memberCount: 18,
  firstPostDone: true,
  posts: [
    {
      id: "p1",
      type: "rant",
      content: "sprint planning has become us politely pretending the tickets are smaller than they are.",
      isAnonymous: true,
      displayName: "",
      createdAt: Date.now() - 1000 * 60 * 34,
      reactions: {
        "i felt this": ["seed-a", "seed-b", "seed-c", "seed-d", "seed-e", "seed-f"],
        "therapy needed": ["seed-g", "seed-h"],
      },
    },
    {
      id: "p2",
      type: "win",
      content: "whoever rewired the flaky billing tests: the build has been green all morning and i am choosing peace.",
      isAnonymous: false,
      displayName: "r dev",
      createdAt: Date.now() - 1000 * 60 * 82,
      reactions: {
        "we are not worthy": ["seed-i", "seed-j", "seed-k", "seed-l"],
        legend: ["seed-m", "seed-n"],
      },
    },
    {
      id: "p3",
      type: "find",
      content: "tiny cli for replaying webhook payloads locally: saved me from inventing a worse version at 11pm.",
      isAnonymous: true,
      displayName: "",
      createdAt: Date.now() - 1000 * 60 * 180,
      reactions: {
        "same energy": ["seed-o", "seed-p"],
      },
    },
  ],
  heartbeats: [
    {
      weekOf: "this week",
      vibeRead: "heavy but alive - a lot got done and nobody is totally sure how.",
      digest:
        "the backend gremlins had one of those weeks where every small ticket revealed a hidden basement. planning took some heat, the test suite briefly became a main character, and one useful tool saved someone from making a questionable late-night decision. still, the reactions are loud in a good way: people are listening, laughing, and noticing the work.",
      uplift:
        "three people reacted to the planning rant and nobody replied. someone can drop a plain 'should we talk about this?' in the feed. not a meeting. just a question.",
    },
  ],
};
