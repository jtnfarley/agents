import { findPersonaProfile } from "@/lib/personas/profiles";
import type { SeatState } from "@/types";
import { Card } from "./Card";
import { Portrait } from "./Portrait";
import styles from "./Table.module.css";
import { useThinkingWord } from "./useThinkingWord";
import type { DialogueLineEntry } from "./useTableStream";

interface SeatProps {
  seat: SeatState;
  position: { top: string; left: string };
  anchorTop?: boolean;
  isActing: boolean;
  isThinking: boolean;
  isDealer: boolean;
  hasOpenPicker: boolean;
  onOpenPicker: () => void;
  lastLine?: DialogueLineEntry;
}

export function Seat({
  seat,
  position,
  anchorTop,
  isActing,
  isThinking,
  isDealer,
  hasOpenPicker,
  onOpenPicker,
  lastLine,
}: SeatProps) {
  const thinkingWord = useThinkingWord(isThinking ? seat.personaId : null);
  const seatClassName = anchorTop ? `${styles.seat} ${styles.seatAnchorTop}` : styles.seat;

  if (!seat.personaId) {
    return (
      <div className={seatClassName} style={position}>
        {hasOpenPicker ? (
          <button type="button" className={styles.seatOpenCard} onClick={onOpenPicker}>
            <span className={styles.seatOpenLabel}>Seat Open</span>
            <span className={styles.seatOpenPrompt}>Choose a player &rarr;</span>
          </button>
        ) : (
          <div className={styles.seatOpenWaiting}>Waiting for a spectator to seat someone&hellip;</div>
        )}
      </div>
    );
  }

  const profile = findPersonaProfile(seat.personaId);
  const displayName = profile?.displayName ?? seat.personaId;
  const isDimmed = seat.status === "folded" || seat.status === "eliminated";

  // Folded is authoritative off seat.status (persists for the rest of the
  // hand); call/check/raise are transient turn results, so those read off
  // the seat's most recent dialogue line instead — same source Table.tsx
  // already uses for the quote shown just above this badge.
  const actionLabel =
    seat.status !== "folded" && !isThinking && lastLine
      ? lastLine.action === "raise"
        ? `Raised to $${lastLine.amount}`
        : lastLine.action === "call"
          ? `Called $${lastLine.amount}`
          : lastLine.action === "check"
            ? "Checked"
            : null
      : null;

  return (
    <div className={seatClassName} style={position}>
      <div
        className={[
          styles.seatContent,
          isActing && styles.seatContentActive,
          isDimmed && styles.seatDimmed,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.seatTopRow}>
          <div className={styles.seatInfoCol}>
            <div className={styles.portraitWrap}>
              {isDealer && <span className={styles.dealerButton}>D</span>}
              <Portrait id={seat.personaId} name={displayName} size={77} />
            </div>
            <div className={styles.seatName}>{displayName}</div>
            <div className={styles.seatStack}>${seat.stack.toLocaleString()}</div>
          </div>
          <div className={styles.holeCards}>
            {seat.holeCards.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
        </div>
        <div className={styles.seatText}>
          {isThinking ? (
            <div className={styles.seatThinking}>
              {thinkingWord}
              <span className={styles.thinkingDot}>.</span>
              <span className={styles.thinkingDot}>.</span>
              <span className={styles.thinkingDot}>.</span>
            </div>
          ) : (
            lastLine && (
              <>
                <div className={styles.seatDir}>{lastLine.gesture}</div>
                <div className={styles.seatLine}>&ldquo;{lastLine.dialogue}&rdquo;</div>
              </>
            )
          )}
        </div>
        {seat.status === "folded" && <div className={styles.seatFolded}>Folded</div>}
        {actionLabel && <div className={styles.seatAction}>{actionLabel}</div>}
      </div>
    </div>
  );
}
