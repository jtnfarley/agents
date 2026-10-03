import type { PersonaProfile, PersonaPromptContext, PersonaResponse } from "@/types";
import { defaultCreateChatCompletion, type CreateChatCompletion } from "./openrouterClient";
import { requestPersonaTurnFromModel } from "./openrouter";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

// Fixed OpenRouter model for personas that aren't assigned to the rotating
// free-model pool (see isOpenRouterPersona / FREE_OPENROUTER_MODELS in
// ./openrouterModels) — currently every profiled persona is OpenRouter-
// routed, so this is a safety-net path for a persona added without a
// rotation entry, not a hot path.
const MODEL = "google/gemma-4-26b-a4b-it:free";
const ERROR_LABEL = "getPersonaTurnFromFallbackModel";

export type { CreateChatCompletion } from "./openrouterClient";

export async function getPersonaTurnFromFallbackModel(
  context: PersonaPromptContext,
  profile: PersonaProfile,
  createChatCompletion: CreateChatCompletion = defaultCreateChatCompletion(ERROR_LABEL),
): Promise<PersonaResponse> {
  const legalActionTypes = [...new Set(context.legalActions.map((a) => a.type))];
  const system = buildSystemPrompt(profile);
  const user = buildUserMessage(context);

  return requestPersonaTurnFromModel(createChatCompletion, MODEL, system, user, legalActionTypes);
}
