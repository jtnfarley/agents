import type { LegalAction, SeatState } from "@/types";
import type { EngineState } from "./state";
import { nextSeatWithStatus } from "./seats";

export interface ActionInput {
  type: "fold" | "check" | "call" | "raise";
  amount?: number; // raise-to total this round; required for "raise", ignored otherwise
}

export function getLegalActions(state: EngineState, seatId: number): LegalAction[] {
  const seat = state.game.seats.find((s) => s.seatId === seatId);
  if (!seat || seat.status !== "active") return [];

  const committed = state.roundContributions[seatId] ?? 0;
  const toCall = state.currentBet - committed;
  const actions: LegalAction[] = [];

  if (toCall <= 0) {
    actions.push({ type: "check" });
    if (seat.stack > 0) {
      actions.push(raiseAction(state, committed, seat.stack));
    }
  } else {
    actions.push({ type: "fold" });
    actions.push({ type: "call" });
    if (seat.stack > toCall) {
      actions.push(raiseAction(state, committed, seat.stack));
    }
  }

  return actions;
}

function raiseAction(state: EngineState, committed: number, stack: number): LegalAction {
  const maxAmount = committed + stack;
  const minAmount = Math.min(state.currentBet + state.minRaise, maxAmount);
  return { type: "raise", minAmount, maxAmount };
}

export function isBettingRoundComplete(state: EngineState): boolean {
  const activeSeats = state.game.seats.filter((s) => s.status === "active");
  if (activeSeats.length === 0) return true;
  return activeSeats.every(
    (s) =>
      state.actedSeatIds.includes(s.seatId) &&
      (state.roundContributions[s.seatId] ?? 0) === state.currentBet,
  );
}

export function contendersRemaining(state: EngineState): SeatState[] {
  return state.game.seats.filter((s) => s.status === "active" || s.status === "all_in");
}

export function isHandDecidedByFolds(state: EngineState): boolean {
  return contendersRemaining(state).length <= 1;
}

export function applyAction(state: EngineState, seatId: number, action: ActionInput): EngineState {
  const legalActions = getLegalActions(state, seatId);
  const legal = legalActions.find((a) => a.type === action.type);
  if (!legal) {
    throw new Error(`Seat ${seatId} cannot ${action.type} — not a legal action`);
  }

  const seat = state.game.seats.find((s) => s.seatId === seatId)!;
  const committed = state.roundContributions[seatId] ?? 0;

  switch (action.type) {
    case "fold":
      return applyFold(state, seatId);
    case "check":
      return applyContribution(state, seatId, 0, { markActed: true });
    case "call": {
      const toCall = state.currentBet - committed;
      const paid = Math.min(toCall, seat.stack);
      return applyContribution(state, seatId, paid, { markActed: true });
    }
    case "raise": {
      const amount = action.amount;
      if (amount === undefined) {
        throw new Error("raise requires an amount");
      }
      if (amount < (legal.minAmount ?? 0) || amount > (legal.maxAmount ?? Infinity)) {
        throw new Error(
          `Raise amount ${amount} out of legal range [${legal.minAmount}, ${legal.maxAmount}]`,
        );
      }
      const paid = amount - committed;
      const raiseIncrement = amount - state.currentBet;
      const next = applyContribution(state, seatId, paid, {
        markActed: true,
        resetOthersActed: true,
      });
      return {
        ...next,
        currentBet: amount,
        minRaise: raiseIncrement >= state.minRaise ? raiseIncrement : state.minRaise,
      };
    }
  }
}

function applyFold(state: EngineState, seatId: number): EngineState {
  const seats = state.game.seats.map((s) =>
    s.seatId === seatId ? { ...s, status: "folded" as const } : s,
  );
  const actingSeat = nextSeatWithStatus(seats, seatId, ["active"]) ?? state.game.actingSeat;
  const actedSeatIds = state.actedSeatIds.includes(seatId)
    ? state.actedSeatIds
    : [...state.actedSeatIds, seatId];

  return {
    ...state,
    game: { ...state.game, seats, actingSeat },
    actedSeatIds,
  };
}

function applyContribution(
  state: EngineState,
  seatId: number,
  paid: number,
  opts: { markActed: boolean; resetOthersActed?: boolean },
): EngineState {
  const seats = state.game.seats.map((s) => {
    if (s.seatId !== seatId) return s;
    const stack = s.stack - paid;
    return { ...s, stack, status: stack === 0 ? ("all_in" as const) : s.status };
  });

  const roundContributions = {
    ...state.roundContributions,
    [seatId]: (state.roundContributions[seatId] ?? 0) + paid,
  };
  const totalContributions = {
    ...state.totalContributions,
    [seatId]: (state.totalContributions[seatId] ?? 0) + paid,
  };

  let actedSeatIds = opts.resetOthersActed ? [] : state.actedSeatIds;
  if (opts.markActed && !actedSeatIds.includes(seatId)) {
    actedSeatIds = [...actedSeatIds, seatId];
  }

  const actingSeat = nextSeatWithStatus(seats, seatId, ["active"]) ?? state.game.actingSeat;

  return {
    ...state,
    game: {
      ...state.game,
      seats,
      potTotal: state.game.potTotal + paid,
      actingSeat,
    },
    roundContributions,
    totalContributions,
    actedSeatIds,
  };
}
