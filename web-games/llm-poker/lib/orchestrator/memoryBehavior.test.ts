import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/engine";
import { createMemoryStore } from "@/lib/memory";
import type { PersonaPromptContext, PersonaResponse, SeatState } from "@/types";
import { playHand } from "./playHand";

function seat(seatId: number, personaId: string): SeatState {
  return { seatId, personaId, stack: 1000, holeCards: [], status: "active" };
}

// A deterministic persona that folds whenever its private memory holds a
// tell about "opponent", and otherwise takes the mildest non-fold action
// available. This is the plumbing acceptance check from docs/SPEC.md phase
// 4: "a persona's play measurably changes based on a private-memory entry
// from an earlier hand." What the *content* of a memory-driven decision
// looks like from a real Claude call is exercised separately in
// personas/liveSmoke.test.ts-style manual review, not here.
async function readerPersona(context: PersonaPromptContext): Promise<PersonaResponse> {
  const hasOpponentTell = context.privateMemory.some((m) => m.target === "opponent");
  if (hasOpponentTell) {
    const fold = context.legalActions.find((a) => a.type === "fold");
    if (fold) {
      return {
        reasoning: "remembering the opponent's tell",
        action: "fold",
        amount: 0,
        dialogue: "I remember what you did last time.",
        gesture: "narrows eyes",
        newDiscussionTopic: null,
      };
    }
  }
  const mild = context.legalActions.find((a) => a.type === "call" || a.type === "check");
  if (mild) {
    return {
      reasoning: "no relevant memory",
      action: mild.type,
      amount: 0,
      dialogue: "As you wish.",
      gesture: "shrugs",
      newDiscussionTopic: null,
    };
  }
  const fallback = context.legalActions[0];
  return {
    reasoning: "no relevant memory, forced action",
    action: fallback.type,
    amount: fallback.type === "raise" ? (fallback.minAmount ?? 0) : 0,
    dialogue: "So be it.",
    gesture: "shrugs",
    newDiscussionTopic: null,
  };
}

async function opponentPersona(context: PersonaPromptContext): Promise<PersonaResponse> {
  const mild = context.legalActions.find((a) => a.type === "check" || a.type === "call");
  const choice = mild ?? context.legalActions[0];
  return {
    reasoning: "plays a simple fixed line",
    action: choice.type,
    amount: choice.type === "raise" ? (choice.minAmount ?? 0) : 0,
    dialogue: "Let's see.",
    gesture: "taps the table",
    newDiscussionTopic: null,
  };
}

function getTurn(context: PersonaPromptContext): Promise<PersonaResponse> {
  return context.personaId === "reader" ? readerPersona(context) : opponentPersona(context);
}

describe("memory-driven behavior (phase 4 acceptance check)", () => {
  it("changes a persona's action when a private-memory entry about its opponent is present", async () => {
    const seats = [seat(0, "reader"), seat(1, "opponent")];
    const baseParams = { seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20 };

    const baselineStore = createMemoryStore();
    const baselineResult = await playHand(
      { ...baseParams, rng: createRng(1) },
      { getPersonaTurn: getTurn, memoryStore: baselineStore },
    );
    const baselineAction = baselineResult.events.find((e) => e.personaId === "reader")?.action;
    expect(baselineAction).toBe("call");

    const seededStore = createMemoryStore();
    seededStore.applyMemoryWriterOutput("reader", {
      updatedPrivateMemory: [
        { type: "tell_noticed", target: "opponent", note: "always overbets a strong hand", importance: 5 },
      ],
      newDigestEntries: [],
    });
    const seededResult = await playHand(
      { ...baseParams, rng: createRng(1) },
      { getPersonaTurn: getTurn, memoryStore: seededStore },
    );
    const seededAction = seededResult.events.find((e) => e.personaId === "reader")?.action;
    expect(seededAction).toBe("fold");

    expect(seededAction).not.toBe(baselineAction);
  });

  it("without a memoryStore, playHand falls back to empty memory (unchanged phase-3 behavior)", async () => {
    const seats = [seat(0, "reader"), seat(1, "opponent")];
    const result = await playHand(
      { seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(1) },
      { getPersonaTurn: getTurn },
    );
    expect(result.events.find((e) => e.personaId === "reader")?.action).toBe("call");
  });
});
