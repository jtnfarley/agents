import { findPersonaProfile } from "@/lib/personas/profiles";
import type { DialogueLogEntry } from "./useTableStream";
import { useThinkingWord } from "./useThinkingWord";
import styles from "./Table.module.css";

function ThinkingIndicator({ personaId }: { personaId: string }) {
  const word = useThinkingWord(personaId);

  return (
    <div className={styles.logThinking}>
      <div className={styles.logThinkingName}>
        {findPersonaProfile(personaId)?.displayName ?? personaId}
      </div>
      <div className={styles.logThinkingText}>
        {word}
        <span className={styles.thinkingDot}>.</span>
        <span className={styles.thinkingDot}>.</span>
        <span className={styles.thinkingDot}>.</span>
      </div>
    </div>
  );
}

interface DialogueLogProps {
  entries: DialogueLogEntry[];
  thinkingPersonaId: string | null;
}

export function DialogueLog({ entries, thinkingPersonaId }: DialogueLogProps) {
  return (
    <div className={styles.log}>
      <h2 className={styles.logHeader}>Table Talk</h2>
      {thinkingPersonaId && <ThinkingIndicator personaId={thinkingPersonaId} />}
      {entries.length === 0 ? (
        <p className={styles.logEmpty}>Waiting for the first hand to get underway&hellip;</p>
      ) : (
        <ul className={styles.logList}>
          {entries.map((entry) =>
            entry.kind === "narrator" ? (
              <li key={entry.id} className={styles.logNarrator}>
                {entry.text}
              </li>
            ) : (
              <li key={entry.id}>
                <div className={styles.logEntryName}>
                  {findPersonaProfile(entry.personaId)?.displayName ?? entry.personaId}
                </div>
                <div className={styles.logEntryDir}>{entry.gesture}</div>
                <p className={styles.logEntryLine}>&ldquo;{entry.dialogue}&rdquo;</p>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
