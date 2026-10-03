import type { Card, GameState, SeatState } from "@/types";
import { createDeck } from "./cards";
import type { Rng } from "./rng";
import { shuffle } from "./rng";
import { nextSeatWithStatus } from "./seats";

// Internal engine state. `game` is the broadcastable, authoritative subset
// (see GameState in /types); the rest is private betting-round bookkeeping
// the orchestrator never needs to see.
export interface EngineState {
  game: GameState;
  deck: Card[];
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  roundContributions: Record<number, number>; // seatId -> contributed this betting round
  totalContributions: Record<number, number>; // seatId -> contributed this whole hand
  actedSeatIds: number[]; // seats that have voluntarily acted this betting round
}

export interface StartHandParams {
  seats: SeatState[];
  handNumber: number;
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  rng: Rng;
}

export function startHand(params: StartHandParams): EngineState {
  const { seats, handNumber, dealerSeat, smallBlind, bigBlind, rng } = params;

  const eligibleIds = new Set(
    seats.filter((s) => s.personaId !== null && s.stack > 0).map((s) => s.seatId),
  );
  if (eligibleIds.size < 2) {
    throw new Error("startHand requires at least 2 seats with a persona and a positive stack");
  }

  // Ineligible seats are forced out of "active" status regardless of what was
  // passed in, so a stale or mislabeled seat can never get dealt into a hand
  // or get picked up by seat-rotation lookups.
  const resetSeats: SeatState[] = seats.map((s) =>
    eligibleIds.has(s.seatId)
      ? { ...s, status: "active", holeCards: [] }
      : { ...s, status: "eliminated", holeCards: [] },
  );

  const deck = shuffle(createDeck(), rng);

  const dealOrder: number[] = [];
  let cursor = nextSeatWithStatus(resetSeats, dealerSeat, ["active"]);
  if (cursor !== null) {
    for (let i = 0; i < eligibleIds.size; i++) {
      dealOrder.push(cursor as number);
      cursor = nextSeatWithStatus(resetSeats, cursor as number, ["active"]);
    }
  }

  const holeCards = new Map<number, Card[]>(dealOrder.map((seatId) => [seatId, []]));
  let deckIndex = 0;
  for (let round = 0; round < 2; round++) {
    for (const seatId of dealOrder) {
      holeCards.get(seatId)!.push(deck[deckIndex]);
      deckIndex++;
    }
  }

  const dealtSeats = resetSeats.map((s) =>
    holeCards.has(s.seatId) ? { ...s, holeCards: holeCards.get(s.seatId)! } : s,
  );

  const isHeadsUp = eligibleIds.size === 2;
  const sbSeatId = isHeadsUp
    ? dealerSeat
    : (nextSeatWithStatus(dealtSeats, dealerSeat, ["active"]) as number);
  const bbSeatId = isHeadsUp
    ? (nextSeatWithStatus(dealtSeats, dealerSeat, ["active"]) as number)
    : (nextSeatWithStatus(dealtSeats, sbSeatId, ["active"]) as number);

  const sbStackBefore = dealtSeats.find((s) => s.seatId === sbSeatId)!.stack;
  const bbStackBefore = dealtSeats.find((s) => s.seatId === bbSeatId)!.stack;
  const sbPaid = Math.min(smallBlind, sbStackBefore);
  const bbPaid = Math.min(bigBlind, bbStackBefore);

  const blindedSeats = dealtSeats.map((s) => {
    if (s.seatId === sbSeatId) {
      const stack = s.stack - sbPaid;
      return { ...s, stack, status: stack === 0 ? ("all_in" as const) : s.status };
    }
    if (s.seatId === bbSeatId) {
      const stack = s.stack - bbPaid;
      return { ...s, stack, status: stack === 0 ? ("all_in" as const) : s.status };
    }
    return s;
  });

  // Real hold'em's UTG rule: first to act preflop is the next seat after
  // the big blind. That wraps back to the dealer/SB in both heads-up (2
  // active seats: correct — dealer/SB acts first preflop) and exactly
  // 3-handed (also correct — the button doubles as UTG with no separate
  // seat left for it); at a full 4-max table it lands on the seat left of
  // the big blind, one seat short of wrapping all the way to the dealer.
  const actingSeat = nextSeatWithStatus(blindedSeats, bbSeatId, ["active"]) ?? dealerSeat;

  const game: GameState = {
    handNumber,
    potTotal: sbPaid + bbPaid,
    board: [],
    seats: blindedSeats,
    actingSeat,
    dealerSeat,
    bettingRound: "preflop",
  };

  return {
    game,
    deck: deck.slice(deckIndex),
    currentBet: bbPaid,
    minRaise: bigBlind,
    smallBlind,
    bigBlind,
    roundContributions: { [sbSeatId]: sbPaid, [bbSeatId]: bbPaid },
    totalContributions: { [sbSeatId]: sbPaid, [bbSeatId]: bbPaid },
    actedSeatIds: [],
  };
}
