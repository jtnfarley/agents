import type { HandEvent, MemoryWriterInput } from "@/types";
import { findPersonaProfile } from "@/lib/personas";

export function buildSystemPrompt(personaId: string): string {
  const name = findPersonaProfile(personaId)?.displayName ?? personaId;
  return [
    `You are the private memory of ${name}, an ongoing player in a persistent Texas Hold'em game.`,
    "After each hand, decide what this player would actually carry forward.",
    "",
    "Two kinds of notes:",
    `- Private memory: ${name}'s own durable impressions — tells noticed in opponents, self-corrections about their own play, or relationships forming with other seats. Not every hand deserves an entry.`,
    "- Table digest: short, shareable observations about what just happened that anyone at the table could plausibly have witnessed. These fade after a few hands, so only note genuinely notable moments.",
    "",
    "Rules:",
    `- You only know what ${name} could plausibly have observed: public actions, dialogue, and ${name}'s own private reasoning. Other seats' private reasoning is never visible to you and must never be used as if it were.`,
    "- Keep existing private memory entries unless one is now stale or a more important note should replace it. It's fine to return the list unchanged if nothing new is worth keeping.",
    "- Private memory is capped at 6 entries; if more than that is worth keeping, keep only the most important ones.",
    "- Return an empty list for newDigestEntries if nothing table-worthy happened this hand.",
    "- You must respond by calling the submit_memory_update tool exactly once, and with nothing else.",
  ].join("\n");
}

// Mirrors /lib/personas/prompt.ts's hole-card redaction: a persona's memory
// writer only ever sees that persona's own `reasoning`. Another seat's
// reasoning was never observable at the table, so it's stripped here rather
// than trusted to the model to ignore.
function formatHandEvent(event: HandEvent, viewerPersonaId: string): string {
  const amount = event.amount ? ` $${event.amount}` : "";
  const reasoning =
    event.personaId === viewerPersonaId ? ` (their private reasoning: ${event.reasoning})` : "";
  return `- [${event.bettingRound}] ${event.personaId}: ${event.action}${amount} — "${event.dialogue}"${reasoning}`;
}

export function buildUserMessage(input: MemoryWriterInput): string {
  const { personaId, existingPrivateMemory, handEventLog } = input;

  const memoryLines =
    existingPrivateMemory.length > 0
      ? existingPrivateMemory.map(
          (m) =>
            `- (${m.type}${m.target ? `, re: ${m.target}` : ""}, importance ${m.importance}) ${m.note}`,
        )
      : ["- (none yet)"];

  const eventLines = handEventLog.map((e) => formatHandEvent(e, personaId));

  return [
    `Existing private memory for ${personaId}:`,
    ...memoryLines,
    "",
    "What happened this hand, in order:",
    ...eventLines,
    "",
    "Decide the updated private memory list and any new shared table digest entries.",
  ].join("\n");
}
