import { describe, expect, it } from "vitest";
import { calculateSidePots } from "./pots";

describe("calculateSidePots", () => {
  it("returns a single pot when everyone contributes equally", () => {
    const pots = calculateSidePots([
      { seatId: 0, amount: 100, folded: false },
      { seatId: 1, amount: 100, folded: false },
      { seatId: 2, amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 300, eligibleSeatIds: [0, 1, 2] }]);
  });

  it("splits a main pot and a side pot for an uneven all-in", () => {
    // Seat 0 all-in for 100, seats 1 and 2 both put in 300.
    const pots = calculateSidePots([
      { seatId: 0, amount: 100, folded: false },
      { seatId: 1, amount: 300, folded: false },
      { seatId: 2, amount: 300, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 300, eligibleSeatIds: [0, 1, 2] },
      { amount: 400, eligibleSeatIds: [1, 2] },
    ]);
  });

  it("excludes folded players from eligibility but keeps their chips in the pot", () => {
    const pots = calculateSidePots([
      { seatId: 0, amount: 100, folded: true },
      { seatId: 1, amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 200, eligibleSeatIds: [1] }]);
  });

  it("handles three-way uneven all-ins with three pot layers", () => {
    const pots = calculateSidePots([
      { seatId: 0, amount: 50, folded: false },
      { seatId: 1, amount: 150, folded: false },
      { seatId: 2, amount: 300, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 150, eligibleSeatIds: [0, 1, 2] }, // 50 * 3
      { amount: 200, eligibleSeatIds: [1, 2] }, // 100 * 2
      { amount: 150, eligibleSeatIds: [2] }, // 150 * 1
    ]);
  });

  it("merges consecutive layers that share the same eligible winners", () => {
    // Seat 0 folds after putting in 100; seat 1 goes on to win everything
    // above that uncontested. That's one side pot, not two fragments.
    const pots = calculateSidePots([
      { seatId: 0, amount: 100, folded: true },
      { seatId: 1, amount: 300, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 400, eligibleSeatIds: [1] }]);
  });

  it("returns no pots when nobody contributed", () => {
    expect(calculateSidePots([])).toEqual([]);
  });
});
