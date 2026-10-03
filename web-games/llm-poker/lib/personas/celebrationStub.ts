import type { CelebrationResponse } from "@/types";

// Placeholder getPersonaCelebration: fixed flavor text, no API call. Used
// for stubbed personas and as the fallback when a live celebration call
// fails (mirrors stub.ts's role for getPersonaTurn).
export function getStubCelebration(): CelebrationResponse {
  return {
    dialogue: "Read 'em and weep.",
    gesture: "rakes in the pot with a grin",
  };
}
