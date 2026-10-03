import type { PersonaProfile, PersonaPromptContext, PersonaResponse } from "@/types";
import { isTimeoutError } from "./llmTimeout";
import { markModelCooldown } from "./modelCooldown";
import {
  defaultCreateChatCompletion,
  extractJsonObject,
  isCapacityError,
  type CreateChatCompletion,
  type OpenRouterTool,
} from "./openrouterClient";
import { FREE_OPENROUTER_MODELS, pickRandomOpenRouterModel } from "./openrouterModels";
import { parsePersonaResponse } from "./parseResponse";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

export type { CreateChatCompletion } from "./openrouterClient";

const TOOL_NAME = "submit_persona_turn";
const ERROR_LABEL = "getPersonaTurnFromOpenRouter";

function buildTool(legalActionTypes: PersonaResponse["action"][]): OpenRouterTool {
  return {
    type: "function",
    function: {
      name: TOOL_NAME,
      description:
        "Submit this persona's poker decision and in-character dialogue for the current turn.",
      parameters: {
        type: "object",
        properties: {
          reasoning: {
            type: "string",
            description: "Private strategic reasoning. Never shown to spectators.",
          },
          action: { type: "string", enum: legalActionTypes },
          amount: {
            type: "integer",
            description: "Raise-to total for this betting round. 0 for fold/check/call.",
          },
          dialogue: {
            type: "string",
            description: "A short, in-character spoken line. No more than 3 sentences.",
          },
          gesture: {
            type: "string",
            description: "A brief physical gesture or expression. One short phrase, 10 words or fewer.",
          },
          newDiscussionTopic: {
            type: "string",
            description:
              "A new table-wide discussion topic (question, provocation, debate) to open or redirect the conversation to. If the prompt shows no discussion currently active, proactively set this most of the time rather than leaving it empty. If one is already active, prefer engaging with it in `dialogue` instead and leave this as an empty string unless your character would genuinely hijack the subject.",
          },
        },
        required: ["reasoning", "action", "amount", "dialogue", "gesture", "newDiscussionTopic"],
        additionalProperties: false,
      },
    },
  };
}

async function requestViaTool(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  legalActionTypes: PersonaResponse["action"][],
): Promise<PersonaResponse> {
  const response = await createChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [buildTool(legalActionTypes)],
    tool_choice: { type: "function", function: { name: TOOL_NAME } },
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`${ERROR_LABEL}: response had no tool call`);
  }
  return parsePersonaResponse(JSON.parse(toolCall.function.arguments));
}

async function requestViaPromptedJson(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  legalActionTypes: PersonaResponse["action"][],
): Promise<PersonaResponse> {
  const jsonInstructions = [
    "",
    "Respond with nothing but a single JSON object (no markdown fences, no commentary) with exactly these keys:",
    '- "reasoning": string, your private strategic reasoning (never shown to spectators)',
    `- "action": one of ${JSON.stringify(legalActionTypes)}`,
    '- "amount": integer, raise-to total for this betting round, 0 for fold/check/call',
    '- "dialogue": string, a short in-character spoken line, no more than 3 sentences',
    '- "gesture": string, a brief physical gesture or expression, one short phrase of 10 words or fewer',
    '- "newDiscussionTopic": string, a new topic to open or redirect the table\'s discussion — if the prompt shows none currently active, set this most of the time; if one is active, prefer answering it in "dialogue" and leave this as an empty string unless you\'d genuinely hijack the subject',
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
  return parsePersonaResponse(extractJsonObject(ERROR_LABEL, content));
}

// A model that times out or hits a capacity error (rate limit, upstream
// exhaustion) on the tool-call attempt is unlikely to do better on the
// prompted-JSON retry against that same model, so the failure is surfaced
// immediately rather than spending a second call confirming the same limit.
// Exported so a caller pinned to one fixed model (./fallbackModel.ts) can
// reuse the same tool-call + prompted-JSON request logic without duplicating
// it.
export async function requestPersonaTurnFromModel(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  legalActionTypes: PersonaResponse["action"][],
): Promise<PersonaResponse> {
  try {
    return await requestViaTool(createChatCompletion, model, system, user, legalActionTypes);
  } catch (toolError) {
    if (isTimeoutError(toolError) || isCapacityError(toolError)) throw toolError;
    try {
      return await requestViaPromptedJson(createChatCompletion, model, system, user, legalActionTypes);
    } catch (fallbackError) {
      if (isTimeoutError(fallbackError) || isCapacityError(fallbackError)) throw fallbackError;
      throw new Error(
        `${ERROR_LABEL}: both tool-call and prompted-JSON attempts failed. ` +
          `Tool-call error: ${(toolError as Error).message}. Fallback error: ${(fallbackError as Error).message}`,
      );
    }
  }
}

export async function getPersonaTurnFromOpenRouter(
  context: PersonaPromptContext,
  profile: PersonaProfile,
  createChatCompletion: CreateChatCompletion = defaultCreateChatCompletion(ERROR_LABEL),
): Promise<PersonaResponse> {
  const legalActionTypes = [...new Set(context.legalActions.map((a) => a.type))];
  const system = buildSystemPrompt(profile);
  const user = buildUserMessage(context);

  // A timed-out or capacity-limited model gets swapped for a different one
  // from the free-model pool rather than retried in place — see CLAUDE.md /
  // the user's ask: no persona is pinned to a single OpenRouter model, so a
  // slow or rate-limited model just costs one attempt instead of stalling
  // the persona's whole turn. A capacity error also puts the model on a
  // short cross-call cooldown (./modelCooldown.ts) so other persona/
  // celebration/memory calls steer around it too, instead of every call
  // independently re-discovering the same limit within the same window.
  const triedModels: string[] = [];
  for (let attempt = 0; attempt < FREE_OPENROUTER_MODELS.length; attempt++) {
    const model = pickRandomOpenRouterModel(triedModels);
    triedModels.push(model);
    try {
      return await requestPersonaTurnFromModel(createChatCompletion, model, system, user, legalActionTypes);
    } catch (err) {
      if (isCapacityError(err)) markModelCooldown(model, err.retryAfterSeconds);
      const isRetryable = isTimeoutError(err) || isCapacityError(err);
      const isLastAttempt = attempt === FREE_OPENROUTER_MODELS.length - 1;
      if (!isRetryable || isLastAttempt) throw err;
    }
  }
  throw new Error(`${ERROR_LABEL}: unreachable`);
}
