/**
 * Server-side debate logic (plan sections 5 and 7). Routes stay thin: parse, call, respond.
 * The client sends a snapshot of the debate each time. Nothing is kept on the server between calls.
 */
import type { z } from "zod";
import { ApiError } from "./errors";
import { LlmError, callJson, callJsonStream } from "./llm";
import { mockSuggestOutput, mockSummaryOutput, mockTopicOutput, mockTurnOutput } from "./mockOutputs";
import { drawPair, type Pair } from "./pairing";
import { summaryPrompt, suggestPrompt, topicCheckPrompt, turnPrompt } from "./prompts";
import type { reshuffleRequest, startRequest, summarizeRequest, turnRequest } from "./schemas";
import { suggestOutput, summaryOutput, topicOutput, turnOutput } from "./schemas";
import { ROSTER, rosterById } from "./roster";
import { nextSpeaker, otherSpeaker, philosopherTurnCount, planMove, responderFor, turnsSinceSummary } from "./turnPolicy";
import type { Debate, Move, Philosopher, Speaker, SpeakerId, Target, Turn } from "./types";

const newId = () => crypto.randomUUID();

/** Display names and profiles for both seats. Validated ids are in the roster by schema. */
function seatsOf(debate: Debate): Record<SpeakerId, Philosopher> {
  const a = rosterById(debate.philosophers.A);
  const b = rosterById(debate.philosophers.B);
  if (!a || !b) throw new ApiError("invalid_input", "unknown philosopher");
  return { A: a, B: b };
}

const namesOf = (seats: Record<SpeakerId, Philosopher>): Record<SpeakerId, string> => ({
  A: seats.A.displayName,
  B: seats.B.displayName,
});

const pairFrom = (p: Pair) => ({ a: p.A, b: p.B });

export async function startDebate(input: z.infer<typeof startRequest>) {
  const check = await callJson({
    task: "topic_check",
    prompt: topicCheckPrompt(input.topic),
    schema: topicOutput,
    mock: () => mockTopicOutput(input.topic),
  });
  if (!check.allowed || check.topic.length === 0) throw new LlmError("off_topic");

  const pair = drawPair(ROSTER, input.previousPair ?? null);
  return { topic: check.topic, ...pairFrom(pair) };
}

export async function reshuffle(input: z.infer<typeof reshuffleRequest>) {
  // The pair locks once the first turn is taken. The client checks this too, but the server is the authority.
  if (input.turnCount > 0) throw new LlmError("invalid_input", "the pair is locked after the first turn");
  return pairFrom(drawPair(ROSTER, input.currentPair));
}

/** Sent before the first word, so the client can show who is about to speak. */
export interface TurnStart {
  speaker: SpeakerId;
  move: Move;
  target: Speaker;
  visitor: { text: string; target: Target } | null;
}

export interface TurnStream {
  onStart(start: TurnStart): void;
  onText(text: string): void;
}

export async function takeTurn(
  input: z.infer<typeof turnRequest>,
  stream?: TurnStream,
): Promise<{ turns: Turn[] }> {
  const debate = input.debate;
  const seats = seatsOf(debate);
  const names = namesOf(seats);
  const visitor =
    input.userText !== undefined && input.target !== undefined
      ? { text: input.userText, target: input.target }
      : null;

  const seat: SpeakerId = visitor ? responderFor(visitor.target) : nextSpeaker(debate.turns);
  const move = visitor ? "answer" : planMove(debate.turns);
  const phil = seats[seat];
  const opponent = names[otherSpeaker(seat)];
  // Each philosopher states a stance on their first turn (plan section 4).
  const needsStance = debate.stances[seat] === null && move !== "answer";
  const ownLast = debate.turns.filter((t) => t.speaker === seat).at(-1)?.text ?? null;

  stream?.onStart({ speaker: seat, move, target: move === "answer" ? "user" : otherSpeaker(seat), visitor });

  const args = {
    task: "turn" as const,
    seat,
    prompt: turnPrompt({
      phil,
      opponent,
      topic: debate.topic,
      stance: debate.stances[seat],
      summary: debate.rollingSummary,
      recent: debate.turns.slice(-6),
      move,
      seat,
      visitor,
      names,
      needsStance,
      ownLast,
    }),
    schema: turnOutput,
    mock: () => mockTurnOutput({ phil, opponent, topic: debate.topic, move, needsStance }),
  };
  const out = stream ? await callJsonStream(args, stream.onText) : await callJson(args);

  const newTurns: Turn[] = [];
  if (visitor) newTurns.push({ id: newId(), speaker: "user", target: visitor.target, text: visitor.text });
  newTurns.push(
    move === "answer"
      ? { id: newId(), speaker: seat, move, target: "user", text: out.text }
      : {
          id: newId(),
          speaker: seat,
          move,
          target: otherSpeaker(seat),
          text: out.text,
          ...(needsStance ? { stance: out.stance ?? phil.commitments[0] } : {}),
        },
  );
  return { turns: newTurns };
}

export async function summarize(input: z.infer<typeof summarizeRequest>) {
  const debate = input.debate;
  const names = namesOf(seatsOf(debate));
  const out = await callJson({
    task: "summary",
    prompt: summaryPrompt({
      topic: debate.topic,
      names,
      previousSummary: debate.rollingSummary,
      previousLedger: debate.ledger,
      recent: turnsSinceSummary(debate.turns, debate.ledger?.updatedAfterTurn ?? 0).slice(-12),
    }),
    schema: summaryOutput,
    mock: () =>
      mockSummaryOutput({
        topic: debate.topic,
        a: names.A,
        b: names.B,
        turns: philosopherTurnCount(debate.turns),
      }),
  });
  return {
    rollingSummary: out.rollingSummary,
    ledger: { ...out.ledger, updatedAfterTurn: philosopherTurnCount(debate.turns) },
  };
}

export async function suggestions() {
  const out = await callJson({
    task: "suggest",
    prompt: suggestPrompt(),
    schema: suggestOutput,
    mock: mockSuggestOutput,
  });
  return { suggestions: out.suggestions };
}
