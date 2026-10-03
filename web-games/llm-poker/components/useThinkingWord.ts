import { useEffect, useState } from "react";

// Rotated through every THINKING_INTERVAL_MS while a persona's turn is
// pending, so the wait reads as in-character musing rather than a stalled
// spinner. Deliberately overlong/pompous words fit the table's comedic
// personas better than a plain "Thinking" stuck on screen for 10+ seconds.
const THINKING_WORDS = [
  "Thinking",
  "Considering",
  "Postulating",
  "Philosophizing",
  "Deliberating",
  "Contemplating",
  "Pondering",
  "Ruminating",
  "Calculating",
  "Scheming",
];

const THINKING_INTERVAL_MS = 5000;

// Shared by DialogueLog's thinking banner and each Seat's dialogue bubble,
// so a persona's wait reads identically wherever it's shown. `key` is
// whatever identifies the thing being waited on (typically a personaId, or
// null when nothing's pending) — the cycle restarts from the first word
// whenever it changes, so a new persona's wait never picks up mid-cycle.
export function useThinkingWord(key: string | null): string | null {
  const [wordIndex, setWordIndex] = useState(0);
  // Reset during render rather than in the effect below (React's documented
  // "adjusting state when a prop changes" pattern) — avoids the extra
  // render an effect-body setState would otherwise trigger.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setWordIndex(0);
  }

  useEffect(() => {
    if (key === null) return;
    const id = setInterval(() => {
      setWordIndex((i) => (i + 1) % THINKING_WORDS.length);
    }, THINKING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [key]);

  return key === null ? null : THINKING_WORDS[wordIndex];
}
