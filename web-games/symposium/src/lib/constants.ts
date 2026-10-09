import type { Move } from "./types";

/** Hues for the seats, spread around the wheel. Index matches Philosopher.accent. */
export const HUES = [
  18, 42, 95, 160, 195, 225, 265, 330,
  5, 30, 56, 72, 120, 140, 178, 208, 245, 280, 300, 315, 345, 82, 108, 150, 238, 255, 352,
] as const;

/** Starter questions. Each stays under the 80-character limit on suggestion chips. */
export const SUGGESTION_POOL = [
  "Is free will an illusion?",
  "Is it ever right to lie?",
  "Is obedience ever a virtue?",
  "What do we owe strangers?",
  "Does a good life need meaning?",
  "Is it better to be good or to seem good?",
  "Can a person be truly happy and still be unjust?",
  "Should we fear death?",
  "Is there such a thing as human nature?",
  "Are we responsible for what we do under pressure?",
  "Is happiness the goal of life?",
  "Can morality exist without God?",
  "Is it wrong to eat animals?",
  "Does the state have a right to our obedience?",
  "Should the wise rule?",
  "Is private property justified?",
  "Is inequality ever just?",
  "Is it ever right to break the law?",
  "Can violence be justified in the name of justice?",
  "Is democracy the best form of government?",
  "Should speech ever be restricted?",
  "Are we entitled to our own opinions?",
  "Can we really know anything for certain?",
  "Is the self an illusion?",
  "Does the future exist the way the past does?",
  "Is there a difference between knowing and believing?",
  "Is science the only reliable source of truth?",
  "Can a machine ever think?",
  "Does technology make us freer or less free?",
  "Is progress real?",
  "Does ambition make us better or worse?",
  "Is friendship the highest good?",
  "Is loving your family a moral duty or a bias?",
  "Should we trust our emotions?",
  "Is suffering necessary for a meaningful life?",
  "Is it better to live simply?",
  "Is work a path to dignity or a form of bondage?",
  "Do we owe anything to future generations?",
  "Is beauty objective?",
  "Is tradition a guide or a burden?",
];

/** Chips shown at once. */
export const SUGGESTION_COUNT = 5;

/** The first few entries, for the first render, before anything random is drawn. */
export const SUGGESTIONS = SUGGESTION_POOL.slice(0, SUGGESTION_COUNT);

/** A random sample from the pool, without repeats. */
export function sampleSuggestions(n: number = SUGGESTION_COUNT, rng: () => number = Math.random): string[] {
  const pool = [...SUGGESTION_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** Field limits. Applied at the input and, from Phase 3, at the API boundary. */
export const LIMITS = {
  topic: 140,
  visitorText: 600,
  turnText: 900,
} as const;

export const MOVE_VERB: Record<Move, string> = {
  open: "opens",
  argue: "argues with",
  rebut: "rebuts",
  question: "questions",
  concede: "concedes to",
  reframe: "reframes",
  answer: "answers you",
};

/** Moves that name the other philosopher in their label, as in "Kant rebuts Mill". */
export const MOVE_NAMES_TARGET: Move[] = ["argue", "rebut", "question", "concede"];

/** Gap between turns when Auto-play is on. */
export const AUTOPLAY_MS = 2500;

export const STORAGE_KEY = "symposium:v1";
