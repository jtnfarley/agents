import { getPostHandMemoryUpdatesForPersona, type GetMemoryUpdates, type MemoryStore } from "@/lib/memory";
import type { HandEvent } from "@/types";

export interface ApplyPostHandMemoryOptions {
  getMemoryUpdates?: GetMemoryUpdates;
}

// Runs the post-hand memory writer for every persona who took part in the
// hand and folds the result into the store. Deliberately separate from
// playHand's turn loop — this is the "off the critical path" cheap call
// from docs/SPEC.md, meant to run after a hand resolves, not block the next
// one's first action.
export async function applyPostHandMemory(
  events: HandEvent[],
  handNumber: number,
  memoryStore: MemoryStore,
  options: ApplyPostHandMemoryOptions = {},
): Promise<void> {
  const getUpdates = options.getMemoryUpdates ?? getPostHandMemoryUpdatesForPersona;
  const personaIds = [...new Set(events.map((e) => e.personaId))];

  await Promise.all(
    personaIds.map(async (personaId) => {
      const output = await getUpdates(
        {
          personaId,
          existingPrivateMemory: memoryStore.getPrivateMemory(personaId),
          handEventLog: events,
        },
        handNumber,
      );
      memoryStore.applyMemoryWriterOutput(personaId, output);
    }),
  );
}
