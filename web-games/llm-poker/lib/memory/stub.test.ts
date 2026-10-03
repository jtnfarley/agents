import { describe, expect, it } from "vitest";
import type { MemoryWriterInput } from "@/types";
import { getStubMemoryUpdates } from "./stub";

describe("getStubMemoryUpdates", () => {
  it("returns the existing private memory unchanged and no new digest entries", async () => {
    const input: MemoryWriterInput = {
      personaId: "diogenes",
      existingPrivateMemory: [{ type: "tell_noticed", target: "sappho", note: "note", importance: 3 }],
      handEventLog: [],
    };

    const result = await getStubMemoryUpdates(input, 5);

    expect(result.updatedPrivateMemory).toBe(input.existingPrivateMemory);
    expect(result.newDigestEntries).toEqual([]);
  });
});
