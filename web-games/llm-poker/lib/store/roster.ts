import { createRng, shuffle, type Rng } from "@/lib/engine";
import { PERSONA_PROFILES } from "@/lib/personas/profiles";
import type { PersonaProfile, SeatState } from "@/types";

// Seat count and stack per docs/SPEC.md's MVP game parameters. The roster
// itself isn't fixed — initialSeats draws a random 5 from the full persona
// list each time a table is created, so who starts seated vs. on the bench
// varies run to run.
export const STARTING_SEAT_COUNT = 4;
export const STARTING_STACK = 1000;

export function initialSeats(rng: Rng = createRng(Date.now())): SeatState[] {
  const roster = shuffle(PERSONA_PROFILES, rng).slice(0, STARTING_SEAT_COUNT);
  return roster.map((persona, seatId) => ({
    seatId,
    personaId: persona.id,
    stack: STARTING_STACK,
    holeCards: [],
    status: "active",
  }));
}

// Bench pool offered to spectators on a seat_open event: any known persona
// not currently occupying a seat.
export function benchCandidates(seats: SeatState[]): PersonaProfile[] {
  const seatedIds = new Set(seats.filter((s) => s.personaId !== null).map((s) => s.personaId));
  return PERSONA_PROFILES.filter((p) => !seatedIds.has(p.id));
}

export interface SeatFillValidationError {
  error: string;
}

// Shared validation for POST /api/table/seat (see docs/SPEC.md's API
// contract: 400 if the seat isn't open, or personaId isn't a current
// candidate). Kept here as a pure function of seats so it's testable
// without spinning up the store or an HTTP request.
export function validateSeatFill(
  seats: SeatState[],
  seatId: number,
  personaId: string,
): SeatFillValidationError | null {
  const seat = seats.find((s) => s.seatId === seatId);
  if (!seat) return { error: `no such seat: ${seatId}` };
  if (seat.personaId !== null) return { error: `seat ${seatId} is not open` };

  const candidates = benchCandidates(seats);
  if (!candidates.some((c) => c.id === personaId)) {
    return { error: `${personaId} is not a valid candidate for seat ${seatId}` };
  }

  return null;
}

// A hand's result seats array reflects the state of every seat, including
// ones that were open (personaId null) both before and after it — startHand
// keeps them in place, just stamped "eliminated" (see /lib/engine/state.ts).
// Hands run over several real seconds (see tableStore's actionDelayMs /
// handCompleteDelayMs), so a spectator can fill one of several open seats,
// which resumes the loop immediately with a snapshot that still shows the
// *other* open seats as empty — then fill those too while that hand is still
// playing out. Blindly overwriting the live seats array with the hand's
// (now-stale) result would silently revert those later fills. For any seat
// the hand left open, prefer whatever the live array currently holds.
export function reconcileSeatsAfterHand(liveSeats: SeatState[], postHandSeats: SeatState[]): SeatState[] {
  return postHandSeats.map((seat) => {
    if (seat.personaId !== null) return seat;
    const liveSeat = liveSeats.find((s) => s.seatId === seat.seatId);
    return liveSeat && liveSeat.personaId !== null ? liveSeat : seat;
  });
}

// A hand can bust several seats at once, which opens all of them together —
// but spectators fill them one HTTP request at a time. Resuming as soon as
// the first fill lands would kick off a hand short a player while the rest
// are still in flight; the store checks this after every fill and only
// resumes once every open seat has been taken.
export function hasOpenSeats(seats: SeatState[]): boolean {
  return seats.some((s) => s.personaId === null);
}

export interface EliminationResult {
  seats: SeatState[];
  eliminatedSeatIds: number[];
}

// After a hand resolves, the engine marks a zero-stack seat "eliminated"
// but leaves personaId set (see /lib/engine/showdown.ts) — that's an engine
// concern (it doesn't know about spectators or seat refills). The store is
// what actually opens the seat for the refill flow: personaId -> null, per
// SeatState's "null = open seat" contract.
export function openEliminatedSeats(seats: SeatState[]): EliminationResult {
  const eliminatedSeatIds = seats
    .filter((s) => s.status === "eliminated" && s.personaId !== null)
    .map((s) => s.seatId);

  if (eliminatedSeatIds.length === 0) {
    return { seats, eliminatedSeatIds };
  }

  const eliminated = new Set(eliminatedSeatIds);
  return {
    seats: seats.map((s) => (eliminated.has(s.seatId) ? { ...s, personaId: null } : s)),
    eliminatedSeatIds,
  };
}
