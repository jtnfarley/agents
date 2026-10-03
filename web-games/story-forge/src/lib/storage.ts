// Client-only handoff between `/` and `/play`. There's no server session, so
// the initial genre/protagonist pick has to travel some other way — this
// repo uses sessionStorage rather than query params to keep the URL clean
// and avoid leaking the picks into shared links.

import type { GameState } from "./schemas";

const PENDING_START_KEY = "storyForge:pendingStart";

export type PendingStart = {
  genre: string;
  protagonist: GameState["protagonist"];
};

export function savePendingStart(payload: PendingStart): void {
  sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(payload));
}

/** Reads the pending start pick, if any, and clears it so a page refresh on
 * `/play` doesn't silently restart the story. */
export function readAndClearPendingStart(): PendingStart | null {
  const raw = sessionStorage.getItem(PENDING_START_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_START_KEY);
  try {
    return JSON.parse(raw) as PendingStart;
  } catch {
    return null;
  }
}
