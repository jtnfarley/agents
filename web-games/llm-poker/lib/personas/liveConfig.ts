// Cost-control opt-out, shared by the persona-turn dispatcher (./index.ts)
// and the memory-writer dispatcher (@/lib/memory/dispatch.ts) so both stub
// the same personas at the same time. A comma-separated denylist of
// personaIds ("*" for all), read fresh on every call so tests and per-table
// cost control can flip it without restarting the process. Unset/empty
// means every persona is live by default — a new persona needs no config
// change to start using real API calls; STUB_PERSONA_IDS is only for
// deliberately holding specific personas back (e.g. to conserve credits).
export function isLivePersona(personaId: string): boolean {
  const raw = process.env.STUB_PERSONA_IDS?.trim();
  if (!raw) return true;
  if (raw === "*") return false;
  return !raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(personaId);
}
