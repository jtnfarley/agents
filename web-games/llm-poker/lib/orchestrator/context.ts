import { getLegalActions, type EngineState } from "@/lib/engine";
import {
  filterPrivateMemoryForCurrentSeats,
  filterTableDigestRecent,
  type MemoryStore,
} from "@/lib/memory";
import type {
  DiscussionTopic,
  HandActionLogEntry,
  PersonaPromptContext,
  PrivateMemoryEntry,
  TableDigestEntry,
} from "@/types";

// Assembles what a persona is allowed to see for its turn: the full
// broadcastable game state, only its own hole cards, its legal actions,
// whatever memory (already filtered) the caller passes in, this hand's
// public action/dialogue log so far (lets a persona react to the seat that
// just acted), and the table's current open-floor discussion topic, if any.
export function buildPersonaPromptContext(
  state: EngineState,
  seatId: number,
  privateMemory: PrivateMemoryEntry[] = [],
  tableDigest: TableDigestEntry[] = [],
  handActionLog: HandActionLogEntry[] = [],
  discussionTopic: DiscussionTopic | null = null,
): PersonaPromptContext {
  const seat = state.game.seats.find((s) => s.seatId === seatId);
  if (!seat || seat.personaId === null) {
    throw new Error(`buildPersonaPromptContext: seat ${seatId} has no seated persona`);
  }

  return {
    personaId: seat.personaId,
    gameState: state.game,
    ownHoleCards: seat.holeCards,
    legalActions: getLegalActions(state, seatId),
    privateMemory,
    tableDigest,
    handActionLog,
    discussionTopic,
  };
}

// Same as buildPersonaPromptContext, but pulls memory from a MemoryStore and
// applies the retrieval-time filters itself: private memory is trimmed to
// entries about seats still at the table, and the table digest is trimmed
// to the last few hands (see /lib/memory/filters.ts). A persona seated cold
// off the bench naturally gets an empty privateMemory (nothing stored yet
// for their personaId) while still seeing the populated digest.
export function buildPersonaPromptContextWithMemory(
  state: EngineState,
  seatId: number,
  memoryStore: MemoryStore,
  handActionLog: HandActionLogEntry[] = [],
  discussionTopic: DiscussionTopic | null = null,
): PersonaPromptContext {
  const seat = state.game.seats.find((s) => s.seatId === seatId);
  if (!seat || seat.personaId === null) {
    throw new Error(`buildPersonaPromptContextWithMemory: seat ${seatId} has no seated persona`);
  }

  const currentPersonaIds = state.game.seats
    .map((s) => s.personaId)
    .filter((id): id is string => id !== null);

  const privateMemory = filterPrivateMemoryForCurrentSeats(
    memoryStore.getPrivateMemory(seat.personaId),
    currentPersonaIds,
  );
  const tableDigest = filterTableDigestRecent(memoryStore.getTableDigest(), state.game.handNumber);

  return buildPersonaPromptContext(
    state,
    seatId,
    privateMemory,
    tableDigest,
    handActionLog,
    discussionTopic,
  );
}
