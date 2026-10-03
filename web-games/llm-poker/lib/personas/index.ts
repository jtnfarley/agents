import type {
  CelebrationPromptContext,
  CelebrationResponse,
  PersonaPromptContext,
  PersonaResponse,
} from "@/types";
import { getCelebrationFromFallbackModel } from "./celebrationFallbackModel";
import { getCelebrationFromOpenRouter } from "./celebrationOpenRouter";
import { getStubCelebration } from "./celebrationStub";
import { getPersonaTurnFromFallbackModel } from "./fallbackModel";
import { isLivePersona } from "./liveConfig";
import { isOpenRouterPersona } from "./openrouterModels";
import { getPersonaTurnFromOpenRouter } from "./openrouter";
import { findPersonaProfile } from "./profiles";
import { getPersonaTurn as getStubPersonaTurn } from "./stub";

export { PERSONA_PROFILES, findPersonaProfile } from "./profiles";
export { createStubPersona } from "./stub";
export { getPersonaTurnFromFallbackModel } from "./fallbackModel";
export { getPersonaTurnFromOpenRouter } from "./openrouter";
export { getCelebrationFromFallbackModel } from "./celebrationFallbackModel";
export { getCelebrationFromOpenRouter } from "./celebrationOpenRouter";
export { getStubCelebration } from "./celebrationStub";
export { isOpenRouterPersona, FREE_OPENROUTER_MODELS } from "./openrouterModels";
export { isLivePersona } from "./liveConfig";

// The one function every persona interaction goes through (per CLAUDE.md).
// Internally it dispatches per persona to the stub, the rotating OpenRouter
// free-model pool, or the fixed-model fallback — callers never know or care
// which.
export async function getPersonaTurn(context: PersonaPromptContext): Promise<PersonaResponse> {
  if (!isLivePersona(context.personaId)) {
    return getStubPersonaTurn(context);
  }

  const profile = findPersonaProfile(context.personaId);
  if (!profile) {
    throw new Error(`getPersonaTurn: no persona profile registered for "${context.personaId}"`);
  }

  try {
    if (isOpenRouterPersona(context.personaId)) {
      return await getPersonaTurnFromOpenRouter(context, profile);
    }
    return await getPersonaTurnFromFallbackModel(context, profile);
  } catch (err) {
    // Provider calls (rate limits, transient network errors, malformed
    // responses) must never take down the table loop — see CLAUDE.md on the
    // engine/persona boundary. Fall back to a random legal action for just
    // this turn and keep the hand moving.
    console.error(`getPersonaTurn: live call failed for "${context.personaId}", falling back to stub`, err);
    return getStubPersonaTurn(context);
  }
}

// The one function every post-hand celebration goes through, mirroring
// getPersonaTurn's dispatch (stub vs the OpenRouter pool vs the fixed-model
// fallback, per persona) — see CLAUDE.md.
export async function getPersonaCelebration(
  context: CelebrationPromptContext,
): Promise<CelebrationResponse> {
  if (!isLivePersona(context.personaId)) {
    return getStubCelebration();
  }

  const profile = findPersonaProfile(context.personaId);
  if (!profile) {
    throw new Error(`getPersonaCelebration: no persona profile registered for "${context.personaId}"`);
  }

  try {
    if (isOpenRouterPersona(context.personaId)) {
      return await getCelebrationFromOpenRouter(context, profile);
    }
    return await getCelebrationFromFallbackModel(context, profile);
  } catch (err) {
    console.error(
      `getPersonaCelebration: live call failed for "${context.personaId}", falling back to stub`,
      err,
    );
    return getStubCelebration();
  }
}
