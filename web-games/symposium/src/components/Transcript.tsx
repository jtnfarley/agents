"use client";

import { useLayoutEffect, useRef } from "react";
import { MOVE_NAMES_TARGET, MOVE_VERB } from "@/lib/constants";
import type { Draft } from "@/state/store";
import type { SpeakerId, Turn } from "@/lib/types";

type SeatTurn = Extract<Turn, { speaker: SpeakerId }>;

/** The label above a philosopher's turn, as in "Kant rebuts Mill". */
export function turnLabel(turn: SeatTurn, names: Record<SpeakerId, string>): string {
  const who = names[turn.speaker];
  const verb = MOVE_VERB[turn.move];
  if (MOVE_NAMES_TARGET.includes(turn.move) && turn.target !== "user") {
    return `${who} ${verb} ${names[turn.target]}`;
  }
  return `${who} ${verb}`;
}

/** Within this many pixels of the bottom counts as "at the bottom", so small drifts do not unpin the view. */
const STICK_PX = 80;

export default function Transcript({
  turns,
  names,
  draft,
}: {
  turns: Turn[];
  names: Record<SpeakerId, string>;
  draft: Draft | null;
}) {
  const box = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);

  // Like a chat window: stay on the newest line unless the reader scrolled up to read.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns, draft]);

  return (
    <ol
      ref={box}
      className="transcript"
      aria-live="polite"
      aria-label="Transcript"
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
      }}
    >
      {turns.map((t) => {
        if (t.speaker === "user") {
          const to = t.target === "both" ? "both" : names[t.target];
          return (
            <li key={t.id} className="turn visitor">
              <p className="label">You to {to}</p>
              <p>{t.text}</p>
            </li>
          );
        }
        if (t.speaker === "error") {
          return (
            <li key={t.id} className="turn error" role="alert">
              {t.text}
            </li>
          );
        }
        return (
          <li key={t.id} className="turn" data-seat={t.speaker}>
            <p className="label">{turnLabel(t, names)}</p>
            <p>{t.text}</p>
          </li>
        );
      })}
      {draft?.visitor && (
        <li className="turn visitor">
          <p className="label">You to {draft.visitor.target === "both" ? "both" : names[draft.visitor.target]}</p>
          <p>{draft.visitor.text}</p>
        </li>
      )}
      {draft && (
        <li className="turn drafting" data-seat={draft.speaker}>
          <p className="label">
            {turnLabel({ id: "draft", speaker: draft.speaker, move: draft.move, target: draft.target, text: "" }, names)}
          </p>
          <p>{draft.text}</p>
        </li>
      )}
    </ol>
  );
}
