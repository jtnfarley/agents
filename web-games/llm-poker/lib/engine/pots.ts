export interface Contribution {
  seatId: number;
  amount: number;
  folded: boolean;
}

export interface Pot {
  amount: number;
  eligibleSeatIds: number[];
}

function sameSeatIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Splits total contributions into a main pot and side pots, layered at each
// distinct contribution level. A layer with no non-folded contributor (every
// payer at that level folded) has nowhere to go, so it carries forward onto
// the next layer that does have an eligible winner.
export function calculateSidePots(contributions: Contribution[]): Pot[] {
  const contributing = contributions.filter((c) => c.amount > 0);
  if (contributing.length === 0) return [];

  const levels = Array.from(new Set(contributing.map((c) => c.amount))).sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;
  let carry = 0;

  for (const level of levels) {
    const layerSize = level - previousLevel;
    const payers = contributing.filter((c) => c.amount >= level);
    const amount = layerSize * payers.length + carry;
    const eligibleSeatIds = payers.filter((c) => !c.folded).map((c) => c.seatId);

    if (eligibleSeatIds.length === 0) {
      carry = amount;
    } else {
      const lastPot = pots[pots.length - 1];
      // Consecutive layers with the same eligible winners (e.g. two players
      // who both cover a higher level than a third, already-settled all-in)
      // are one side pot, not several — merge rather than fragment them.
      if (lastPot && sameSeatIds(lastPot.eligibleSeatIds, eligibleSeatIds)) {
        lastPot.amount += amount;
      } else {
        pots.push({ amount, eligibleSeatIds });
      }
      carry = 0;
    }
    previousLevel = level;
  }

  if (carry > 0 && pots.length > 0) {
    pots[pots.length - 1].amount += carry;
  }

  return pots;
}
