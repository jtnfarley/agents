import type { CelebrationPromptContext, CelebrationResponse, PersonaProfile } from "@/types";
import { buildCelebrationSystemPrompt, buildCelebrationUserMessage } from "./celebrationPrompt";
import { isTimeoutError } from "./llmTimeout";
import { markModelCooldown } from "./modelCooldown";
import {
  defaultCreateChatCompletion,
  extractJsonObject,
  isCapacityError,
  type CreateChatCompletion,
} from "./openrouterClient";
import { FREE_OPENROUTER_MODELS, pickRandomOpenRouterModel } from "./openrouterModels";

const TOOL_NAME = "submit_hand_celebration";
const ERROR_LABEL = "getCelebrationFromOpenRouter";

function buildTool() {
  return {
    type: "function" as const,
    function: {
      name: TOOL_NAME,
      description: "Submit this persona's in-character reaction to winning a hand.",
      parameters: {
        type: "object",
        properties: {
          dialogue: { type: "string", description: "A short, in-character spoken line of gloating or celebration." },
          gesture: { type: "string", description: "A brief physical gesture or expression." },
        },
        required: ["dialogue", "gesture"],
        additionalProperties: false,
      },
    },
  };
}

function parseCelebrationResponse(input: unknown): CelebrationResponse {
  if (typeof input !== "object" || input === null) {
    throw new Error("parseCelebrationResponse: response was not an object");
  }
  const { dialogue, gesture } = input as Record<string, unknown>;
  if (typeof dialogue !== "string") {
    throw new Error("parseCelebrationResponse: missing or invalid dialogue");
  }
  if (typeof gesture !== "string") {
    throw new Error("parseCelebrationResponse: missing or invalid gesture");
  }
  return { dialogue, gesture };
}

async function requestViaTool(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
): Promise<CelebrationResponse> {
  const response = await createChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [buildTool()],
    tool_choice: { type: "function", function: { name: TOOL_NAME } },
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`${ERROR_LABEL}: response had no tool call`);
  }
  return parseCelebrationResponse(JSON.parse(toolCall.function.arguments));
}

async function requestViaPromptedJson(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
): Promise<CelebrationResponse> {
  const jsonInstructions = [
    "",
    "Respond with nothing but a single JSON object (no markdown fences, no commentary) with exactly these keys:",
    '- "dialogue": string, a short in-character spoken line of gloating or celebration',
    '- "gesture": string, a brief physical gesture or expression',
  ].join("\n");

  const response = await createChatCompletion({
    model,
    messages: [
      { role: "system", content: system + jsonInstructions },
      { role: "user", content: user },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error(`${ERROR_LABEL}: fallback response had no content`);
  }
  return parseCelebrationResponse(extractJsonObject(ERROR_LABEL, content));
}

// A model that times out or hits a capacity error on the tool-call attempt
// is unlikely to do better on the prompted-JSON retry against that same
// model, so the failure is surfaced immediately rather than spending a
// second call confirming the same limit. Exported so a caller pinned to one
// fixed model (./celebrationFallbackModel.ts) can reuse the same tool-call +
// prompted-JSON request logic without duplicating it.
export async function requestCelebrationFromModel(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
): Promise<CelebrationResponse> {
  try {
    return await requestViaTool(createChatCompletion, model, system, user);
  } catch (toolError) {
    if (isTimeoutError(toolError) || isCapacityError(toolError)) throw toolError;
    try {
      return await requestViaPromptedJson(createChatCompletion, model, system, user);
    } catch (fallbackError) {
      if (isTimeoutError(fallbackError) || isCapacityError(fallbackError)) throw fallbackError;
      throw new Error(
        `${ERROR_LABEL}: both tool-call and prompted-JSON attempts failed. ` +
          `Tool-call error: ${(toolError as Error).message}. Fallback error: ${(fallbackError as Error).message}`,
      );
    }
  }
}

export async function getCelebrationFromOpenRouter(
  context: CelebrationPromptContext,
  profile: PersonaProfile,
  createChatCompletion: CreateChatCompletion = defaultCreateChatCompletion(ERROR_LABEL),
): Promise<CelebrationResponse> {
  const system = buildCelebrationSystemPrompt(profile);
  const user = buildCelebrationUserMessage(context);

  // Same model-rotation strategy as getPersonaTurnFromOpenRouter: a timeout
  // or capacity error swaps in a different free model rather than retrying
  // the same one, and a capacity error also puts that model on a short
  // cross-call cooldown (./modelCooldown.ts).
  const triedModels: string[] = [];
  for (let attempt = 0; attempt < FREE_OPENROUTER_MODELS.length; attempt++) {
    const model = pickRandomOpenRouterModel(triedModels);
    triedModels.push(model);
    try {
      return await requestCelebrationFromModel(createChatCompletion, model, system, user);
    } catch (err) {
      if (isCapacityError(err)) markModelCooldown(model, err.retryAfterSeconds);
      const isRetryable = isTimeoutError(err) || isCapacityError(err);
      const isLastAttempt = attempt === FREE_OPENROUTER_MODELS.length - 1;
      if (!isRetryable || isLastAttempt) throw err;
    }
  }
  throw new Error(`${ERROR_LABEL}: unreachable`);
}
