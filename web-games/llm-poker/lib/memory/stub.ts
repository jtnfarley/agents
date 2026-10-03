import type { GetMemoryUpdates } from "./writer";

// Placeholder memory writer: leaves private memory untouched and never adds
// to the shared digest. Mirrors /lib/personas/stub.ts's role — the no-cost,
// no-API fallback for any persona deliberately held back via
// STUB_PERSONA_IDS (see ./dispatch.ts).
export const getStubMemoryUpdates: GetMemoryUpdates = async (input) => ({
  updatedPrivateMemory: input.existingPrivateMemory,
  newDigestEntries: [],
});
