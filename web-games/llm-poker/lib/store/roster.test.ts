import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/engine";
import { PERSONA_PROFILES } from "@/lib/personas/profiles";
import type { SeatState } from "@/types";
import {
  benchCandidates,
  hasOpenSeats,
  initialSeats,
  openEliminatedSeats,
  reconcileSeatsAfterHand,
  validateSeatFill,
  STARTING_SEAT_COUNT,
  STARTING_STACK,
} from "./roster";

const KNOWN_IDS = new Set(PERSONA_PROFILES.map((p) => p.id));

describe("initialSeats", () => {
  it("seats a random subset of known personas with fresh stacks and no hole cards", () => {
    const seats = initialSeats();
    expect(seats).toHaveLength(STARTING_SEAT_COUNT);
    const seatedIds = seats.map((s) => s.personaId);
    expect(new Set(seatedIds).size).toBe(STARTING_SEAT_COUNT);
    for (const id of seatedIds) {
      expect(KNOWN_IDS.has(id!)).toBe(true);
    }
    for (const seat of seats) {
      expect(seat.stack).toBe(STARTING_STACK);
      expect(seat.holeCards).toEqual([]);
      expect(seat.status).toBe("active");
    }
  });

  it("produces a different roster for different rng seeds", () => {
    const a = initialSeats(createRng(1)).map((s) => s.personaId);
    const b = initialSeats(createRng(2)).map((s) => s.personaId);
    expect(a).not.toEqual(b);
  });

  it("is reproducible for the same rng seed", () => {
    const a = initialSeats(createRng(42)).map((s) => s.personaId);
    const b = initialSeats(createRng(42)).map((s) => s.personaId);
    expect(a).toEqual(b);
  });
});

describe("benchCandidates", () => {
  it("excludes seated personas and includes everyone else", () => {
    const seats = initialSeats();
    const bench = benchCandidates(seats);
    const benchIds = bench.map((p) => p.id);
    const seatedIds = new Set(seats.map((s) => s.personaId));

    for (const id of benchIds) {
      expect(seatedIds.has(id)).toBe(false);
    }
    expect(benchIds).toHaveLength(PERSONA_PROFILES.length - STARTING_SEAT_COUNT);
  });

  it("includes a persona back in the pool once their seat opens", () => {
    const seats = initialSeats();
    const openedId = seats[0].personaId;
    const opened = seats.map((s) => (s.seatId === 0 ? { ...s, personaId: null } : s));
    const bench = benchCandidates(opened);
    expect(bench.map((p) => p.id)).toContain(openedId);
  });
});

describe("validateSeatFill", () => {
  function seats(seat0PersonaId: string | null): SeatState[] {
    return [
      { seatId: 0, personaId: seat0PersonaId, stack: STARTING_STACK, holeCards: [], status: "active" },
      { seatId: 1, personaId: "nietzsche", stack: STARTING_STACK, holeCards: [], status: "active" },
    ];
  }

  it("accepts a bench persona for a currently open seat", () => {
    expect(validateSeatFill(seats(null), 0, "mozart")).toBeNull();
  });

  it("rejects a seat that isn't open", () => {
    const result = validateSeatFill(seats("mozart"), 0, "diogenes");
    expect(result?.error).toMatch(/not open/);
  });

  it("rejects a seatId that doesn't exist", () => {
    const result = validateSeatFill(seats(null), 99, "mozart");
    expect(result?.error).toMatch(/no such seat/);
  });

  it("rejects a personaId that's already seated elsewhere", () => {
    const result = validateSeatFill(seats(null), 0, "nietzsche");
    expect(result?.error).toMatch(/not a valid candidate/);
  });

  it("rejects an unknown personaId", () => {
    const result = validateSeatFill(seats(null), 0, "not-a-real-persona");
    expect(result?.error).toMatch(/not a valid candidate/);
  });
});

