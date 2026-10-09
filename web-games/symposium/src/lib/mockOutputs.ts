/**
 * Fixtures for MOCK_AI=1. Each one is shaped like the model's output and fits the move and topic.
 * The lines are placeholders for UI and route work. They are not philosophy.
 */
import { sampleSuggestions } from "./constants";
import type { Move, Philosopher } from "./types";

const LINES: Record<Move, (opp: string, topic: string) => string> = {
  open: (_opp, topic) => `On "${topic}", I start from a commitment I have held throughout, and it leads to a clear position.`,
  argue: (opp, topic) => `${opp}, the case on "${topic}" rests on a premise that looks stronger than it is. Let me show where it gives way.`,
  rebut: (opp) => `${opp}, you grant a great deal, but the step from that to your conclusion does not hold.`,
  question: (opp) => `${opp}, what would you say to someone who accepts your conclusion but denies your first premise?`,
  concede: (opp) => `${opp}, you have a fair point, and it exposes a gap in my account. I will narrow my claim accordingly.`,
  reframe: (_opp, topic) => `Perhaps we are asking the wrong question. Put "${topic}" in terms of what a person actually has to decide.`,
  answer: (_opp, topic) => `To your point, my view on "${topic}" still holds, though I see why it looks different from where you stand.`,
};

export function mockTurnOutput(input: {
  phil: Philosopher;
  opponent: string;
  topic: string;
  move: Move;
  needsStance: boolean;
}): { text: string; stance?: string } {
  const text = LINES[input.move](input.opponent, input.topic);
  return input.needsStance ? { text, stance: input.phil.commitments[0] } : { text };
}

export function mockSummaryOutput(input: { topic: string; a: string; b: string; turns: number }) {
  return {
    rollingSummary: `${input.a} and ${input.b} have spoken ${input.turns} times on "${input.topic}".`,
    ledger: {
      agree: [`Both treat "${input.topic}" as a question worth settling.`],
      split: [`${input.a} and ${input.b} disagree about how to answer it.`],
      openQuestions: [`What would settle "${input.topic}" in a single clear case?`],
    },
  };
}

export const mockTopicOutput = (topic: string) => ({ allowed: true, topic });

export const mockSuggestOutput = () => ({ suggestions: sampleSuggestions() });
