import type { PrivateMemoryEntry, TableDigestEntry } from "@/types";

// How many hands a digest entry stays visible for after it's written.
// Importance affects display weight only — it never extends this window
// (see docs/SPEC.md and CLAUDE.md: the two memory decay rules are
// deliberately different, don't unify them).
export const TABLE_DIGEST_WINDOW_HANDS = 4;

// Retrieval-time filter: a private-memory entry about a specific opponent
// (`target` set) stops being useful once that opponent is no longer at the
// table. Entries with no target (self-corrections, general notes) always
// pass through.
export function filterPrivateMemoryForCurrentSeats(
  memory: PrivateMemoryEntry[],
  currentPersonaIds: readonly string[],
): PrivateMemoryEntry[] {
  const seated = new Set(currentPersonaIds);
  return memory.filter((entry) => entry.target === null || seated.has(entry.target));
}

// Retrieval-time filter: table digest entries decay purely on recency,
// regardless of importance.
export function filterTableDigestRecent(
  digest: TableDigestEntry[],
  currentHandNumber: number,
): TableDigestEntry[] {
  return digest.filter((entry) => currentHandNumber - entry.handWritten < TABLE_DIGEST_WINDOW_HANDS);
}
