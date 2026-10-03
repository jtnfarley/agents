import type {
  DialogueEventPayload,
  GameState,
  HandCompleteEventPayload,
  SeatFilledEventPayload,
  SeatOpenEventPayload,
} from "@/types";

// The full set of broadcastable table events (see docs/SPEC.md's API/event
// contract) — one union so publishers and the SSE route agree on shape.
export type TableEvent =
  | { type: "state_update"; payload: GameState }
  | { type: "dialogue"; payload: DialogueEventPayload }
  | { type: "seat_open"; payload: SeatOpenEventPayload }
  | { type: "seat_filled"; payload: SeatFilledEventPayload }
  | { type: "hand_complete"; payload: HandCompleteEventPayload };

export type TableEventListener = (event: TableEvent) => void;

const listeners = new Set<TableEventListener>();

// In-process pub/sub feeding /api/table/stream (see CLAUDE.md folder
// layout) — no external broker; this is a single Node process holding
// everything, including its subscribers, in memory.
export function subscribe(listener: TableEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publish(event: TableEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

// Test/diagnostic helper — not used by the SSE route itself.
export function listenerCount(): number {
  return listeners.size;
}
