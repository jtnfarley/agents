import { isLivePersona } from "@/lib/personas/liveConfig";
import type { MemoryWriterInput, MemoryWriterOutput } from "@/types";
import { getStubMemoryUpdates } from "./stub";
import { getPostHandMemoryUpdates } from "./writer";

// Dispatcher applyPostHandMemory defaults to: real Claude call for personas
// that are live (i.e. not listed in STUB_PERSONA_IDS), the no-op stub for
// personas deliberately held back. Mirrors /lib/personas/index.ts's
// getPersonaTurn dispatcher, and deliberately shares its live/stub switch
// (@/lib/personas/liveConfig) so both go live for a persona together.
export async function getPostHandMemoryUpdatesForPersona(
  input: MemoryWriterInput,
  handNumber: number,
): Promise<MemoryWriterOutput> {
  if (!isLivePersona(input.personaId)) {
    return getStubMemoryUpdates(input, handNumber);
  }
  return getPostHandMemoryUpdates(input, handNumber);
}
