/**
 * Turn policy (plan section 5). Pure functions, so the rules are tested directly.
 * The server calls these on every turn; the client never does.
 */
import type { Move, SpeakerId, Target, Turn } from "./types";

/** Moves after the opening, in rotation. */
export const MOVE_CYCLE: Move[] = ["rebut", "question", "argue", "concede", "reframe"];

/** Moves that push the exchange forward without giving ground. Two in a row means the debate is stuck. */
const CONTENTIOUS: Move[] = ["argue", "rebut"];

export const SUMMARY_EVERY = 4;

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

/**
 * The seat that answers a visitor message. "both" starts with A. B then speaks on the next
 * turn, so it responds to both the visitor and A's answer (plan section 5).
 */
export const responderFor = (target: Target): SpeakerId => (target === "B" ? "B" : "A");

/** Moves made by philosophers, in order. Visitor answers are left out, so they don't mask a stuck exchange. */
function philosopherMoves(turns: Turn[]): Move[] {
  return turns.filter(isPhilosopherTurn).map((t) => t.move).filter((m) => m !== "answer");
}

/** True when the last two philosopher moves were both contentious, so the exchange is going nowhere. */
export function isStuck(turns: Turn[]): boolean {
  const moves = philosopherMoves(turns);
  const [a, b] = moves.slice(-2);
  return moves.length >= 2 && CONTENTIOUS.includes(a) && CONTENTIOUS.includes(b);
}

/**
 * The move for the next philosopher turn.
 * - The opening comes first.
 * - Otherwise the rotation applies, but a move is never repeated back to back.
 * - When the exchange is stuck, the move becomes a question or a concession (plan section 5).
 */
export function planMove(turns: Turn[]): Move {
  const n = philosopherTurnCount(turns);
  if (n === 0) return "open";

  if (isStuck(turns)) return n % 2 === 0 ? "question" : "concede";

  const moves = philosopherMoves(turns);
  const last = moves.at(-1);
  let index = (n - 1) % MOVE_CYCLE.length;
  if (MOVE_CYCLE[index] === last) index = (index + 1) % MOVE_CYCLE.length;
  return MOVE_CYCLE[index];
}

export const shouldSummarize = (turns: Turn[]): boolean => {
  const n = philosopherTurnCount(turns);
  return n > 0 && n % SUMMARY_EVERY === 0;
};

/**
 * The turns the summary has not seen yet. `summarizedAt` is the philosopher turn count at the
 * last successful summary. Everything after that point is new, so a failed summary never drops turns.
 */
export function turnsSinceSummary(turns: Turn[], summarizedAt: number): Turn[] {
  if (summarizedAt === 0) return turns;
  let seen = 0;
  for (let i = 0; i < turns.length; i++) {
    if (isPhilosopherTurn(turns[i])) {
      seen++;
      if (seen === summarizedAt) return turns.slice(i + 1);
    }
  }
  return turns;
}
