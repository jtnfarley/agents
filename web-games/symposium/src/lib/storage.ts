/**
 * localStorage for the debates. Every access is wrapped: private windows, blocked storage
 * and bad data all fall back to an empty state, so the app still renders.
 */
import { STORAGE_KEY } from "./constants";
import { savedStateSchema } from "./schemas";
import type { Debate } from "./types";

export interface SavedState {
  debates: Record<string, Debate>;
  order: string[];
  currentId: string | null;
}

export function loadState(): SavedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = savedStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveState(state: SavedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked. The debate still works for this visit.
  }
}
