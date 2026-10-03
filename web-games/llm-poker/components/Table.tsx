"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { DialogueLog } from "./DialogueLog";
import { Seat } from "./Seat";
import { SeatPickerModal } from "./SeatPickerModal";
import styles from "./Table.module.css";
import type { DialogueLineEntry } from "./useTableStream";
import { useTableStream } from "./useTableStream";

// Diamond layout, indexed by seatId — bottom-center (nearest spectator) /
// left / top-center / right, evenly spaced around the (vertically
// off-center, see .felt/.board's 44% top) felt for 4 seats. Ordered this
// way (rather than bottom/right/top/left) so that ascending seatId — the
// direction the engine's turn order and dealer rotation both walk in, see
// nextSeatWithStatus — traces clockwise on screen, matching poker's "action
// proceeds clockwise, starting left of the dealer" convention; bottom ->
// right -> top -> left would trace counterclockwise instead. Bottom-center
// sits at 78% — pushed down near the bottom of the window, clear of the
// felt — so its dialogue (which renders below the portrait and can run
// several lines) has room to grow before hitting the bottom of the window,
// which .page's overflow: hidden would otherwise clip. Left/right sit at
// 22%/78% — close enough to the (37.5%-wide) felt to read as seated at the
// table without overlapping it. The top seat alone is pinned to a fixed
// anchor (see .seatAnchorTop) instead of true-centering, so its own growing
// dialogue can't push its portrait up under the header; it sits near the
// header at 5%.
const SEAT_POSITIONS: Array<{ top: string; left: string; anchor?: "top" }> = [
  { top: "78%", left: "50%" },
  { top: "44%", left: "22%" },
  { top: "5%", left: "50%", anchor: "top" },
  { top: "44%", left: "78%" },
];

export function Table() {
  const { gameState, dialogueLog, openSeats } = useTableStream();
  const [activeModalSeatId, setActiveModalSeatId] = useState<number | null>(null);

  const openSeatIds = useMemo(() => Object.keys(openSeats).map(Number), [openSeats]);

  // Derived, not stored: if the requested seat fills (or its picker closes)
  // while a modal is up, it simply stops matching an open seat next render —
  // no effect needed to reconcile stale state.
  const modalSeatId =
    activeModalSeatId !== null && openSeatIds.includes(activeModalSeatId) ? activeModalSeatId : null;

  const latestLineByPersona = useMemo(() => {
    const map = new Map<string, DialogueLineEntry>();
    for (const entry of dialogueLog) {
      if (entry.kind === "dialogue" && !map.has(entry.personaId)) {
        map.set(entry.personaId, entry);
      }
    }
    return map;
  }, [dialogueLog]);

  // The engine already advances `actingSeat` to the *next* seat the instant
  // the current one's action is applied — before that next persona's LLM
  // call has even started (see playHand.ts: applyAction, then onBroadcast).
  // Highlighting off actingSeat would light up a seat the moment its
  // predecessor's line appears and hold it there through the entire LLM
  // wait, before that seat has said anything. Highlighting off the newest
  // dialogue entry instead means the glow follows whoever's line is
  // actually on screen, and only jumps once the next persona's line
  // actually arrives.
  const currentSpeakerPersonaId = useMemo(
    () => dialogueLog.find((entry): entry is DialogueLineEntry => entry.kind === "dialogue")?.personaId ?? null,
    [dialogueLog],
  );

  // The seat gameState.actingSeat points at is whoever's turn is up next —
  // and, per playHand.ts, that seat is already the *new* actingSeat by the
  // time a broadcast lands, before that persona's own LLM call has even
  // started (see the comment on currentSpeakerPersonaId above). So as long
  // as it hasn't spoken yet (its id doesn't match the newest dialogue
  // entry) and it's actually still in the hand, it's who we're waiting on.
  const thinkingPersonaId = useMemo(() => {
    // handNumber 0 is tableStore's pre-game placeholder (see
    // initialGameState), sent before the first hand's first turn has
    // actually been decided — its actingSeat is a stand-in equal to
    // dealerSeat, not a real turn-order result, so treat it as "nobody's
    // turn yet" rather than showing the dealer as thinking.
    if (!gameState || gameState.handNumber === 0 || gameState.bettingRound === "showdown") return null;
    const seat = gameState.seats.find((s) => s.seatId === gameState.actingSeat);
    if (!seat?.personaId || seat.status !== "active") return null;
    return seat.personaId === currentSpeakerPersonaId ? null : seat.personaId;
  }, [gameState, currentSpeakerPersonaId]);

  if (!gameState) {
    return <p className={styles.status}>Connecting to the table&hellip;</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitle}>The Table</div>
          <div className={styles.headerSubtitle}>
            Texas Hold&rsquo;em &middot; Blinds $10 / $20 &middot; Hand #{gameState.handNumber} &middot;{" "}
            {gameState.bettingRound}
          </div>
        </div>
        {openSeatIds.length > 0 && (
          <button
            type="button"
            className={styles.reviewButton}
            onClick={() => setActiveModalSeatId(openSeatIds[0])}
          >
            Review Seat Opening
          </button>
        )}
      </header>

      <div className={styles.body}>
        <div className={styles.tableArea}>
          <div className={styles.felt} />

          <div className={styles.board}>
            <div className={styles.boardCards}>
              {Array.from({ length: 5 }, (_, i) => {
                const card = gameState.board[i];
                return card ? (
                  <Card key={i} card={card} variant="board" />
                ) : (
                  <span key={i} className={styles.boardCardEmpty} />
                );
              })}
            </div>
            <div className={styles.potLabel}>
              Pot &middot; <span className={styles.potValue}>${gameState.potTotal}</span>
            </div>
          </div>

          <div className={styles.seats}>
            {gameState.seats.map((seat) => {
              const { anchor, ...position } = SEAT_POSITIONS[seat.seatId % SEAT_POSITIONS.length];
              return (
                <Seat
                  key={seat.seatId}
                  seat={seat}
                  position={position}
                  anchorTop={anchor === "top"}
                  isActing={seat.personaId !== null && seat.personaId === currentSpeakerPersonaId}
                  isThinking={seat.personaId !== null && seat.personaId === thinkingPersonaId}
                  isDealer={seat.seatId === gameState.dealerSeat}
                  hasOpenPicker={openSeatIds.includes(seat.seatId)}
                  onOpenPicker={() => setActiveModalSeatId(seat.seatId)}
                  lastLine={seat.personaId ? latestLineByPersona.get(seat.personaId) : undefined}
                />
              );
            })}
          </div>
        </div>

        <DialogueLog entries={dialogueLog} thinkingPersonaId={thinkingPersonaId} />
      </div>

      {modalSeatId !== null && (
        <SeatPickerModal
          seatId={modalSeatId}
          candidates={openSeats[modalSeatId]}
          onClose={() => setActiveModalSeatId(null)}
        />
      )}
    </div>
  );
}
