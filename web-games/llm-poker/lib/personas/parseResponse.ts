import type { PersonaResponse } from "@/types";

// Shared by every provider (claude.ts, openrouter.ts, ...) so the
// PersonaResponse contract is validated identically regardless of which
// model produced it.
export function parsePersonaResponse(input: unknown): PersonaResponse {
  if (typeof input !== "object" || input === null) {
    throw new Error("parsePersonaResponse: response was not an object");
  }
  const { reasoning, action, amount, dialogue, gesture, newDiscussionTopic } =
    input as Record<string, unknown>;
  if (typeof reasoning !== "string") {
    throw new Error("parsePersonaResponse: missing or invalid reasoning");
  }
  if (action !== "fold" && action !== "check" && action !== "call" && action !== "raise") {
    throw new Error(`parsePersonaResponse: invalid action "${String(action)}"`);
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("parsePersonaResponse: missing or invalid amount");
  }
  if (typeof dialogue !== "string") {
    throw new Error("parsePersonaResponse: missing or invalid dialogue");
  }
  if (typeof gesture !== "string") {
    throw new Error("parsePersonaResponse: missing or invalid gesture");
  }
  if (typeof newDiscussionTopic !== "string") {
    throw new Error("parsePersonaResponse: missing or invalid newDiscussionTopic");
  }
  return {
    reasoning,
    action,
    amount,
    dialogue,
    gesture,
    newDiscussionTopic: newDiscussionTopic === "" ? null : newDiscussionTopic,
  };
}
