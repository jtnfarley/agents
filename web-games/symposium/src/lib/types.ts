/** Seats in a debate. The visitor is "user" and is never a seat. */
export type SpeakerId = "A" | "B";
export type Speaker = SpeakerId | "user";
/** Where the visitor's message goes. "both" means A answers first, then B. */
export type Target = SpeakerId | "both";

export type Move = "open" | "argue" | "rebut" | "question" | "concede" | "reframe" | "answer";

export type Turn =
  | { id: string; speaker: SpeakerId; move: Move; target: Speaker; text: string; stance?: string }
  | { id: string; speaker: "user"; target: Target; text: string }
  | { id: string; speaker: "error"; text: string };

/** A curated roster entry. Every field is hand-written and reviewed (plan section 3). */
export interface Philosopher {
  id: string;
  displayName: string;
  era: string;
  school: string;
  /** 4-6 positions the voice must stay consistent with. */
  commitments: string[];
  /** How they argue, in a short phrase. */
  method: string;
  /** Diction and register, for the prompt. */
  voice: string;
  /** Where their own view is vulnerable, so they can concede honestly. */
  knownTensions: string[];
  historicalContext: string;
  modernStance: string;
  /** 0-7, picks the color hue. */
  accent: number;
}

export interface Ledger {
  agree: string[];
  split: string[];
  openQuestions: string[];
  updatedAfterTurn: number;
}

export interface Debate {
  id: string;
  topic: string;
  philosophers: Record<SpeakerId, string>;
  /** Filled from each philosopher's opening turn. */
  stances: Record<SpeakerId, string | null>;
  turns: Turn[];
  rollingSummary: string;
  ledger: Ledger | null;
}

/** The two seats' philosophers, by id. */
export type Pair = Record<SpeakerId, string>;
