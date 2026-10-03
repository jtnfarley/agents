import {
  defaultCreateChatCompletion,
  extractJsonObject,
  isCapacityError,
  type CreateChatCompletion,
  type OpenRouterTool,
} from "@/lib/personas/openrouterClient";
import { isTimeoutError } from "@/lib/personas/llmTimeout";
import { markModelCooldown } from "@/lib/personas/modelCooldown";
import { FREE_OPENROUTER_MODELS, pickRandomOpenRouterModel } from "@/lib/personas/openrouterModels";
import type { MemoryWriterInput, MemoryWriterOutput, PrivateMemoryEntry, TableDigestEntry } from "@/types";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

const TOOL_NAME = "submit_memory_update";
const ERROR_LABEL = "getPostHandMemoryUpdates";

const PRIVATE_MEMORY_TYPES = ["tell_noticed", "self_correction", "relationship"] as const;

// Signature any memory-writing implementation can satisfy — lets the
// orchestrator inject a fake for tests, the same way playHand accepts a
// getPersonaTurn override.
export type GetMemoryUpdates = (
  input: MemoryWriterInput,
  handNumber: number,
) => Promise<MemoryWriterOutput>;

function buildTool(): OpenRouterTool {
  return {
    type: "function",
    function: {
      name: TOOL_NAME,
      description:
        "Submit this persona's updated private memory and any new shared table digest entries after a hand.",
      parameters: {
        type: "object",
        properties: {
          updatedPrivateMemory: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: [...PRIVATE_MEMORY_TYPES] },
                target: {
                  type: "string",
                  description:
                    "The personaId this note is about, or an empty string if it isn't about a specific opponent.",
                },
                note: { type: "string" },
                importance: { type: "integer", description: "1-5, where 5 is most important to remember." },
              },
              required: ["type", "target", "note", "importance"],
            },
          },
          newDigestEntries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                note: { type: "string" },
                importance: { type: "integer", description: "1-5, where 5 is most important to remember." },
              },
              required: ["note", "importance"],
            },
          },
        },
        required: ["updatedPrivateMemory", "newDigestEntries"],
        additionalProperties: false,
      },
    },
  };
}

function parsePrivateMemoryEntry(raw: unknown, index: number): PrivateMemoryEntry {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${ERROR_LABEL}: updatedPrivateMemory[${index}] was not an object`);
  }
  const { type, target, note, importance } = raw as Record<string, unknown>;
  if (type !== "tell_noticed" && type !== "self_correction" && type !== "relationship") {
    throw new Error(`${ERROR_LABEL}: updatedPrivateMemory[${index}] has invalid type "${String(type)}"`);
  }
  if (typeof target !== "string") {
    throw new Error(`${ERROR_LABEL}: updatedPrivateMemory[${index}] has invalid target`);
  }
  if (typeof note !== "string") {
    throw new Error(`${ERROR_LABEL}: updatedPrivateMemory[${index}] has invalid note`);
  }
  if (typeof importance !== "number" || !Number.isInteger(importance) || importance < 1 || importance > 5) {
    throw new Error(`${ERROR_LABEL}: updatedPrivateMemory[${index}] has invalid importance`);
  }
  return {
    type,
    target: target === "" ? null : target,
    note,
    importance: importance as 1 | 2 | 3 | 4 | 5,
  };
}

function parseDigestEntry(raw: unknown, index: number, handNumber: number): TableDigestEntry {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${ERROR_LABEL}: newDigestEntries[${index}] was not an object`);
  }
  const { note, importance } = raw as Record<string, unknown>;
  if (typeof note !== "string") {
    throw new Error(`${ERROR_LABEL}: newDigestEntries[${index}] has invalid note`);
  }
  if (typeof importance !== "number" || !Number.isInteger(importance) || importance < 1 || importance > 5) {
    throw new Error(`${ERROR_LABEL}: newDigestEntries[${index}] has invalid importance`);
  }
  return { note, importance: importance as 1 | 2 | 3 | 4 | 5, handWritten: handNumber };
}

