import type { Move } from "./types";

/** Hues for the seats, spread around the wheel. Index matches Philosopher.accent. */
export const HUES = [18, 42, 95, 160, 195, 225, 265, 330] as const;

export const SUGGESTIONS = [
  "Is free will an illusion?",
  "Is it ever right to lie?",
  "Is obedience ever a virtue?",
  "What do we owe strangers?",
  "Does a good life need meaning?",
];

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
