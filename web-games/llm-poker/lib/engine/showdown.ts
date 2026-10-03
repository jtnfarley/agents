import type { SeatState } from "@/types";
import type { EngineState } from "./state";
import { calculateSidePots, type Contribution } from "./pots";
import { evaluateHand, compareHandRanks, type HandRank } from "./handRank";

export interface Payout {
  seatId: number;
  amount: number;
}

export interface ResolvedHand {
  state: EngineState;
  payouts: Payout[];
}

function contendersRemaining(state: EngineState): SeatState[] {
  return state.game.seats.filter((s) => s.status === "active" || s.status === "all_in");
}

// Awards the pot (immediate fold-out win, or side-pot-aware showdown) and
// marks any seat left with a zero stack as eliminated.
export function resolveHand(state: EngineState): ResolvedHand {
  const remaining = contendersRemaining(state);

  const payouts: Payout[] =
    remaining.length <= 1
      ? remaining.map((s) => ({ seatId: s.seatId, amount: state.game.potTotal }))
      : resolveShowdownPayouts(state);

  const payoutBySeat = new Map(payouts.map((p) => [p.seatId, p.amount]));
  const seats = state.game.seats.map((s) => {
    const won = payoutBySeat.get(s.seatId) ?? 0;
    const stack = s.stack + won;
    return { ...s, stack, status: stack === 0 ? ("eliminated" as const) : s.status };
  });

  return {
    state: {
      ...state,
      game: { ...state.game, seats, potTotal: 0, bettingRound: "showdown" },
    },
    payouts,
  };
}

function resolveShowdownPayouts(state: EngineState): Payout[] {
  const inHand = state.game.seats.filter((s) => (state.totalContributions[s.seatId] ?? 0) > 0);

  const contributions: Contribution[] = inHand.map((s) => ({
    seatId: s.seatId,
    amount: state.totalContributions[s.seatId] ?? 0,
    folded: s.status === "folded",
  }));

  const pots = calculateSidePots(contributions);
  const totals = new Map<number, number>();

  for (const pot of pots) {
    const eligible: { seat: SeatState; rank: HandRank }[] = pot.eligibleSeatIds.map((seatId) => {
      const seat = inHand.find((s) => s.seatId === seatId)!;
      return { seat, rank: evaluateHand([...seat.holeCards, ...state.game.board]) };
    });

    let winners = [eligible[0]];
    for (const candidate of eligible.slice(1)) {
      const cmp = compareHandRanks(candidate.rank, winners[0].rank);
      if (cmp > 0) winners = [candidate];
      else if (cmp === 0) winners.push(candidate);
    }

    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;

    const sortedWinners = [...winners].sort((a, b) => a.seat.seatId - b.seat.seatId);
    for (const winner of sortedWinners) {
      const bonus = remainder > 0 ? 1 : 0;
      remainder -= bonus;
      totals.set(winner.seat.seatId, (totals.get(winner.seat.seatId) ?? 0) + share + bonus);
    }
  }

  return Array.from(totals.entries()).map(([seatId, amount]) => ({ seatId, amount }));
}
