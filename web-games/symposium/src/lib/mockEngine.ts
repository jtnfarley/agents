/**
 * Stands in for the Phase 3 routes during Phase 1. Every line is a placeholder that
 * fits the move and the topic. Phase 4 replaces these with model output.
 */
import { rosterById } from "./roster";
import { otherSpeaker, nextSpeaker, planMove, responderFor } from "./turnPolicy";
import type { Debate, Ledger, Move, SpeakerId, Target, Turn } from "./types";

type Ids = () => string;

const LINES: Record<Move, (opp: string, topic: string) => string> = {
  open: (_opp, topic) => `On "${topic}", I start from a commitment I have held throughout, and it leads to a clear position.`,
  argue: (opp, topic) => `${opp}, the case on "${topic}" rests on a premise that looks stronger than it is. Let me show where it gives way.`,
  rebut: (opp) => `${opp}, you grant a great deal, but the step from that to your conclusion does not hold.`,
  question: (opp) => `${opp}, what would you say to someone who accepts your conclusion but denies your first premise?`,
  concede: (opp) => `${opp}, you have a fair point, and it exposes a gap in my account. I will narrow my claim accordingly.`,
  reframe: (_opp, topic) => `Perhaps we are asking the wrong question. Put "${topic}" in terms of what a person actually has to decide.`,
  answer: (_opp, topic) => `To your point, my view on "${topic}" still holds, though I see why it looks different from where you stand.`,
};

const nameOf = (debate: Debate, s: SpeakerId): string => rosterById(debate.philosophers[s])?.displayName ?? s;

/** One philosopher turn, with its move, target and (on the opening) its stance. */
export function philosopherTurn(debate: Debate, speaker: SpeakerId, move: Move, id: string): Turn {
  const phil = rosterById(debate.philosophers[speaker]);
  const opp = nameOf(debate, otherSpeaker(speaker));
  const text = LINES[move](opp, debate.topic);
  if (move === "answer") return { id, speaker, move, target: "user", text };
  if (move === "open") {
    return { id, speaker, move, target: otherSpeaker(speaker), text, stance: phil?.commitments[0] ?? "" };
  }
  return { id, speaker, move, target: otherSpeaker(speaker), text };
}

/** The turns for the next "Next turn" click: one philosopher speaks, following the policy. */
export function nextPhilosopherTurn(debate: Debate, newId: Ids): Turn {
  return philosopherTurn(debate, nextSpeaker(debate.turns), planMove(debate.turns), newId());
}

/** The visitor's message as a turn, followed by the seat it is addressed to. */
export function visitorTurns(debate: Debate, text: string, target: Target, newId: Ids): Turn[] {
  const user: Turn = { id: newId(), speaker: "user", target, text };
  const reply = philosopherTurn({ ...debate, turns: [...debate.turns, user] }, responderFor(target), "answer", newId());
  return [user, reply];
}

/** Background summary (plan section 5). Placeholder ledger for the UI. */
export function mockSummary(debate: Debate): { rollingSummary: string; ledger: Ledger } {
  const n = debate.turns.filter((t) => t.speaker === "A" || t.speaker === "B").length;
  const a = nameOf(debate, "A");
  const b = nameOf(debate, "B");
  return {
    rollingSummary: `${a} and ${b} have spoken ${n} times on "${debate.topic}".`,
    ledger: {
      agree: [`Both treat "${debate.topic}" as a question worth settling.`],
      split: [`${a} and ${b} disagree about how to answer it.`],
      openQuestions: [`What would settle "${debate.topic}" in a single clear case?`],
      updatedAfterTurn: n,
    },
  };
}
