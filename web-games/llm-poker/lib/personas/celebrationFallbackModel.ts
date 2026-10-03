import type { CelebrationPromptContext, CelebrationResponse, PersonaProfile } from "@/types";
import { requestCelebrationFromModel } from "./celebrationOpenRouter";
import { buildCelebrationSystemPrompt, buildCelebrationUserMessage } from "./celebrationPrompt";
import { defaultCreateChatCompletion, type CreateChatCompletion } from "./openrouterClient";

// Fixed OpenRouter model, mirroring ./fallbackModel.ts — the safety-net path
// for a persona that isn't assigned to the rotating free-model pool.
const MODEL = "google/gemma-4-26b-a4b-it:free";
const ERROR_LABEL = "getCelebrationFromFallbackModel";

export async function getCelebrationFromFallbackModel(
  context: CelebrationPromptContext,
  profile: PersonaProfile,
  createChatCompletion: CreateChatCompletion = defaultCreateChatCompletion(ERROR_LABEL),
): Promise<CelebrationResponse> {
  const system = buildCelebrationSystemPrompt(profile);
  const user = buildCelebrationUserMessage(context);

  return requestCelebrationFromModel(createChatCompletion, MODEL, system, user);
}
