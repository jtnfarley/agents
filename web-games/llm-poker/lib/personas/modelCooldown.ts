// Tracks free OpenRouter models that just failed with a capacity error
// (rate limit, upstream worker exhaustion — see OpenRouterCapacityError in
// ./openrouterClient) so pickRandomOpenRouterModel can steer other, unrelated
// persona/celebration/memory calls away from the same model for a short
// window instead of every call independently rediscovering the same limit.
// Module-level singleton by design — this project has no external store
// (see CLAUDE.md), and cooldown state is process-lifetime, best-effort only.

const DEFAULT_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 90_000;

const cooldownUntil = new Map<string, number>();

// `retryAfterSeconds` comes from the provider's own rate-limit hint when
// present; otherwise a fixed default cooldown is used. Capped so a huge or
// bogus hint can't sideline a model for an unreasonable stretch.
export function markModelCooldown(model: string, retryAfterSeconds?: number): void {
  const ms =
    retryAfterSeconds !== undefined
      ? Math.min(Math.max(retryAfterSeconds, 1) * 1000, MAX_COOLDOWN_MS)
      : DEFAULT_COOLDOWN_MS;
  const until = Date.now() + ms;
  const existing = cooldownUntil.get(model);
  if (existing === undefined || until > existing) {
    cooldownUntil.set(model, until);
  }
}

export function isModelInCooldown(model: string): boolean {
  const until = cooldownUntil.get(model);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    cooldownUntil.delete(model);
    return false;
  }
  return true;
}

// Test-only escape hatch — cooldown state is a module-level singleton, so
// tests that exercise it need a way to reset between cases.
export function clearAllCooldowns(): void {
  cooldownUntil.clear();
}
