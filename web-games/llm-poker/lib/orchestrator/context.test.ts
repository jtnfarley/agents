import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/engine";
import { startHand } from "@/lib/engine";
import { createMemoryStore } from "@/lib/memory";
import type { SeatState } from "@/types";
import { buildPersonaPromptContextWithMemory } from "./context";

function seat(seatId: number, personaId: string): SeatState {
  return { seatId, personaId, stack: 1000, holeCards: [], status: "active" };
}

function stateWithSeats(seats: SeatState[], handNumber = 1) {
  return startHand({
    seats,
    handNumber,
    dealerSeat: 0,
    smallBlind: 10,
    bigBlind: 20,
    rng: createRng(1),
  });
}

describe("buildPersonaPromptContextWithMemory", () => {
  it("gives a persona seated cold an empty private memory but a populated table digest", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput("nietzsche", {
      updatedPrivateMemory: [],
      newDigestEntries: [{ note: "the table went wild last hand", importance: 3, handWritten: 1 }],
    });

    const state = stateWithSeats([seat(0, "mozart"), seat(1, "nietzsche")], 1);
    const context = buildPersonaPromptContextWithMemory(state, 0, store);

    expect(context.privateMemory).toEqual([]);
    expect(context.tableDigest.map((d) => d.note)).toEqual(["the table went wild last hand"]);
  });

  it("drops private memory entries about seats no longer at the table", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput("sappho", {
      updatedPrivateMemory: [
        { type: "tell_noticed", target: "diogenes", note: "bluffs on the river", importance: 4 },
        { type: "self_correction", target: null, note: "played too tight preflop", importance: 2 },
      ],
      newDigestEntries: [],
    });

    const state = stateWithSeats([seat(0, "sappho"), seat(1, "mozart")], 1);
    const context = buildPersonaPromptContextWithMemory(state, 0, store);

    expect(context.privateMemory.map((m) => m.note)).toEqual(["played too tight preflop"]);
  });

  it("drops table digest entries older than the decay window", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput("sappho", {
      updatedPrivateMemory: [],
      newDigestEntries: [{ note: "ancient history", importance: 5, handWritten: 1 }],
    });

    const state = stateWithSeats([seat(0, "sappho"), seat(1, "mozart")], 10);
    const context = buildPersonaPromptContextWithMemory(state, 0, store);

    expect(context.tableDigest).toEqual([]);
  });

  it("defaults to an empty hand action log and otherwise passes the given log through unchanged", () => {
    const store = createMemoryStore();
    const state = stateWithSeats([seat(0, "sappho"), seat(1, "mozart")], 1);

    expect(buildPersonaPromptContextWithMemory(state, 0, store).handActionLog).toEqual([]);

    const log = [
      {
        seatId: 1,
        personaId: "mozart",
        action: "call" as const,
        amount: 0,
        dialogue: "A pleasant little call.",
        bettingRound: "preflop" as const,
      },
    ];
    const context = buildPersonaPromptContextWithMemory(state, 0, store, log);
    expect(context.handActionLog).toEqual(log);
  });

  it("defaults to no active discussion topic and otherwise passes the given one through unchanged", () => {
    const store = createMemoryStore();
    const state = stateWithSeats([seat(0, "sappho"), seat(1, "mozart")], 1);

    expect(buildPersonaPromptContextWithMemory(state, 0, store).discussionTopic).toBeNull();

    const topic = { topic: "Who bluffs best?", raisedByPersonaId: "mozart", handNumber: 1 };
    const context = buildPersonaPromptContextWithMemory(state, 0, store, [], topic);
    expect(context.discussionTopic).toEqual(topic);
  });
});
