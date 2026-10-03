"use client";

import { useEffect, useRef, useState } from "react";
import { findPersonaProfile } from "@/lib/personas/profiles";
import type {
  DialogueEventPayload,
  GameState,
  PersonaProfile,
  SeatFilledEventPayload,
  SeatOpenEventPayload,
} from "@/types";

export type DialogueLogEntry =
  | ({ kind: "dialogue"; id: string } & DialogueEventPayload)
  | { kind: "narrator"; id: string; text: string };

export type DialogueLineEntry = Extract<DialogueLogEntry, { kind: "dialogue" }>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const MAX_DIALOGUE_ENTRIES = 50;

function parse<T>(event: Event): T {
  return JSON.parse((event as MessageEvent<string>).data) as T;
}

// Subscribes to /api/table/stream and keeps the latest broadcast state in
// React state. One EventSource per mounted Table — the server-side loop is
// shared across every spectator regardless of how many tabs are open.
export function useTableStream() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dialogueLog, setDialogueLog] = useState<DialogueLogEntry[]>([]);
  const [openSeats, setOpenSeats] = useState<Record<number, PersonaProfile[]>>({});
  const nextId = useRef(0);

  useEffect(() => {
    function pushEntry(entry: DistributiveOmit<DialogueLogEntry, "id">) {
      nextId.current += 1;
      const withId = { ...entry, id: String(nextId.current) } as DialogueLogEntry;
      setDialogueLog((prev) => [withId, ...prev].slice(0, MAX_DIALOGUE_ENTRIES));
    }

    const source = new EventSource("/api/table/stream");

    source.addEventListener("state_update", (event) => {
      setGameState(parse<GameState>(event));
    });

    source.addEventListener("dialogue", (event) => {
      const payload = parse<DialogueEventPayload>(event);
      pushEntry({ kind: "dialogue", ...payload });
    });

    source.addEventListener("seat_open", (event) => {
      const payload = parse<SeatOpenEventPayload>(event);
      setOpenSeats((prev) => ({ ...prev, [payload.seatId]: payload.candidates }));
    });

    source.addEventListener("seat_filled", (event) => {
      const payload = parse<SeatFilledEventPayload>(event);
      setOpenSeats((prev) => {
        if (!(payload.seatId in prev)) return prev;
        const next = { ...prev };
        delete next[payload.seatId];
        return next;
      });
      const name = findPersonaProfile(payload.personaId)?.displayName ?? payload.personaId;
      pushEntry({ kind: "narrator", text: `${name} takes the empty chair.` });
    });

    return () => source.close();
  }, []);

  return { gameState, dialogueLog, openSeats };
}
