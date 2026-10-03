import type { EngineState } from "./state";
import { nextSeatWithStatus } from "./seats";

function dealCards(state: EngineState, count: number): EngineState {
  const dealt = state.deck.slice(0, count);
  const deck = state.deck.slice(count);
  return { ...state, deck, game: { ...state.game, board: [...state.game.board, ...dealt] } };
}

// Deals the next street (or moves to showdown from the river) and resets
// betting-round bookkeeping. If no seat is left in "active" status (everyone
// remaining is all-in or folded), the resulting round has nothing to bet on —
// isBettingRoundComplete will report it complete immediately, so the caller's
// loop naturally runs the board out street by street without stalling.
export function advanceToNextRound(state: EngineState): EngineState {
  const round = state.game.bettingRound;

  let dealt: EngineState;
  let nextRound: "flop" | "turn" | "river" | "showdown";

  if (round === "preflop") {
    dealt = dealCards(state, 3);
    nextRound = "flop";
  } else if (round === "flop") {
    dealt = dealCards(state, 1);
    nextRound = "turn";
  } else if (round === "turn") {
    dealt = dealCards(state, 1);
    nextRound = "river";
  } else {
    return { ...state, game: { ...state.game, bettingRound: "showdown" } };
  }

  const actingSeat =
    nextSeatWithStatus(dealt.game.seats, dealt.game.dealerSeat, ["active"]) ??
    dealt.game.actingSeat;

  return {
    ...dealt,
    currentBet: 0,
    minRaise: dealt.bigBlind,
    roundContributions: {},
    actedSeatIds: [],
    game: { ...dealt.game, bettingRound: nextRound, actingSeat },
  };
}
