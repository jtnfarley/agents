import { describe, expect, it } from "vitest";
import type { MemoryWriterOutput, PrivateMemoryEntry } from "@/types";
import { capPrivateMemory, createMemoryStore, MAX_PRIVATE_MEMORY_ENTRIES } from "./store";

function privateEntry(overrides: Partial<PrivateMemoryEntry> = {}): PrivateMemoryEntry {
  return { type: "tell_noticed", target: null, note: "note", importance: 3, ...overrides };
}

function output(overrides: Partial<MemoryWriterOutput> = {}): MemoryWriterOutput {
  return { updatedPrivateMemory: [], newDigestEntries: [], ...overrides };
}

describe("capPrivateMemory", () => {
  it("leaves a list at or under the cap untouched", () => {
    const entries = [privateEntry(), privateEntry()];
    expect(capPrivateMemory(entries)).toEqual(entries);
  });

  it("prunes lowest-importance entries first once over the cap", () => {
    const entries = [
      privateEntry({ note: "low", importance: 1 }),
      privateEntry({ note: "a", importance: 5 }),
      privateEntry({ note: "b", importance: 4 }),
      privateEntry({ note: "c", importance: 4 }),
      privateEntry({ note: "d", importance: 3 }),
      privateEntry({ note: "e", importance: 3 }),
      privateEntry({ note: "lowest", importance: 1 }),
    ];
    const result = capPrivateMemory(entries);
    expect(result).toHaveLength(MAX_PRIVATE_MEMORY_ENTRIES);
    expect(result.map((e) => e.note)).not.toContain("lowest");
    // Ties within the kept set are broken by original order, and the
    // pruned entry was the *last* importance-1 entry — "low" survives.
    expect(result.map((e) => e.note)).toContain("low");
  });
});

describe("createMemoryStore", () => {
  it("returns an empty private memory list for a persona never written to", () => {
    const store = createMemoryStore();
    expect(store.getPrivateMemory("sappho")).toEqual([]);
  });

  it("applies writer output per persona without cross-contamination", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput(
      "sappho",
      output({ updatedPrivateMemory: [privateEntry({ note: "sappho's note" })] }),
    );
    store.applyMemoryWriterOutput(
      "diogenes",
      output({ updatedPrivateMemory: [privateEntry({ note: "diogenes's note" })] }),
    );

    expect(store.getPrivateMemory("sappho").map((e) => e.note)).toEqual(["sappho's note"]);
    expect(store.getPrivateMemory("diogenes").map((e) => e.note)).toEqual(["diogenes's note"]);
  });

  it("accumulates newDigestEntries into a single shared digest", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput(
      "sappho",
      output({ newDigestEntries: [{ note: "sappho saw a big bluff", importance: 3, handWritten: 1 }] }),
    );
    store.applyMemoryWriterOutput(
      "diogenes",
      output({ newDigestEntries: [{ note: "diogenes mocked the bluff", importance: 2, handWritten: 1 }] }),
    );

    expect(store.getTableDigest().map((e) => e.note)).toEqual([
      "sappho saw a big bluff",
      "diogenes mocked the bluff",
    ]);
  });

  it("clears only the target persona's private memory on resetPrivateMemory, leaving the digest alone", () => {
    const store = createMemoryStore();
    store.applyMemoryWriterOutput(
      "sappho",
      output({
        updatedPrivateMemory: [privateEntry({ note: "stale from a prior stint" })],
        newDigestEntries: [{ note: "shared moment", importance: 3, handWritten: 1 }],
      }),
    );

    store.resetPrivateMemory("sappho");

    expect(store.getPrivateMemory("sappho")).toEqual([]);
    expect(store.getTableDigest().map((e) => e.note)).toEqual(["shared moment"]);
  });
});
