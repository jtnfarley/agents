import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryWriterInput } from "@/types";

function input(personaId: string): MemoryWriterInput {
  return { personaId, existingPrivateMemory: [], handEventLog: [] };
}

const ORIGINAL_ENV = process.env.STUB_PERSONA_IDS;

afterEach(() => {
  process.env.STUB_PERSONA_IDS = ORIGINAL_ENV;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("getPostHandMemoryUpdatesForPersona dispatcher", () => {
  it("uses the stub when the personaId is listed in STUB_PERSONA_IDS", async () => {
    process.env.STUB_PERSONA_IDS = "diogenes";
    vi.resetModules();
    const writerModule = await import("./writer");
    const writerSpy = vi.spyOn(writerModule, "getPostHandMemoryUpdates");
    const { getPostHandMemoryUpdatesForPersona } = await import("./dispatch");

    const result = await getPostHandMemoryUpdatesForPersona(input("diogenes"), 1);

    expect(writerSpy).not.toHaveBeenCalled();
    expect(result.newDigestEntries).toEqual([]);
  });

  it("calls the real writer by default when STUB_PERSONA_IDS is unset", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    const writerModule = await import("./writer");
    const writerSpy = vi
      .spyOn(writerModule, "getPostHandMemoryUpdates")
      .mockResolvedValue({ updatedPrivateMemory: [], newDigestEntries: [] });
    const { getPostHandMemoryUpdatesForPersona } = await import("./dispatch");

    await getPostHandMemoryUpdatesForPersona(input("diogenes"), 1);

    expect(writerSpy).toHaveBeenCalledTimes(1);
  });
});
