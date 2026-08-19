// Blog posts, data-driven so /blog and /blog/[slug] share one source.
// body: array of blocks — { type: "p", text } | { type: "quote", text, cite? }
// furtherReading (optional): [{ text, href }] — real sources, rendered as a
// small footer list. Only add links you've actually verified.

export const blogPosts = [
  {
    slug: "our-interfaces",
    title: "our interfaces",
    dek: "a world where opening your laptop feels less like operating a machine, and more like walking into one.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "Imagine a world where our interfaces are not text and blocks. Where they're visual, characters, spaces — just like the one mother nature already built for us. How much more intuitive would that be, if the thing we made to help us think looked and moved like the world we already know how to move through.",
      },
      {
        type: "p",
        text: "Not for the sake of a product or something. Just for the sake of imagining, together, a world we could actually live in.",
      },
      {
        type: "p",
        text: "You open your laptop. There's no keyboard between you and it — you talk, and it listens. A touch of a device becomes how you move: from one place to another, across a map of the tools you use, each one its own shop, its own workshop. You walk in. You tinker. You look up and see how many other people are in there with you — or, if you'd rather, you don't. Some days the room is yours alone.",
      },
      {
        type: "quote",
        text: "writing is such a meditative exercise. wow.",
      },
      {
        type: "p",
        text: "That's the kind of thought this world is built to hold — the small, true ones that pass through us while we're just doing the thing. Tinkering with whatever feature or utility a workshop hands you that day.",
      },
      {
        type: "p",
        text: "Doesn't that feel more intuitive than robotic? It isn't about making better cognitive choices. It's about staying cognitive while being creative — about never having to choose between the two.",
      },
      {
        type: "p",
        text: "Machines will always be better at computation than we are. What we're good at is creativity, and it's only when we're at our most creative that we have anything worth handing to the machines in the first place. That's the whole arc, from tally marks to calculators to software we now build by just talking to it. We got here by being creative about creativity itself — and there's so much further to go, bringing more of that into whatever we touch: our relationships, our work, all of it.",
      },
      {
        type: "p",
        text: "This is the age creativity is most needed, and most at risk. It can go down a road that flattens it, or it can take a balanced ride and end up somewhere genuinely new.",
      },
      {
        type: "p",
        text: "So here's the line we're trying to draw as we build: the deterministic tools — the ones that just do what you tell them — are the shops. Places you enter, choose, interact through. The ones that reason, that make their own calls, that can be trusted to just go and execute — those are characters. In the shop with you, or out on their own, mending with things while you're somewhere else entirely.",
      },
      {
        type: "p",
        text: "I don't fully know what this looks like once it's built. But I know what it should feel like — less like operating a machine, more like being somewhere. You open the laptop, and instead of a blank page asking what you want from it, there's a room waiting, already a little lived-in. You walk in. You work. Maybe someone else is there, maybe no one is. Either way, it should feel less like using a tool and more like showing up.",
      },
    ],
    closing: "— written while imagining, not specifying. more soon.",
  },
  {
    slug: "augmenting-not-automating",
    title: "augmenting, not automating",
    dek: "computers were never supposed to do our thinking for us. they were supposed to make room for more of it.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "In 1962, an engineer named Douglas Engelbart wrote a paper almost no one at the time knew what to do with. It was called \"Augmenting Human Intellect,\" and its central claim was almost embarrassingly simple: computers shouldn't do our thinking for us. They should make us capable of more of it.",
      },
      {
        type: "p",
        text: "Six years later, he proved it. In a single 90-minute live demo in San Francisco — now just called \"the mother of all demos\" — he showed a room of engineers the mouse, hypertext, real-time collaborative editing, video calling, and windows, all at once, a decade or two before any of it reached an actual desk. None of it replaced a person's judgment. It was built to get out of the way of it.",
      },
      {
        type: "p",
        text: "That distinction — augmenting versus automating — is easy to say and strangely hard to hold on to. Every real tool drifts, over time, toward doing more of the deciding for you. Not out of malice. Just because automating is easy to measure and augmenting isn't. It's much easier to sell \"this does the task\" than \"this makes you better at the task.\"",
      },
      {
        type: "p",
        text: "We went from tally marks to abacuses to slide rules to calculators to spreadsheets to compilers to models you can just talk to. Every step looks the same from a distance: something that used to take a whole mind now takes a fraction of one. What's easy to miss is that the freed-up fraction doesn't sit idle — it goes somewhere. The tools worth remembering are the ones that pointed it back at the part of the work only a person could do.",
      },
      {
        type: "p",
        text: "That's the bet underneath what we're building. Not a tool that thinks for you, and not a tool that just logs what you did after the fact. Something that hands the computation to the machine and leaves the deciding, the noticing, the \"wait, what if\" — the creative part — with you. The moment it starts doing that part too, it's stopped augmenting and started replacing. We'd rather notice that early than find out from the outside.",
      },
    ],
    closing: "engelbart didn't live to see most of what he predicted actually ship. we'd like to be a little faster about it.",
    furtherReading: [
      { text: "55 years ago, the 'Mother of All Demos' foresaw modern computing — OPB", href: "https://www.opb.org/article/2023/12/09/mother-of-all-demos-oregon-1968-computer-demonstration-douglas-engelbart/" },
      { text: "Did you use a mouse to get here? Thank Doug Engelbart — UC Berkeley", href: "https://grad.berkeley.edu/news/profiles/did-you-use-a-mouse-to-get-here-thank-doug-engelbart-for-that-and-more/" },
    ],
  },
  {
    slug: "the-layer-no-tool-saves",
    title: "the layer no tool saves",
    dek: "philosopher Michael Polanyi had a phrase for it: we can know more than we can tell.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "There's a phrase from a philosopher named Michael Polanyi that's been sitting with us. He wrote it in 1966, trying to explain something that sounds obvious once you hear it and is hard to shake afterward — that most of what we actually know, we can't fully put into words. You recognize a face in a crowd instantly and couldn't describe what made it recognizable if you tried. You know a piece of code is wrong before you can explain why. That gap between what we know and what we can say is what he called tacit knowledge.",
      },
      {
        type: "quote",
        text: "we can know more than we can tell.",
        cite: "Michael Polanyi, The Tacit Dimension (1966)",
      },
      {
        type: "p",
        text: "Every tool we use for work asks us to close that gap before it'll take us seriously. Write the ticket. Summarize the decision. Fill in the field. The tool doesn't want the knowing — it wants the telling, and only the part of the telling that fits its schema. So we compress. Weeks of reasoning become one line in a changelog. A hard call made on instinct becomes \"went with option B.\" The tool saves the output. The part that got you there has nowhere to go, so it stays in your head, and eventually walks out the door with you.",
      },
      {
        type: "p",
        text: "This isn't a complaint about bad tools. It's closer to a category problem. Tickets, docs, and chat threads were built to hold information — facts that stay true no matter who's saying them. Tacit knowledge isn't information. It's closer to a skill, and skills don't compress into fields.",
      },
      {
        type: "p",
        text: "We think that gap is worth building for directly, instead of working around it. Not by asking people to explain their reasoning in more detail — that just moves the compression problem, it doesn't solve it. By making room for the rough, half-formed version of a thought to be worth something on its own, before anyone's turned it into a deliverable.",
      },
      {
        type: "p",
        text: "The team that gets this layer back isn't smarter than the one that doesn't. It just stops losing what it already knew.",
      },
    ],
    closing: "this is the oldest idea behind mumbl, dressed in a name we didn't invent.",
    furtherReading: [
      { text: "Michael Polanyi and tacit knowledge — infed.org", href: "https://infed.org/dir/welcome/michael-polanyi-and-tacit-knowledge/" },
      { text: "Polanyi's paradox — Wikipedia", href: "https://en.wikipedia.org/wiki/Polanyi%27s_paradox" },
    ],
  },
  {
    slug: "forty-seven-seconds",
    title: "forty-seven seconds",
    dek: "in 2004, the average person could hold attention on one task for two and a half minutes. a researcher has been timing us with a stopwatch ever since.",
    date: "2026-08-20",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "In 1973, a historian named Charles Weiner sat with Richard Feynman going through boxes of the physicist's old working notebooks — pages of half-finished equations, dead ends, ideas crossed out mid-line. Trying to pay a compliment, Weiner called them a wonderful record of how Feynman thought. Feynman shut that down immediately.",
      },
      {
        type: "quote",
        text: "They aren't a record of my thinking process. They are my thinking process.",
        cite: "Richard Feynman, to Charles Weiner, 1973 — quoted in James Gleick's Genius",
      },
      {
        type: "p",
        text: "Weiner pushed back, reasonably — surely the actual thinking happened in his head, and the notebook just kept score afterward. Feynman wouldn't give him that either. \"No, it's not a record, not really,\" he said. \"It's working. You have to work on paper, and this is the paper.\"",
      },
      {
        type: "p",
        text: "Most of us treat a rough draft as scaffolding — something you clear away once the real, finished thing exists underneath it. Feynman is telling Weiner there was no finished thing hiding behind the scratch marks, waiting patiently to be copied out clean. The scratch marks were the whole event. Take away the paper and the thinking doesn't relocate somewhere else and happen anyway. It just doesn't happen.",
      },
      {
        type: "p",
        text: "A century earlier, a very different kind of mind arrived at almost the same place from the opposite direction. Charles Darwin ran his working life on a schedule so exact that his son Francis eventually wrote it down like a liturgy: up by seven, in the study by eight for ninety minutes, then the morning's letters, then back to real work until noon — at which point Darwin would announce, \"I've done a good day's work,\" and leave for a long walk. Add it up and it's about four hours of actual work a day. Four hours produced On the Origin of Species. Darwin wasn't lazy, and by every account he wasn't especially quick. He seems to have understood, from the structure side of things, exactly what Feynman understood from the paper side: that the kind of thinking which actually moves an idea forward shows up in a narrow, protected, unhurried window, and that window is in short supply. You don't get more of it by demanding more hours. You get more of it by guarding the ones you have.",
      },
      {
        type: "p",
        text: "It's worth knowing what's happened to that window since Darwin's day. In 2004, a researcher named Gloria Mark — now a Chancellor's Professor at UC Irvine — started literally timing people with a stopwatch: how long, on average, could someone stay on one task before switching to something else? Two and a half minutes. She kept measuring, year after year, study after study. By 2012 it was 75 seconds. Her most recent field data puts it at 47 seconds. Not because attention itself got worse — because almost everything in a knowledge worker's environment is now built, on purpose, to interrupt it before the 47 seconds are up.",
      },
      {
        type: "p",
        text: "And the cost isn't the interruption itself. It's what comes after. Mark's research found that once you're pulled out of a task, it takes an average of 23 minutes and 15 seconds to return to the depth of focus you were at before — not to reopen the file, to actually get your thinking back to where it was. Set that next to a 47-second attention span and the arithmetic simply stops closing. There isn't enough day left for the state Darwin built his entire schedule around protecting, or the one Feynman needed a blank page to enter.",
      },
      {
        type: "p",
        text: "This is the thing we're actually trying to protect. Not productivity — Darwin worked four hours and it was enough. Not focus as a virtue in itself — Feynman wasn't disciplined, he was just honest about where his physics actually lived. What we're building is a place for the version of a thought that exists in the 47 seconds before something interrupts it: the half-sentence, the wrong equation, the thing you'd never put in a ticket because it isn't finished yet and might be wrong. Almost every tool we use waits for you to clean that up first. In a world that charges 23 minutes and 15 seconds to get back to where you were, waiting is how most of it quietly disappears before it's ever written down.",
      },
      {
        type: "p",
        text: "Feynman kept notebooks until the year he died, and nobody made him. He wasn't archiving himself for a historian — Weiner had to talk his way into even seeing them. He kept them because that was genuinely where the physics happened, and even a person doing some of the most important thinking of the twentieth century still needed somewhere to put the parts of it that weren't finished. That's a strange thing for a genius to need. It's probably exactly what the rest of us need too.",
      },
    ],
    closing: "no number in this one is invented. sources below.",
    furtherReading: [
      { text: "The Feynman Notebook Method — Cal Newport", href: "https://calnewport.com/the-feynman-notebook-method/" },
      { text: "Darwin's Daily Routine — Maria Popova, The Marginalian", href: "https://www.themarginalian.org/2013/05/10/charles-darwin-daily-routine/" },
      { text: "Attention Span — Gloria Mark", href: "https://gloriamark.com/attention-span/" },
    ],
  },
  {
    slug: "your-work-has-a-shape",
    title: "your work has a shape",
    dek: "office-sim meets real work: a live pixel office that assembles itself from whatever you're actually doing, not what you say you did.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "Every tool at your job asks the same dumb question at the end of the day: what did you do? And every answer is a lie by omission, because the honest version is messier than a ticket status. You didn't \"complete PROJ-441.\" You spent forty minutes stuck, switched to Figma because your brain needed a different kind of stuck, came back, fixed it in six minutes, and then took a call you'd forgotten was even on your calendar.",
      },
      {
        type: "p",
        text: "That whole shape — the switching, the drift, the pockets of actual focus — is the real texture of a day, and no single tool captures it, because no tool watches across the boundary of itself. Slack knows what happened in Slack. GitHub knows what happened in GitHub. Nothing knows what happened between them, which is most of where your day actually went.",
      },
      {
        type: "p",
        text: "So that's what we built: something that watches the boundary instead of any one app. A small menubar helper notices which app has your attention right now — Figma, VS Code, a Zoom call — and every tool we connect (Claude Code, GitHub, eventually Spotify) fires the same kind of ping: I'm doing X right now. Those pings land in one place, and a pixel office builds itself out of them. A coding desk shows up because you're coding. A record player starts spinning because Spotify's on. A meeting room lights up because you're on a call. Nobody designs their office. It just shows up, shaped like whatever you actually did — which is why no two people's offices ever look the same.",
      },
      {
        type: "p",
        text: "Most of the build wasn't drawing pixel furniture. It was noticing that three things we'd already shipped for unrelated reasons — a walkable multi-agent office we'd built for a different demo, an ingest pipe that already had encryption and auth wired through it, a server-rendered share-card generator — were secretly the same pipe wearing three different hats. The furniture is the fun part. The plumbing is the actual work, and it was mostly already lying around.",
      },
      {
        type: "p",
        text: "One click turns your office into a card you can post: the vibe of your day, which rooms lit up, how busy it looks, not one word of what you actually typed. It's the Spotify Wrapped comparison people reach for immediately, and it's a decent one — except this isn't once a year and curated, it's right now and honest, which is a stranger and slightly more exposing thing to share.",
      },
      {
        type: "p",
        text: "It isn't fully live yet. Check your own office today and you're probably looking at the mock version, because we haven't flipped real data on for anyone outside the people building it. That part's next, not later. But the self-assembly is real now, for real events, the moment something's pointed at them — and that had to be true before any of the rest of this was worth talking about.",
      },
    ],
    closing: "a dashboard tells you what happened. an office lets you feel like you were there.",
  },
];

export function getBlogPost(slug) {
  return blogPosts.find((post) => post.slug === slug) || null;
}
