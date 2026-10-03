import { afterEach, describe, expect, it } from "vitest";
import { OpenRouterCapacityError, type CreateChatCompletion } from "@/lib/personas/openrouterClient";
import { clearAllCooldowns, isModelInCooldown } from "@/lib/personas/modelCooldown";
import { FREE_OPENROUTER_MODELS } from "@/lib/personas/openrouterModels";
import type { HandEvent, MemoryWriterInput } from "@/types";
import { getPostHandMemoryUpdates } from "./writer";

afterEach(() => {
  clearAllCooldowns();
});

function handEvent(overrides: Partial<HandEvent> = {}): HandEvent {
  return {
    seatId: 0,
    personaId: "diogenes",
    action: "call",
    amount: 20,
    reasoning: "diogenes's private reasoning",
    dialogue: "Fine, I'll indulge you.",
    bettingRound: "preflop",
    ...overrides,
  };
}

function input(overrides: Partial<MemoryWriterInput> = {}): MemoryWriterInput {
  return {
    personaId: "diogenes",
    existingPrivateMemory: [],
    handEventLog: [handEvent()],
    ...overrides,
  };
}

function toolCallResponse(toolInput: unknown) {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              function: {
                name: "submit_memory_update",
                arguments: JSON.stringify(toolInput),
              },
            },
          ],
        },
      },
    ],
  };
}

describe("getPostHandMemoryUpdates", () => {
  it("parses a well-formed response and stamps handWritten onto digest entries", async () => {
    const createChatCompletion: CreateChatCompletion = async () =>
      toolCallResponse({
        updatedPrivateMemory: [
          { type: "tell_noticed", target: "nietzsche", note: "overbets when tilted", importance: 4 },
        ],
        newDigestEntries: [{ note: "Nietzsche went all-in on a bluff and lost big", importance: 3 }],
      });

    const result = await getPostHandMemoryUpdates(input(), 7, createChatCompletion);

    expect(result.updatedPrivateMemory).toEqual([
      { type: "tell_noticed", target: "nietzsche", note: "overbets when tilted", importance: 4 },
    ]);
    expect(result.newDigestEntries).toEqual([
      { note: "Nietzsche went all-in on a bluff and lost big", importance: 3, handWritten: 7 },
    ]);
  });

  it("treats an empty-string target as null", async () => {
    const createChatCompletion: CreateChatCompletion = async () =>
      toolCallResponse({
        updatedPrivateMemory: [{ type: "self_correction", target: "", note: "played too loose", importance: 2 }],
        newDigestEntries: [],
      });

    const result = await getPostHandMemoryUpdates(input(), 1, createChatCompletion);
    expect(result.updatedPrivateMemory[0].target).toBeNull();
  });

  it("throws when the response has no tool call", async () => {
    const createChatCompletion: CreateChatCompletion = async () => ({
      choices: [{ message: { content: "no json here at all" } }],
    });
    await expect(getPostHandMemoryUpdates(input(), 1, createChatCompletion)).rejects.toThrow(
      /both tool-call and prompted-JSON attempts failed/,
    );
  });

  it("throws when a private memory entry has an invalid importance", async () => {
    const createChatCompletion: CreateChatCompletion = async () =>
      toolCallResponse({
        updatedPrivateMemory: [{ type: "tell_noticed", target: "", note: "x", importance: 9 }],
        newDigestEntries: [],
      });
    await expect(getPostHandMemoryUpdates(input(), 1, createChatCompletion)).rejects.toThrow(/importance/);
  });

  it("redacts other seats' reasoning out of the prompt sent to the model", async () => {
    let capturedMessages: { role: "system" | "user"; content: string }[] | undefined;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      capturedMessages = params.messages;
      return toolCallResponse({ updatedPrivateMemory: [], newDigestEntries: [] });
    };

    await getPostHandMemoryUpdates(
      input({
        personaId: "diogenes",
        handEventLog: [
          handEvent({ personaId: "diogenes", reasoning: "diogenes's secret plan" }),
          handEvent({ personaId: "sappho", reasoning: "sappho's secret plan" }),
        ],
      }),
      1,
      createChatCompletion,
    );

    const userMessage = capturedMessages?.find((m) => m.role === "user")?.content;
    expect(userMessage).toContain("diogenes's secret plan");
    expect(userMessage).not.toContain("sappho's secret plan");
  });

  it("forces the submit_memory_update tool on a free OpenRouter model", async () => {
    let capturedParams: Parameters<CreateChatCompletion>[0] | undefined;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      capturedParams = params;
      return toolCallResponse({ updatedPrivateMemory: [], newDigestEntries: [] });
    };

    await getPostHandMemoryUpdates(input(), 1, createChatCompletion);

    expect(capturedParams?.tool_choice).toEqual({ type: "function", function: { name: "submit_memory_update" } });
    expect(capturedParams?.model).toBeDefined();
    expect(FREE_OPENROUTER_MODELS).toContain(capturedParams?.model);
  });

  it("retries with a different model when a call times out", async () => {
    const timeoutError = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      if (calledModels.length === 1) {
        throw timeoutError;
      }
      return toolCallResponse({
        updatedPrivateMemory: [
          { type: "tell_noticed", target: "nietzsche", note: "second model answered", importance: 3 },
        ],
        newDigestEntries: [],
      });
    };

    const result = await getPostHandMemoryUpdates(input(), 1, createChatCompletion);

    expect(result.updatedPrivateMemory[0].note).toBe("second model answered");
    expect(calledModels).toHaveLength(2);
    expect(calledModels[0]).not.toBe(calledModels[1]);
  });

  it("gives up once every free model has timed out", async () => {
    const timeoutError = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      throw timeoutError;
    };

    await expect(getPostHandMemoryUpdates(input(), 1, createChatCompletion)).rejects.toBe(timeoutError);
    expect(new Set(calledModels).size).toBe(FREE_OPENROUTER_MODELS.length);
  });

  it("does not retry with a different model on a non-timeout failure", async () => {
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      return { choices: [{ message: { content: "no json here at all" } }] };
    };

    await expect(getPostHandMemoryUpdates(input(), 1, createChatCompletion)).rejects.toThrow(
      /both tool-call and prompted-JSON attempts failed/,
    );
    expect(new Set(calledModels).size).toBe(1);
  });

  it("retries with a different model when a call hits a capacity error, and puts the failed model on cooldown", async () => {
    const capacityError = new OpenRouterCapacityError("rate limited", 5);
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      if (calledModels.length === 1) {
        throw capacityError;
      }
      return toolCallResponse({
        updatedPrivateMemory: [
          { type: "tell_noticed", target: "nietzsche", note: "second model answered", importance: 3 },
        ],
        newDigestEntries: [],
      });
    };

    const result = await getPostHandMemoryUpdates(input(), 1, createChatCompletion);

    expect(result.updatedPrivateMemory[0].note).toBe("second model answered");
    expect(calledModels).toHaveLength(2);
    expect(calledModels[0]).not.toBe(calledModels[1]);
    expect(isModelInCooldown(calledModels[0])).toBe(true);
  });
});
