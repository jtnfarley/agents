import type { SeatState } from "@/types";

// Finds the next seatId, in seatId order wrapping around, whose status is
// one of `statuses`. Returns null if no seat qualifies.
export function nextSeatWithStatus(
  seats: SeatState[],
  fromSeatId: number,
  statuses: SeatState["status"][],
): number | null {
  const ids = seats.map((s) => s.seatId).sort((a, b) => a - b);
  const startIndex = ids.indexOf(fromSeatId);
  if (startIndex === -1) {
    throw new Error(`Seat ${fromSeatId} is not part of this table`);
  }
  for (let i = 1; i <= ids.length; i++) {
    const candidateId = ids[(startIndex + i) % ids.length];
    const seat = seats.find((s) => s.seatId === candidateId);
    if (seat && statuses.includes(seat.status)) return candidateId;
  }
  return null;
}
