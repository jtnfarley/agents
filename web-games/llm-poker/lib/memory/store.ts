import type { MemoryWriterOutput, PrivateMemoryEntry, TableDigestEntry } from "@/types";

export const MAX_PRIVATE_MEMORY_ENTRIES = 6;

// Enforces the hard cap ourselves rather than trusting the writer call to
// obey it: keep the highest-importance entries, and among ties keep
// whichever came first in the model's own ordering.
export function capPrivateMemory(entries: PrivateMemoryEntry[]): PrivateMemoryEntry[] {
  if (entries.length <= MAX_PRIVATE_MEMORY_ENTRIES) return entries;
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.importance - a.entry.importance || a.index - b.index)
    .slice(0, MAX_PRIVATE_MEMORY_ENTRIES)
    .sort((a, b) => a.index - b.index)
    .map(({ entry }) => entry);
}

export interface MemoryStore {
  getPrivateMemory(personaId: string): PrivateMemoryEntry[];
  getTableDigest(): TableDigestEntry[];
  applyMemoryWriterOutput(personaId: string, output: MemoryWriterOutput): void;
  // Seat-refill cold start: a spectator-picked persona gets a fresh stack
  // and empty private memory (per docs/SPEC.md's seat contract) — the
  // shared table digest is untouched, so their opening context still has it.
  resetPrivateMemory(personaId: string): void;
}

// Not a hard singleton — /lib/store wires an instance of this into the
// app-wide game+memory store (see CLAUDE.md folder layout). Kept as a
// factory here so tests don't share state across cases.
export function createMemoryStore(): MemoryStore {
  const privateMemory = new Map<string, PrivateMemoryEntry[]>();
  let tableDigest: TableDigestEntry[] = [];

  return {
    getPrivateMemory(personaId) {
      return privateMemory.get(personaId) ?? [];
    },
    getTableDigest() {
      return tableDigest;
    },
    applyMemoryWriterOutput(personaId, output) {
      privateMemory.set(personaId, capPrivateMemory(output.updatedPrivateMemory));
      tableDigest = [...tableDigest, ...output.newDigestEntries];
    },
    resetPrivateMemory(personaId) {
      privateMemory.delete(personaId);
    },
  };
}
