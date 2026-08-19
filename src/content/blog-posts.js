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
    slug: "a-room-not-a-dashboard",
    title: "a room, not a dashboard",
    dek: "the research on workplace monitoring is consistent: watched people don't work better, they just get better at looking watched.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "In 2023 and 2024, a strange arms race broke out in corporate offices. Companies rolled out monitoring software to check whether hybrid employees were actually at their keyboards. Employees responded with mouse jigglers — small devices, some shaped like a USB stick with a tiny motor inside, whose entire job is to nudge a cursor just enough to keep a status light green. One major US bank fired more than a dozen people for using them. It made international news, which tells you roughly how many people were doing it.",
      },
      {
        type: "p",
        text: "The instinct behind the monitoring software is understandable. If you can't see the work, how do you know it's happening? But a study covered by Harvard Business Review on the actual effect of covert monitoring found close to the opposite of what employers hoped: employees who were secretly monitored were more likely to take unapproved breaks, ignore instructions, damage equipment, and deliberately slow down. Watching people doesn't make them work better. It makes them start managing how they look, which is a different job from the one they were hired for.",
      },
      {
        type: "p",
        text: "We kept coming back to that while building the part of mumbl that shows what your agents — and eventually your team — are actually doing. The easy version of that feature is a dashboard: rows, statuses, uptime, a productivity number ticking somewhere in the corner. It's also the version that turns into exactly the thing people spend their energy quietly defeating.",
      },
      {
        type: "p",
        text: "So we didn't build a dashboard. We built a room. The difference sounds cosmetic and isn't. A dashboard exists to be watched — that's its whole design brief, optimized for the watcher. A room exists to be inhabited — its whole design brief is what it's like from inside. You can glance into a room the same way you'd glance up from your desk to see who's around, and just as easily not. Nothing in a room is trying to compress you into a metric, because rooms don't have metrics. They have people in them, doing things.",
      },
      {
        type: "p",
        text: "Practically, that meant real constraints, not just a coat of paint: what's visible is shape, not content — that someone's on a call, not what's being said in it. Activity that isn't actively happening doesn't get remembered forever by default. And the moment any of this starts reading as \"quietly measuring people,\" it stops being what we're building.",
      },
    ],
    closing: "surveillance and visibility get confused constantly. we're trying to build the second one.",
    furtherReading: [
      { text: "Bosses are striking back at workers who use mouse jigglers — CNN Opinion", href: "https://www.cnn.com/2024/06/26/opinions/bossware-wells-fargo-mouse-jiggler-yang" },
      { text: "Hybrid work hack: mouse jigglers fool employee monitoring software — South China Morning Post", href: "https://www.scmp.com/lifestyle/gadgets/article/3267209/hybrid-work-hack-mouse-jigglers-fool-employee-monitoring-software-bosses-fight-back" },
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
  {
    slug: "shape-not-content",
    title: "shape, not content",
    dek: "we could show your coworkers exactly what you typed today. we decided not to, and the product got better because of it, not worse.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "We could build a version of this that shows your coworkers exactly what you typed today — which tabs you had open, how many minutes you lost to Twitter before getting back to work. Plenty of software already does exactly that, and companies buy it. I think it's a mistake before you even get to the ethics of it. It makes worse software.",
      },
      {
        type: "p",
        text: "The rule we set for ourselves early was: capture shape, never content. The office knows you're \"in Figma.\" It doesn't know what's on the canvas. It knows you're \"on a call.\" It doesn't know who with or what about. There's one function in the codebase — `redactForPublic` — and every byte of data that's ever shown to another person has to pass through it. Its entire job is refusing to let a task description, a file name, or a URL anywhere near a card someone else can see.",
      },
      {
        type: "p",
        text: "The obvious objection is that this makes the product weaker. Less \"insight.\" Less useful to a manager who actually wants to know what happened. I used to half-believe that myself. Then I paid attention to what happens on teams that ship the content version of this: people start managing how their activity looks instead of doing the work. They fake presence. Mouse jigglers exist as a whole product category for exactly this reason. The manager ends up with a very precise picture of nothing real, because everyone in it is optimizing for the picture.",
      },
      {
        type: "p",
        text: "Shape doesn't have that failure mode, because there's nothing in it worth gaming. You can't fake \"coding\" into looking like \"coding, but more impressively\" — there's no score, just a room that's lit or it isn't. That's the part I didn't expect going in: the privacy constraint wasn't a tax we paid to feel good about the product. It's the reason the product doesn't collapse into the thing everyone already hates.",
      },
      {
        type: "p",
        text: "The same logic runs all the way down the stack. Events expire after fifteen minutes by default — the office shows you now, not a permanent record someone could screenshot and hold against you six months later. History is opt-in and off unless you explicitly turn it on. None of this is because we're precious about privacy as a brand value. It's because the second this starts remembering everything, it stops being a room you walk into and starts being a room you're careful in. Those are two different products, and only one of them was worth building.",
      },
    ],
    closing: "if this constraint ever starts feeling like a limitation instead of the point, we've built it wrong.",
  },
  {
    slug: "the-browser-extension-we-didnt-build",
    title: "the browser extension we didn't build",
    dek: "everyone's first idea for this is a browser extension. mine too. it's also wrong, and it took me embarrassingly long to admit that.",
    date: "2026-08-19",
    author: "Disha Agarwalla",
    body: [
      {
        type: "p",
        text: "Everyone's first idea for this is a browser extension, including mine. It's the easy answer — extensions are simple to ship, people already trust the install flow, and a big chunk of \"what tool am I using\" happens inside a browser tab anyway.",
      },
      {
        type: "p",
        text: "It's also wrong for what we're building, and it took me embarrassingly long to admit that. A browser extension can see your tabs. It cannot see that you switched to Figma, or opened VS Code, or picked up a Zoom call — the actual moments that make up someone's day happen outside the browser about as often as inside it. Ship a browser extension and you've built a very good tracker for the forty percent of work that happens to run in Chrome. The other sixty percent just doesn't exist to your product.",
      },
      {
        type: "p",
        text: "The thing that can actually see across all of that is the operating system, not the browser. So the right shape for this is a small app that lives quietly in the menu bar and asks the OS exactly one question: which app just got focus? On a Mac that's a single system notification — `NSWorkspace.didActivateApplicationNotification` — and nothing scarier than that. No Accessibility permission, no reading window titles, no keystrokes. v1 doesn't even ask for the permission that would let it see more. That's on purpose, not a limitation we're apologizing for.",
      },
      {
        type: "p",
        text: "I looked hard at Electron before ruling it out, mostly because I already know it and shipping fast is a stronger pull than any architecture opinion. But this thing has to idle in your menu bar all day, every day, for as long as your laptop's open, and Electron's memory footprint for that job is indefensible — you'd be running an entire Chromium instance to notice that you alt-tabbed. Tauri gets almost the same web UI I'd have written for Electron anyway, wrapped around maybe a hundred lines of actual Rust doing the OS polling. Ten megabytes instead of a hundred and fifty, for a job that's ninety-five percent \"sit quietly and watch one system event.\"",
      },
      {
        type: "p",
        text: "The token that authenticates the helper lives in the OS keychain, not a config file sitting on disk, and it's the exact same ingest token the rest of the product already uses — no new auth system invented just for this one piece. Nothing leaves the machine until you've explicitly picked which apps you're willing to share. The default on install is silence.",
      },
      {
        type: "p",
        text: "It's sitting in the repo right now, compiling clean, not in anyone's hands yet. Shipping a menu-bar app that watches app-switching means Apple wants it signed and notarized before Gatekeeper lets a stranger run it, and that's a developer account and a process, not a code problem. It's the most boring blocker in the entire project, and also the only thing standing between \"it works on my machine\" and you actually being able to install it.",
      },
    ],
    closing: "the interesting engineering was already done by the time we got to the part everyone assumes is the hard part.",
  },
];

export function getBlogPost(slug) {
  return blogPosts.find((post) => post.slug === slug) || null;
}
