import type { Destination, Message, Stop } from "./types";

/** The chat as the server receives it: the last 12 messages that can appear in a transcript. */
export function historyOf(dest: Destination): Message[] {
  return dest.messages.filter((m) => m.role !== "divider" && m.role !== "error").slice(-12);
}

/** Unique stop names the guides raised, in order, each with the side that raised it first. */
export function raisedStops(messages: Message[]): { name: string; side: "local" | "tourist" }[] {
  const seen = new Set<string>();
  const out: { name: string; side: "local" | "tourist" }[] = [];
  for (const m of messages) {
    if (m.role !== "guide") continue;
    for (const s of m.stops as Stop[]) {
      if (s.name && !seen.has(s.name)) {
        seen.add(s.name);
        out.push({ name: s.name, side: m.side });
      }
    }
  }
  return out;
}
