import { MOVE_NAMES_TARGET, MOVE_VERB } from "@/lib/constants";
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

export default function Transcript({ turns, names }: { turns: Turn[]; names: Record<SpeakerId, string> }) {
  return (
    <ol className="transcript" aria-live="polite" aria-label="Transcript">
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
    </ol>
  );
}