function parseMemoryWriterOutput(input: unknown, handNumber: number): MemoryWriterOutput {
  if (typeof input !== "object" || input === null) {
    throw new Error(`${ERROR_LABEL}: tool input was not an object`);
  }
  const { updatedPrivateMemory, newDigestEntries } = input as Record<string, unknown>;
  if (!Array.isArray(updatedPrivateMemory)) {
    throw new Error(`${ERROR_LABEL}: missing or invalid updatedPrivateMemory`);
  }
  if (!Array.isArray(newDigestEntries)) {
    throw new Error(`${ERROR_LABEL}: missing or invalid newDigestEntries`);
  }
  return {
    updatedPrivateMemory: updatedPrivateMemory.map((raw, i) => parsePrivateMemoryEntry(raw, i)),
    newDigestEntries: newDigestEntries.map((raw, i) => parseDigestEntry(raw, i, handNumber)),
  };
}

async function requestViaTool(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  handNumber: number,
): Promise<MemoryWriterOutput> {
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
  return parseMemoryWriterOutput(JSON.parse(toolCall.function.arguments), handNumber);
}

async function requestViaPromptedJson(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  handNumber: number,
): Promise<MemoryWriterOutput> {
  const jsonInstructions = [
    "",
    "Respond with nothing but a single JSON object (no markdown fences, no commentary) with exactly these keys:",
    '- "updatedPrivateMemory": array of { "type": one of ["tell_noticed","self_correction","relationship"], ' +
      '"target": string (personaId, or "" if not about a specific opponent), "note": string, "importance": integer 1-5 }',
    '- "newDigestEntries": array of { "note": string, "importance": integer 1-5 }',
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
  return parseMemoryWriterOutput(extractJsonObject(ERROR_LABEL, content), handNumber);
}

// A model that times out or hits a capacity error on the tool-call attempt
// is unlikely to do better on the prompted-JSON retry against that same
// model, so the failure is surfaced immediately rather than spending a
// second call confirming the same limit — mirrors requestPersonaTurnFromModel
// in /lib/personas/openrouter.ts.
async function requestMemoryUpdateFromModel(
  createChatCompletion: CreateChatCompletion,
  model: string,
  system: string,
  user: string,
  handNumber: number,
): Promise<MemoryWriterOutput> {
  try {
    return await requestViaTool(createChatCompletion, model, system, user, handNumber);
  } catch (toolError) {
    if (isTimeoutError(toolError) || isCapacityError(toolError)) throw toolError;
    try {
      return await requestViaPromptedJson(createChatCompletion, model, system, user, handNumber);
    } catch (fallbackError) {
      if (isTimeoutError(fallbackError) || isCapacityError(fallbackError)) throw fallbackError;
      throw new Error(
        `${ERROR_LABEL}: both tool-call and prompted-JSON attempts failed. ` +
          `Tool-call error: ${(toolError as Error).message}. Fallback error: ${(fallbackError as Error).message}`,
      );
    }
  }
}

// The one function every post-hand memory update goes through, mirroring
// getPersonaTurn's role for persona decisions (see CLAUDE.md). Rotates
// across the same free-model pool persona turns use — see
// getPersonaTurnFromOpenRouter — so one slow/unavailable model doesn't
// stall every hand's memory write until it recovers. A capacity error also
// puts that model on a short cross-call cooldown (see modelCooldown.ts) so
// persona-turn and celebration calls steer around it too.
export async function getPostHandMemoryUpdates(
  input: MemoryWriterInput,
  handNumber: number,
  createChatCompletion: CreateChatCompletion = defaultCreateChatCompletion(ERROR_LABEL),
): Promise<MemoryWriterOutput> {
  const system = buildSystemPrompt(input.personaId);
  const user = buildUserMessage(input);

  const triedModels: string[] = [];
  for (let attempt = 0; attempt < FREE_OPENROUTER_MODELS.length; attempt++) {
    const model = pickRandomOpenRouterModel(triedModels);
    triedModels.push(model);
    try {
      return await requestMemoryUpdateFromModel(createChatCompletion, model, system, user, handNumber);
    } catch (err) {
      if (isCapacityError(err)) markModelCooldown(model, err.retryAfterSeconds);
      const isRetryable = isTimeoutError(err) || isCapacityError(err);
      const isLastAttempt = attempt === FREE_OPENROUTER_MODELS.length - 1;
      if (!isRetryable || isLastAttempt) throw err;
    }
  }
  throw new Error(`${ERROR_LABEL}: unreachable`);
}
