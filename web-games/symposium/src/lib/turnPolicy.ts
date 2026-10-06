/**
 * Turn policy (plan section 5). The server will own this in Phase 3; the client only
 * reads its output for the mock engine. Pure functions, so the rules are tested directly.
 */
import type { Move, SpeakerId, Target, Turn } from "./types";

/** Moves after the opening. Each appears once in five, so no move repeats three times in a row. */
export const MOVE_CYCLE: Move[] = ["rebut", "question", "argue", "concede", "reframe"];

export const otherSpeaker = (s: SpeakerId): SpeakerId => (s === "A" ? "B" : "A");

export const isPhilosopherTurn = (t: Turn): t is Extract<Turn, { speaker: SpeakerId }> =>
  t.speaker === "A" || t.speaker === "B";

export const philosopherTurnCount = (turns: Turn[]): number => turns.filter(isPhilosopherTurn).length;

/** The seat that speaks next when the visitor has not addressed anyone. Alternates A, B, A, B. */
export function nextSpeaker(turns: Turn[]): SpeakerId {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (isPhilosopherTurn(t)) return otherSpeaker(t.speaker);
  }
  return "A";
}

/** The seat that answers a visitor message. "both" starts with A, and B follows on the next turn. */
export const responderFor = (target: Target): SpeakerId => (target === "B" ? "B" : "A");

/** The move for the next philosopher turn: an opening first, then the cycle. */
export function planMove(turns: Turn[]): Move {
  const n = philosopherTurnCount(turns);
  return n === 0 ? "open" : MOVE_CYCLE[(n - 1) % MOVE_CYCLE.length];
}

/** Summaries run every four philosopher turns (plan section 5). */
export const SUMMARY_EVERY = 4;
export const shouldSummarize = (turns: Turn[]): boolean => {
  const n = philosopherTurnCount(turns);
  return n > 0 && n % SUMMARY_EVERY === 0;
};
