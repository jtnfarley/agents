import { describe, expect, it } from "vitest";
import type { GameState, SeatState } from "@/types";
import type { EngineState } from "./state";
import { startHand } from "./state";
import { applyAction, isBettingRoundComplete, isHandDecidedByFolds } from "./betting";
import { advanceToNextRound } from "./rounds";
import { resolveHand } from "./showdown";
import { createRng } from "./rng";
import { parseCards } from "./testUtils";

// Drives betting to completion for the current street: applies each scripted
// action, then advances to the next street once everyone has matched or is
// all-in. Mirrors the loop the orchestrator will own in Phase 2.
function playStreet(state: EngineState, actions: [seatId: number, action: Parameters<typeof applyAction>[2]][]): EngineState {
  let next = state;
  for (const [seatId, action] of actions) {
    next = applyAction(next, seatId, action);
  }
  if (!isBettingRoundComplete(next)) {
    throw new Error("scripted actions did not complete the betting round");
  }
  return next;
}

function seat(seatId: number, stack: number, holeCards: ReturnType<typeof parseCards>): SeatState {
  return { seatId, personaId: `persona-${seatId}`, stack, holeCards, status: "active" };
}

describe("full hand: 3-way all-in produces a main pot and a side pot", () => {
  it("awards the side pot only to the two players who covered it", () => {
    // Alice shoves 100 (short stack), Bob and Carol both go to 300. Alice can
    // only win what she matched (the 300 main pot); the extra 200 x 2 side
    // pot is contested between Bob and Carol alone.
    const seats = [
      seat(0, 100, parseCards("AS AH")), // Alice — best hand overall
      seat(1, 990, parseCards("KD KC")), // Bob — second best
      seat(2, 980, parseCards("QD QC")), // Carol — worst of the three
    ];

    const initial: EngineState = {
      game: {
        handNumber: 1,
        potTotal: 30,
        board: [],
        seats,
        actingSeat: 0, // hand-built fixture (doesn't go through startHand): Alice acts first
        dealerSeat: 0,
        bettingRound: "preflop",
      },
      // Reserved in exact order for flop/turn/river; disconnected, no-flush board.
      deck: parseCards("2C 7D 9H JS 4C"),
      currentBet: 20,
      minRaise: 20,
      smallBlind: 10,
      bigBlind: 20,
      roundContributions: { 0: 0, 1: 10, 2: 20 },
      totalContributions: { 1: 10, 2: 20 },
      actedSeatIds: [],
    };

    let state = playStreet(initial, [
      [0, { type: "raise", amount: 100 }], // Alice all-in
      [1, { type: "call" }], // Bob calls 100
      [2, { type: "raise", amount: 300 }], // Carol re-raises, building the side pot
      [1, { type: "call" }], // Bob calls 300
    ]);

    expect(isHandDecidedByFolds(state)).toBe(false);
    expect(state.game.seats.find((s) => s.seatId === 0)!.status).toBe("all_in");

    // Alice can't act again; flop/turn/river are checked through by Bob and Carol.
    state = advanceToNextRound(state);
    expect(state.game.bettingRound).toBe("flop");
    expect(state.game.board).toEqual(parseCards("2C 7D 9H"));
    state = playStreet(state, [
      [1, { type: "check" }],
      [2, { type: "check" }],
    ]);

    state = advanceToNextRound(state);
    expect(state.game.bettingRound).toBe("turn");
    state = playStreet(state, [
      [1, { type: "check" }],
      [2, { type: "check" }],
    ]);

    state = advanceToNextRound(state);
    expect(state.game.bettingRound).toBe("river");
    state = playStreet(state, [
      [1, { type: "check" }],
      [2, { type: "check" }],
    ]);

    state = advanceToNextRound(state);
    expect(state.game.bettingRound).toBe("showdown");

    const { state: finalState, payouts } = resolveHand(state);

    const payoutBySeat = new Map(payouts.map((p) => [p.seatId, p.amount]));
    expect(payoutBySeat.get(0)).toBe(300); // main pot: Alice's aces beat everyone
    expect(payoutBySeat.get(1)).toBe(400); // side pot: Bob's kings beat Carol's queens
    expect(payoutBySeat.has(2)).toBe(false); // Carol wins nothing

    const finalStacks = new Map(finalState.game.seats.map((s) => [s.seatId, s.stack]));
    expect(finalStacks.get(0)).toBe(300);
    expect(finalStacks.get(1)).toBe(1100);
    expect(finalStacks.get(2)).toBe(700);

    // Chips are conserved: nothing created or destroyed at the table.
    const totalBefore = 100 + 990 + 980 + 30; // stacks + blinds already posted
    const totalAfter = [...finalStacks.values()].reduce((a, b) => a + b, 0);
    expect(totalAfter).toBe(totalBefore);

    expect(finalState.game.potTotal).toBe(0);
  });
});

