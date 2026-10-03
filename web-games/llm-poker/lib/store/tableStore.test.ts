import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribe, type TableEvent } from "@/lib/events";
import { PERSONA_PROFILES } from "@/lib/personas/profiles";
import { createTableStore } from "./tableStore";
import { STARTING_SEAT_COUNT } from "./roster";

describe("createTableStore", () => {
  // These tests want the deterministic, no-network stub regardless of the
  // ambient STUB_PERSONA_IDS config a real table would run with.
  const ORIGINAL_ENV = process.env.STUB_PERSONA_IDS;
  beforeEach(() => {
    process.env.STUB_PERSONA_IDS = "*";
  });
  afterEach(() => {
    process.env.STUB_PERSONA_IDS = ORIGINAL_ENV;
  });

  it("has a ready initial GameState with a random 5-persona roster before any hand is played", () => {
    const store = createTableStore({ actionDelayMs: 0, handCompleteDelayMs: 0 });
    const state = store.getGameState();
    const seatedIds = state.seats.map((s) => s.personaId);
    expect(seatedIds).toHaveLength(STARTING_SEAT_COUNT);
    expect(new Set(seatedIds).size).toBe(STARTING_SEAT_COUNT);
    for (const id of seatedIds) {
      expect(PERSONA_PROFILES.some((p) => p.id === id)).toBe(true);
    }
    expect(state.handNumber).toBe(0);
  });

  it("plays hands via the stub personas and broadcasts state_update, dialogue, and hand_complete", async () => {
    const store = createTableStore({ actionDelayMs: 0, handCompleteDelayMs: 0 });
    const seenTypes = new Set<TableEvent["type"]>();

    await new Promise<void>((resolve) => {
      const unsubscribe = subscribe((event) => {
        seenTypes.add(event.type);
        if (event.type === "hand_complete") {
          store.pause();
          unsubscribe();
          resolve();
        }
      });
      store.start();
    });

    expect(seenTypes.has("state_update")).toBe(true);
    expect(seenTypes.has("dialogue")).toBe(true);
    expect(seenTypes.has("hand_complete")).toBe(true);
    expect(store.getGameState().handNumber).toBeGreaterThanOrEqual(1);
  }, 10_000);

  it("fillSeat updates the seat, resets that persona's memory, and publishes seat_filled", () => {
    const store = createTableStore({ actionDelayMs: 0, handCompleteDelayMs: 0 });
    const events: TableEvent[] = [];
    const unsubscribe = subscribe((e) => events.push(e));

    const seatedIds = new Set(store.getGameState().seats.map((s) => s.personaId));
    const benchPersonaId = PERSONA_PROFILES.find((p) => !seatedIds.has(p.id))!.id;

    store.fillSeat(0, benchPersonaId);

    const seat = store.getGameState().seats.find((s) => s.seatId === 0);
    expect(seat?.personaId).toBe(benchPersonaId);
    expect(seat?.stack).toBe(1000);
    expect(events.some((e) => e.type === "seat_filled")).toBe(true);
    unsubscribe();
  });
});
