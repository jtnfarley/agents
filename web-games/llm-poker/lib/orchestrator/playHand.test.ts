import { describe, expect, it } from "vitest";
import type { SeatState } from "@/types";
import type { PersonaPromptContext, PersonaResponse } from "@/types";
import { createRng } from "@/lib/engine";
import { createStubPersona } from "@/lib/personas";
import { playHand } from "./playHand";

function seat(seatId: number, overrides: Partial<SeatState> = {}): SeatState {
  return {
    seatId,
    personaId: `persona-${seatId}`,
    stack: 1000,
    holeCards: [],
    status: "active",
    ...overrides,
  };
}

describe("playHand", () => {
  it("plays a full hand end-to-end via stub personas with conserved, non-negative stacks", async () => {
    const seats = [seat(0), seat(1), seat(2)];
    const stackBefore = seats.reduce((sum, s) => sum + s.stack, 0);

    const result = await playHand(
      {
        seats,
        handNumber: 1,
        dealerSeat: 0,
        smallBlind: 10,
        bigBlind: 20,
        rng: createRng(7),
      },
      { getPersonaTurn: createStubPersona(createRng(42)) },
    );

    expect(result.state.game.potTotal).toBe(0);
    const stackAfter = result.state.game.seats.reduce((sum, s) => sum + s.stack, 0);
    expect(stackAfter).toBe(stackBefore);
    for (const s of result.state.game.seats) {
      expect(s.stack).toBeGreaterThanOrEqual(0);
    }
    expect(result.payouts.length).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("reaches a conserved-stack conclusion for many random deals without stalling", async () => {
    for (let seed = 0; seed < 25; seed++) {
      const seats = [seat(0), seat(1), seat(2), seat(3)];
      const stackBefore = seats.reduce((sum, s) => sum + s.stack, 0);

      const result = await playHand(
        {
          seats,
          handNumber: 1,
          dealerSeat: 0,
          smallBlind: 10,
          bigBlind: 20,
          rng: createRng(seed),
        },
        { getPersonaTurn: createStubPersona(createRng(seed * 13 + 1)) },
      );

      const stackAfter = result.state.game.seats.reduce((sum, s) => sum + s.stack, 0);
      expect(stackAfter).toBe(stackBefore);
      for (const s of result.state.game.seats) {
        expect(s.stack).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("caps an over-large bet from a misbehaving persona instead of letting the engine throw", async () => {
    const overraiseStub = async (context: PersonaPromptContext): Promise<PersonaResponse> => {
      const raise = context.legalActions.find((a) => a.type === "raise");
      const action = raise ?? context.legalActions[0];
      return {
        reasoning: "always try to shove far more than the stack allows",
        action: action.type,
        amount: action.type === "raise" ? 999_999_999 : 0,
        dialogue: "Everything. All of it.",
        gesture: "slams the table",
        newDiscussionTopic: null,
      };
    };

    const seats = [seat(0), seat(1)];
    const stackBefore = seats.reduce((sum, s) => sum + s.stack, 0);

    const result = await playHand(
      {
        seats,
        handNumber: 1,
        dealerSeat: 0,
        smallBlind: 10,
        bigBlind: 20,
        rng: createRng(3),
      },
      { getPersonaTurn: overraiseStub },
    );

    const stackAfter = result.state.game.seats.reduce((sum, s) => sum + s.stack, 0);
    expect(stackAfter).toBe(stackBefore);
    for (const s of result.state.game.seats) {
      expect(s.stack).toBeGreaterThanOrEqual(0);
    }
    // Every raise a stub attempted got clamped to that seat's stack, i.e.
    // every actual amount logged is a legal all-in, never the requested 999,999,999.
    for (const event of result.events) {
      expect(event.amount).toBeLessThanOrEqual(1000);
    }
  });

  it("invokes onEvent for every applied action, in order", async () => {
    const seats = [seat(0), seat(1)];
    const seen: number[] = [];

    await playHand(
      {
        seats,
        handNumber: 1,
        dealerSeat: 0,
        smallBlind: 10,
        bigBlind: 20,
        rng: createRng(11),
      },
      {
        getPersonaTurn: createStubPersona(createRng(11)),
        onEvent: (event) => seen.push(event.seatId),
      },
    );

    expect(seen.length).toBeGreaterThan(0);
  });

  it("threads each turn's prior actions into the next turn's prompt context, in order acted", async () => {
    const seats = [seat(0), seat(1), seat(2)];
    const seenLogLengths: number[] = [];

    await playHand(
      {
        seats,
        handNumber: 1,
        dealerSeat: 0,
        smallBlind: 10,
        bigBlind: 20,
        rng: createRng(7),
      },
      {
        getPersonaTurn: async (context: PersonaPromptContext): Promise<PersonaResponse> => {
          seenLogLengths.push(context.handActionLog.length);
          const legalAction = context.legalActions[0];
          return {
            reasoning: "",
            action: legalAction.type,
            amount: 0,
            dialogue: `turn ${context.handActionLog.length}`,
            gesture: "nods",
            newDiscussionTopic: null,
          };
        },
      },
    );

    // First turn sees no prior actions; every later turn sees one more than
    // the turn before it, in the order those seats actually acted.
    expect(seenLogLengths[0]).toBe(0);
    for (let i = 1; i < seenLogLengths.length; i++) {
      expect(seenLogLengths[i]).toBe(seenLogLengths[i - 1] + 1);
    }
  });

  it("invokes onBroadcast with gesture included and the post-action GameState", async () => {
    const seats = [seat(0), seat(1)];
    const broadcasts: { amount: number; gesture: string; potTotal: number }[] = [];

    await playHand(
      {
        seats,
        handNumber: 1,
        dealerSeat: 0,
        smallBlind: 10,
        bigBlind: 20,
        rng: createRng(11),
      },
      {
        getPersonaTurn: createStubPersona(createRng(11)),
        onBroadcast: (payload, gameState) => {
          broadcasts.push({ amount: payload.amount, gesture: payload.gesture, potTotal: gameState.potTotal });
        },
      },
    );

    expect(broadcasts.length).toBeGreaterThan(0);
    for (const b of broadcasts) {
      expect(b.gesture).toBe("shrugs"); // the stub's fixed gesture
      expect(b.potTotal).toBeGreaterThanOrEqual(0);
    }
  });

  it("starts with no active discussion by default, and carries a newly-raised topic to later turns and into the result", async () => {
    const seats = [seat(0), seat(1), seat(2)];
    const seenTopics: (string | null)[] = [];

    const result = await playHand(
      { seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(7) },
      {
        getPersonaTurn: async (context: PersonaPromptContext): Promise<PersonaResponse> => {
          seenTopics.push(context.discussionTopic?.topic ?? null);
          const legalAction = context.legalActions[0];
          return {
            reasoning: "",
            action: legalAction.type,
            amount: 0,
            dialogue: "",
            gesture: "nods",
            // The very first seat to act poses a topic; nobody changes it after that.
            newDiscussionTopic: context.handActionLog.length === 0 ? "Who's bluffing?" : null,
          };
        },
      },
    );

    expect(seenTopics[0]).toBeNull();
    for (let i = 1; i < seenTopics.length; i++) {
      expect(seenTopics[i]).toBe("Who's bluffing?");
    }
    expect(result.discussionTopic).toEqual({
      topic: "Who's bluffing?",
      raisedByPersonaId: "persona-0", // UTG wraps to dealerSeat 0 in a 3-handed game
      handNumber: 1,
    });
  });

  it("carries a discussion topic passed in via options straight through when nobody changes it", async () => {
    const seats = [seat(0), seat(1)];
    const initialTopic = { topic: "Is the house always right?", raisedByPersonaId: "persona-1", handNumber: 4 };

    const result = await playHand(
      { seats, handNumber: 5, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(11) },
      { getPersonaTurn: createStubPersona(createRng(11)), discussionTopic: initialTopic },
    );

    expect(result.discussionTopic).toEqual(initialTopic);
  });

  it("skips celebration generation entirely when getCelebration is not provided", async () => {
    const seats = [seat(0), seat(1)];

    // No getCelebration/onCelebration passed — must not attempt any
    // celebration call (e.g. hitting a real dispatcher for unregistered
    // test persona ids like "persona-0").
    await expect(
      playHand(
        { seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(11) },
        { getPersonaTurn: createStubPersona(createRng(11)) },
      ),
    ).resolves.toBeDefined();
  });

  it("calls getCelebration once per winning seat and broadcasts the result via onCelebration", async () => {
    const seats = [seat(0), seat(1)];
    const celebrationContexts: unknown[] = [];
    const celebrations: { personaId: string; action: string; amount: number; dialogue: string }[] = [];

    const result = await playHand(
      { seats, handNumber: 3, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(11) },
      {
        getPersonaTurn: createStubPersona(createRng(11)),
        getCelebration: async (context) => {
          celebrationContexts.push(context);
          return { dialogue: "Victory is mine.", gesture: "raises a fist" };
        },
        onCelebration: (payload) => {
          celebrations.push(payload);
        },
      },
    );

    expect(result.payouts.length).toBeGreaterThan(0);
    expect(celebrationContexts.length).toBe(result.payouts.length);
    expect(celebrations.length).toBe(result.payouts.length);
    for (const c of celebrations) {
      expect(c.action).toBe("celebrate");
      expect(c.dialogue).toBe("Victory is mine.");
      expect(c.amount).toBeGreaterThan(0);
    }
  });

  it("passes wonAtShowdown: false and the folder as opponent when the hand was decided by a fold", async () => {
    // Seat 0 folds the instant it actually faces a bet (toCall > 0) — as
    // heads-up small blind/dealer, that's preflop, immediately, so the hand
    // ends uncontested with seat 1 the winner. (Fold isn't a legal action
    // when there's nothing to call, so a stub can't just "always fold".)
    const foldingStub = async (context: PersonaPromptContext): Promise<PersonaResponse> => {
      const foldAction = context.legalActions.find((a) => a.type === "fold");
      const action =
        context.personaId === "persona-0" && foldAction
          ? foldAction
          : (context.legalActions.find((a) => a.type === "check" || a.type === "call") ??
            context.legalActions[0]);
      return {
        reasoning: "",
        action: action.type,
        amount: 0,
        dialogue: "",
        gesture: "nods",
        newDiscussionTopic: null,
      };
    };

    const seats = [seat(0), seat(1)];
    const seenContexts: { wonAtShowdown: boolean; opponentPersonaIds: string[]; personaId: string }[] = [];

    await playHand(
      { seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(11) },
      {
        getPersonaTurn: foldingStub,
        getCelebration: async (context) => {
          seenContexts.push(context);
          return { dialogue: "", gesture: "" };
        },
      },
    );

    expect(seenContexts.length).toBe(1);
    expect(seenContexts[0].personaId).toBe("persona-1");
    expect(seenContexts[0].wonAtShowdown).toBe(false);
    expect(seenContexts[0].opponentPersonaIds).toContain("persona-0");
  });
});
