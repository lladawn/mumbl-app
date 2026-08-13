/**
 * What the receptionist says.
 *
 * Deliberately not a model. A booking link is a public URL that strangers open
 * to do one small chore, so the character comes from written lines rather than
 * generation: no per-visitor API cost, no prompt-injection surface, and no way
 * to invent a time that is not really open.
 *
 * Variation comes from a per-visit seed, so the desk feels staffed rather than
 * scripted, but the same visit never reshuffles under someone mid-sentence.
 */

export type ReceptionistState =
  | "greeting"
  | "chooseDay"
  | "chooseTime"
  | "details"
  | "submitting"
  | "confirmed"
  | "taken"
  | "empty"
  | "error";

type LineVars = {
  hostName?: string;
  officeName?: string;
  duration?: number;
  day?: string;
  time?: string;
};

const LINES: Record<ReceptionistState, string[]> = {
  greeting: [
    "Hey — you're after {hostName}, right? Let me see what's still open.",
    "Welcome to {officeName}. I keep {hostName}'s diary. Grab a seat.",
    "Afternoon. {hostName} is heads-down, but I can put you in the book.",
    "Hi there. {duration} minutes with {hostName} — I can sort that now.",
  ],
  chooseDay: [
    "These are the days with room in them. Pick one.",
    "Here's what's free. Anything jump out?",
    "{hostName} is open on these. Which suits you?",
  ],
  chooseTime: [
    "Good day for it. What time works?",
    "{day} it is. Here's what's left.",
    "Right — {day}. Pick your hour.",
  ],
  details: [
    "Last bit: who should I write down?",
    "{time} on {day}. Just need a name and where to send the invite.",
    "Nearly there. Name and email and I'll put it in ink.",
  ],
  submitting: ["Writing it in…", "One moment, putting it in the book…", "Holding that slot…"],
  confirmed: [
    "Done — you're in the book. The invite's on its way.",
    "Booked. {hostName} will see you {day} at {time}.",
    "That's yours. Check your inbox for the invite.",
  ],
  taken: [
    "Ah — someone took that one while we were talking. Pick another?",
    "That slot just went. Sorry. Here's what's still open.",
    "Gone, just now. Try one of these instead.",
  ],
  empty: [
    "Nothing open in this stretch, I'm afraid. Try looking further out.",
    "The book's full through here. Want me to look further ahead?",
    "No room this fortnight. Further out?",
  ],
  error: [
    "Something jammed on my end. Give it another go?",
    "That didn't take. Mind trying once more?",
  ],
};

/** Ambient one-liners the receptionist says while nobody is picking anything. */
const IDLE_ASIDES = [
  "The plant's fake. Don't tell anyone.",
  "Kettle's on if this takes a minute.",
  "That desk lamp has outlasted three laptops.",
  "Quiet week. Suspiciously quiet.",
  "I've never once seen {hostName} use the front door.",
];

export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function receptionistLine(state: ReceptionistState, seed: number, vars: LineVars = {}): string {
  const pool = LINES[state] || LINES.greeting;
  return fill(pool[pick(seed, state, pool.length)], vars);
}

export function idleAside(seed: number, index: number, vars: LineVars = {}): string {
  return fill(IDLE_ASIDES[(seed + index * 7) % IDLE_ASIDES.length], vars);
}

/**
 * Stable per (seed, state): re-rendering the same step must not swap the line
 * out from under someone who is mid-read.
 */
function pick(seed: number, state: string, length: number): number {
  let hash = seed;
  for (let i = 0; i < state.length; i += 1) {
    hash = (hash * 31 + state.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function fill(line: string, vars: LineVars): string {
  return line.replace(/\{(\w+)\}/g, (match, key: keyof LineVars) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}
