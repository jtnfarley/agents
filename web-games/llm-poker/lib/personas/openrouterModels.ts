import { isModelInCooldown } from "./modelCooldown";

// Free OpenRouter models this project currently rotates OpenRouter-routed
// personas across. Pulled from OpenRouter's live `:free` catalog — swap
// freely, these are not load-bearing IDs. A persona's model is chosen
// randomly per call (pickRandomOpenRouterModel) rather than pinned, so one
// slow or unavailable model doesn't take a persona down for the rest of the
// session — see LLM_CALL_TIMEOUT_MS in ./llmTimeout and the retry loop in
// getPersonaTurnFromOpenRouter / getCelebrationFromOpenRouter.
export const FREE_OPENROUTER_MODELS: readonly string[] = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free"
];

// Personas routed through OpenRouter (./openrouter.ts) rather than Claude
// (./claude.ts). Kept separate from FREE_OPENROUTER_MODELS so changing which
// models are in rotation never changes which personas are OpenRouter-routed.
const OPENROUTER_PERSONA_IDS = new Set<string>([
  "sappho",
  "nietzsche",
  "diogenes",
  "marie-curie",
  "frida-kahlo",
  "mozart",
  "sun-tzu",
  "socrates",
  "confucius",
  "machiavelli",
  "joan-of-arc",
  "genghis-khan",
  "cleopatra",
  "boudica",
  "darwin",
  "shakespeare",
  "poe",
  "wilde",
  "beethoven",
  "wagner",
  "catherine-the-great",
  "harriet-tubman",
  "immanuel-kant",
  "kahlil-gibran",
  "tesla",
  "grace-o-malley",
  "ching-shih",
  "mark-twain",
  "walt-whitman",
  "rasputin",
  "leonardo-da-vinci",
  "lorenzo-de-medici",
  "hieronymus-bosch",
]);

export function isOpenRouterPersona(personaId: string): boolean {
  return OPENROUTER_PERSONA_IDS.has(personaId);
}

// Picks a random model from the free-model pool, excluding any already tried
// this call (e.g. one that just timed out or hit a capacity error) and any
// model currently in cooldown from a capacity error on a *different* call
// (see ./modelCooldown.ts) — so one persona's rate limit doesn't get
// immediately rediscovered by the next persona's turn. Falls back to
// whichever wider set is non-empty (cooling-down-but-not-excluded, then the
// full pool) so a call never gets stuck with nothing to try.
export function pickRandomOpenRouterModel(exclude: readonly string[] = []): string {
  const notCoolingDown = FREE_OPENROUTER_MODELS.filter((model) => !isModelInCooldown(model));
  const base = notCoolingDown.length > 0 ? notCoolingDown : FREE_OPENROUTER_MODELS;
  const candidates = base.filter((model) => !exclude.includes(model));
  const pool = candidates.length > 0 ? candidates : base;
  return pool[Math.floor(Math.random() * pool.length)];
}
