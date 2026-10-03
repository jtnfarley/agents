import { describe, expect, it } from "vitest";
import type { SeatState } from "@/types";
import { createRng } from "./rng";
import { startHand } from "./state";

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

describe("startHand", () => {
  it("deals two hole cards to every eligible seat and shrinks the deck accordingly", () => {
    const seats = [seat(0), seat(1), seat(2)];
    const state = startHand({
      seats,
      handNumber: 1,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      rng: createRng(1),
    });

    for (const s of state.game.seats) {
      expect(s.holeCards).toHaveLength(2);
    }
    expect(state.deck).toHaveLength(52 - 3 * 2);
  });

  it("posts blinds from the seats after the dealer in a 3+ handed game", () => {
    const seats = [seat(0), seat(1), seat(2)];
    const state = startHand({
      seats,
      handNumber: 1,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      rng: createRng(1),
    });

    const seat1 = state.game.seats.find((s) => s.seatId === 1)!;
    const seat2 = state.game.seats.find((s) => s.seatId === 2)!;
    const seat0 = state.game.seats.find((s) => s.seatId === 0)!;

    expect(seat1.stack).toBe(990); // small blind
    expect(seat2.stack).toBe(980); // big blind
    expect(seat0.stack).toBe(1000); // dealer posts nothing in a 3-handed game
    expect(state.game.potTotal).toBe(30);
    expect(state.currentBet).toBe(20);
    // First to act preflop is left of the big blind, wrapping to the dealer.
    expect(state.game.actingSeat).toBe(0);
  });

  it("makes the dealer the small blind in heads-up play", () => {
    const seats = [seat(0), seat(1)];
    const state = startHand({
      seats,
      handNumber: 1,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      rng: createRng(1),
    });

    const seat0 = state.game.seats.find((s) => s.seatId === 0)!;
    const seat1 = state.game.seats.find((s) => s.seatId === 1)!;
    expect(seat0.stack).toBe(990); // dealer posts SB heads-up
    expect(seat1.stack).toBe(980); // BB
    // Heads-up preflop action starts with the dealer/SB.
    expect(state.game.actingSeat).toBe(0);
  });

  it("skips seats with no persona or an empty stack when dealing", () => {
    const seats = [seat(0), seat(1, { personaId: null }), seat(2), seat(3, { stack: 0 })];
    const state = startHand({
      seats,
      handNumber: 1,
      dealerSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      rng: createRng(1),
    });

    const dealtSeatIds = state.game.seats.filter((s) => s.holeCards.length > 0).map((s) => s.seatId);
    expect(dealtSeatIds.sort()).toEqual([0, 2]);
  });

  it("is deterministic for a given seed", () => {
    const seats = [seat(0), seat(1), seat(2)];
    const a = startHand({ seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(5) });
    const b = startHand({ seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(5) });
    expect(a.game.seats.map((s) => s.holeCards)).toEqual(b.game.seats.map((s) => s.holeCards));
  });

  it("throws when fewer than two seats are eligible to play", () => {
    const seats = [seat(0), seat(1, { personaId: null })];
    expect(() =>
      startHand({ seats, handNumber: 1, dealerSeat: 0, smallBlind: 10, bigBlind: 20, rng: createRng(1) }),
    ).toThrow();
  });
});