describe("openEliminatedSeats", () => {
  function seat(overrides: Partial<SeatState> = {}): SeatState {
    return { seatId: 0, personaId: "sappho", stack: 0, holeCards: [], status: "active", ...overrides };
  }

  it("nulls personaId only for seats that are eliminated with a persona still set", () => {
    const seats = [
      seat({ seatId: 0, status: "eliminated", personaId: "sappho" }),
      seat({ seatId: 1, status: "active", personaId: "mozart", stack: 500 }),
    ];
    const result = openEliminatedSeats(seats);

    expect(result.eliminatedSeatIds).toEqual([0]);
    expect(result.seats.find((s) => s.seatId === 0)?.personaId).toBeNull();
    expect(result.seats.find((s) => s.seatId === 1)?.personaId).toBe("mozart");
  });

  it("is a no-op when nothing is eliminated", () => {
    const seats = [seat({ seatId: 0, status: "active", stack: 500 })];
    const result = openEliminatedSeats(seats);
    expect(result.eliminatedSeatIds).toEqual([]);
    expect(result.seats).toBe(seats);
  });

  it("does not re-null a seat that's already open", () => {
    const seats = [seat({ seatId: 0, status: "eliminated", personaId: null })];
    const result = openEliminatedSeats(seats);
    expect(result.eliminatedSeatIds).toEqual([]);
  });
});

describe("hasOpenSeats", () => {
  function seat(overrides: Partial<SeatState> = {}): SeatState {
    return { seatId: 0, personaId: "sappho", stack: 500, holeCards: [], status: "active", ...overrides };
  }

  it("is false when every seat has a persona", () => {
    const seats = [seat({ seatId: 0 }), seat({ seatId: 1, personaId: "mozart" })];
    expect(hasOpenSeats(seats)).toBe(false);
  });

  it("is true when at least one seat is open", () => {
    const seats = [
      seat({ seatId: 0 }),
      seat({ seatId: 1, personaId: null, status: "eliminated" }),
    ];
    expect(hasOpenSeats(seats)).toBe(true);
  });

  it("is true when multiple seats are still open", () => {
    const seats = [
      seat({ seatId: 0, personaId: null, status: "eliminated" }),
      seat({ seatId: 1, personaId: null, status: "eliminated" }),
    ];
    expect(hasOpenSeats(seats)).toBe(true);
  });
});

describe("reconcileSeatsAfterHand", () => {
  function seat(overrides: Partial<SeatState> = {}): SeatState {
    return { seatId: 0, personaId: "sappho", stack: 500, holeCards: [], status: "active", ...overrides };
  }

  it("prefers the live seat when a spectator filled a still-open seat while the hand was in flight", () => {
    // Seat 1 was open when the hand started and the hand never touched it,
    // so the hand's result still shows it open — but a spectator filled it
    // via fillSeat while that hand was playing out, so the live array (what
    // tableStore actually holds right now) already has the fill.
    const liveSeats = [
      seat({ seatId: 0, personaId: "sappho", stack: 480 }),
      seat({ seatId: 1, personaId: "mozart", stack: STARTING_STACK, status: "active" }),
    ];
    const postHandSeats = [
      seat({ seatId: 0, personaId: "sappho", stack: 480 }),
      seat({ seatId: 1, personaId: null, status: "eliminated" }),
    ];

    const result = reconcileSeatsAfterHand(liveSeats, postHandSeats);

    expect(result.find((s) => s.seatId === 0)).toEqual(postHandSeats[0]);
    expect(result.find((s) => s.seatId === 1)).toEqual(liveSeats[1]);
  });

  it("leaves a seat that's still open in both alone", () => {
    const liveSeats = [seat({ seatId: 1, personaId: null, status: "eliminated" })];
    const postHandSeats = [seat({ seatId: 1, personaId: null, status: "eliminated" })];

    const result = reconcileSeatsAfterHand(liveSeats, postHandSeats);
    expect(result).toEqual(postHandSeats);
  });

  it("never overrides a seat the hand actually decided (personaId set post-hand)", () => {
    // Seat 0 genuinely busted this hand and is now eliminated with its
    // personaId still set (per the engine's contract) — the live array must
    // never be consulted for a seat like this, only for ones left null.
    const liveSeats = [seat({ seatId: 0, personaId: "sappho", stack: 1000, status: "active" })];
    const postHandSeats = [seat({ seatId: 0, personaId: "sappho", stack: 0, status: "eliminated" })];

    const result = reconcileSeatsAfterHand(liveSeats, postHandSeats);
    expect(result).toEqual(postHandSeats);
  });
});