describe("full hand: everyone folds to one player", () => {
  it("awards the pot without a showdown", () => {
    const seats = [seat(0, 990, parseCards("2H 3D")), seat(1, 980, parseCards("AS AH"))];

    const initial: EngineState = {
      game: {
        handNumber: 1,
        potTotal: 30,
        board: [],
        seats,
        actingSeat: 0, // heads-up: dealer/SB acts first preflop
        dealerSeat: 0,
        bettingRound: "preflop",
      },
      deck: [],
      currentBet: 20,
      minRaise: 20,
      smallBlind: 10,
      bigBlind: 20,
      roundContributions: { 0: 10, 1: 20 },
      totalContributions: { 0: 10, 1: 20 },
      actedSeatIds: [],
    };

    const afterFold = applyAction(initial, 0, { type: "fold" });
    expect(isHandDecidedByFolds(afterFold)).toBe(true);

    const { state: finalState, payouts } = resolveHand(afterFold);

    expect(payouts).toEqual([{ seatId: 1, amount: 30 }]);
    expect(finalState.game.seats.find((s) => s.seatId === 1)!.stack).toBe(1010);
    // The folded player's stack is untouched — they already paid their blind.
    expect(finalState.game.seats.find((s) => s.seatId === 0)!.stack).toBe(990);
  });
});

describe("full hand: heads-up showdown dealt via startHand", () => {
  it("plays check-check-check-check to a real showdown with correct pot math", () => {
    const seats: SeatState[] = [
      { seatId: 0, personaId: "alice", stack: 1000, holeCards: [], status: "active" },
      { seatId: 1, personaId: "bob", stack: 1000, holeCards: [], status: "active" },
    ];

    let state = startHand({
      seats,
      handNumber: 1,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      rng: createRng(123),
    });

    const streets: GameState["bettingRound"][] = ["preflop", "flop", "turn", "river"];
    for (const round of streets) {
      expect(state.game.bettingRound).toBe(round);
      while (!isBettingRoundComplete(state)) {
        const seatId = state.game.actingSeat;
        const toCall = state.currentBet - (state.roundContributions[seatId] ?? 0);
        // The preflop small blind owes the difference to the big blind and
        // must call before a check is legal; every other action here checks.
        state = applyAction(state, seatId, toCall > 0 ? { type: "call" } : { type: "check" });
      }
      state = advanceToNextRound(state);
    }
    expect(state.game.bettingRound).toBe("showdown");
    expect(state.game.board).toHaveLength(5);

    const { state: finalState, payouts } = resolveHand(state);

    // Exactly one winner takes the full 40-chip pot (heads-up, no split-pot cards expected from a random deal).
    const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);
    expect(totalPaid).toBe(40);

    const finalStacks = finalState.game.seats.map((s) => s.stack).reduce((a, b) => a + b, 0);
    expect(finalStacks).toBe(2000); // chips conserved across the table
    expect(finalState.game.potTotal).toBe(0);
  });
});
