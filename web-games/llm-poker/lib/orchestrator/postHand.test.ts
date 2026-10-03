import { describe, expect, it } from "vitest";
import type { GetMemoryUpdates } from "@/lib/memory";
import { createMemoryStore } from "@/lib/memory";
import type { HandEvent } from "@/types";
import { applyPostHandMemory } from "./postHand";

function handEvent(overrides: Partial<HandEvent> = {}): HandEvent {
  return {
    seatId: 0,
    personaId: "diogenes",
    action: "call",
    amount: 20,
    reasoning: "reasoning",
    dialogue: "dialogue",
    bettingRound: "preflop",
    ...overrides,
  };
}

describe("applyPostHandMemory", () => {
  it("calls the memory writer once per distinct persona in the hand and applies each result", async () => {
    const store = createMemoryStore();
    const calledFor: string[] = [];
    const fakeGetUpdates: GetMemoryUpdates = async (input) => {
      calledFor.push(input.personaId);
      return {
        updatedPrivateMemory: [
          { type: "self_correction", target: null, note: `note for ${input.personaId}`, importance: 3 },
        ],
        newDigestEntries: [],
      };
    };

    const events = [
      handEvent({ personaId: "diogenes", bettingRound: "preflop" }),
      handEvent({ personaId: "sappho", bettingRound: "preflop" }),
      handEvent({ personaId: "diogenes", bettingRound: "flop" }),
    ];

    await applyPostHandMemory(events, 5, store, { getMemoryUpdates: fakeGetUpdates });

    expect(calledFor.sort()).toEqual(["diogenes", "sappho"]);
    expect(store.getPrivateMemory("diogenes").map((m) => m.note)).toEqual(["note for diogenes"]);
    expect(store.getPrivateMemory("sappho").map((m) => m.note)).toEqual(["note for sappho"]);
  });

  it("passes each persona's own existing private memory into the writer call", async () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput("diogenes", {
      updatedPrivateMemory: [{ type: "tell_noticed", target: "sappho", note: "prior note", importance: 3 }],
      newDigestEntries: [],
    });

    let seenExistingMemory: unknown;
    const fakeGetUpdates: GetMemoryUpdates = async (input) => {
      if (input.personaId === "diogenes") seenExistingMemory = input.existingPrivateMemory;
      return { updatedPrivateMemory: [], newDigestEntries: [] };
    };

    await applyPostHandMemory([handEvent({ personaId: "diogenes" })], 2, store, {
      getMemoryUpdates: fakeGetUpdates,
    });

    expect(seenExistingMemory).toEqual([
      { type: "tell_noticed", target: "sappho", note: "prior note", importance: 3 },
    ]);
  });

  it("merges newDigestEntries from every persona into the shared digest", async () => {
    const store = createMemoryStore();
    const fakeGetUpdates: GetMemoryUpdates = async (input) => ({
      updatedPrivateMemory: [],
      newDigestEntries: [{ note: `${input.personaId} saw something`, importance: 3, handWritten: 3 }],
    });

    await applyPostHandMemory(
      [handEvent({ personaId: "diogenes" }), handEvent({ personaId: "sappho" })],
      3,
      store,
      { getMemoryUpdates: fakeGetUpdates },
    );

    expect(store.getTableDigest().map((d) => d.note).sort()).toEqual([
      "diogenes saw something",
      "sappho saw something",
    ]);
  });
});
