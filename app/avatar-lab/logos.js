// Logo candidates, drawn on a 16x16 icon grid.
//
// The grid is the point: pixel art is the brand, and 16x16 is the only size at
// which a favicon still has to work. Each candidate has to be legible as a
// silhouette first — you should know what it is before you can see any detail.
//
// legend
//   .  transparent      b  butter (brand fill)     d  deep brown (frame/ink)
//   h  hair             s  skin                    e  eye / line
//   t  teal shirt       p  periwinkle floor        c  cream
//   m  mint (the "done" dot)                       f  slate frame
//   g  screen blue

export const PALETTE = {
  b: "#F6D9A8",
  d: "#6B5334",
  h: "#4A382C",
  s: "#E3B48D",
  e: "#59696E",
  t: "#5FCBBC",
  p: "#C3CCE8",
  c: "#FFF8EC",
  m: "#7FC9A0",
  f: "#9FB3BE",
  g: "#BBDCF0",
};

// A — a speech bubble with someone in it. The name is about talking, the
// product is a room with people in it; this is both in one silhouette.
//
// Head only, no shoulders. At 16px the face is six pixels wide and has no
// visible chin, so any coloured band beneath it reads as a surgical mask — a
// neck row does not rescue it. The jaw taper carries the head on its own.
export const BUBBLE_ONE = [
  "...bbbbbbbbbb...",
  "..bbbbbbbbbbbb..",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbhhhhhhbbb.",
  ".bbbbhhhhhhhhbb.",
  ".bbbbhsssssshbb.",
  ".bbbbhsesseshbb.",
  ".bbbbhsssssshbb.",
  ".bbbbbbssssbbbb.",
  ".bbbbbbbbbbbbbb.",
  "..bbbbbbbbbbbb..",
  "...bbbbbbbbbb...",
  "...bbb..........",
  "..bbb...........",
  ".bb.............",
  "................",
];

// B — a speech bubble with the work inside it instead of the worker: a lit
// screen on a desk. Pairs with A as "who" and "what".
export const BUBBLE_SCREEN = [
  "...bbbbbbbbbb...",
  "..bbbbbbbbbbbb..",
  ".bbbbbbbbbbbbbb.",
  ".bbbbffffffbbbb.",
  ".bbbbfccccfbbbb.",
  ".bbbbfggggfbbbb.",
  ".bbbbfggggfbbbb.",
  ".bbbbffffffbbbb.",
  ".bbbddddddddbbb.",
  "..bbbbbbbbbbbb..",
  "...bbbbbbbbbb...",
  "...bbb..........",
  "..bbb...........",
  ".bb.............",
  "................",
  "................",
];

// C — a doorway. Kept for the record: at 16px a frame reads as a picture of a
// person no matter what you do to the bottom edge, so this one is not shipped.
export const DOORWAY = [
  "...dddddddddd...",
  "...dbbbbbbbbd...",
  "...dbbhhhhbbd...",
  "...dbhhhhhhbd...",
  "...dbhsssshbd...",
  "...dbhsesehbd...",
  "...dbbssssbbd...",
  "...dbttttttbd...",
  "...dbttttttbd...",
  "...dbbttttbbd...",
  "...dbbbbbbbbd...",
  "...dpppppppdd...",
  "...dppppppppd...",
  "...dppppppppd...",
  "...dppppppppd...",
  "...d........d...",
];

// D — the mark stripped to its silhouette: a bubble with the status dot that
// runs through the whole product. The most abstract, the most scalable.
export const BUBBLE_DOT = [
  "...bbbbbbbbbb...",
  "..bbbbbbbbbbbb..",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".bbbmmbbmmbbbbb.",
  ".bbbmmbbmmbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  "..bbbbbbbbbbbb..",
  "...bbbbbbbbbb...",
  "...bbb..........",
  "..bbb...........",
  ".bb.............",
  "................",
  "................",
];

// Lowercase pixel letters, 5 wide. x-height rows 2-6, ascenders on b and l, so
// the wordmark reads as "mumbl" rather than "MUMBL".
export const LETTERS = {
  m: [".....", ".....", "##.##", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  l: ["##...", ".#...", ".#...", ".#...", ".#...", ".#...", ".####"],
};
