import { afterEach, describe, expect, it } from "vitest";
import type { PersonaPromptContext } from "@/types";
import { parseCards } from "@/lib/engine/testUtils";
import { OpenRouterCapacityError } from "./openrouterClient";
import { clearAllCooldowns, isModelInCooldown } from "./modelCooldown";
import { FREE_OPENROUTER_MODELS } from "./openrouterModels";
import { getPersonaTurnFromOpenRouter, type CreateChatCompletion } from "./openrouter";
import { findPersonaProfile } from "./profiles";

afterEach(() => {
  clearAllCooldowns();
});

function context(): PersonaPromptContext {
  return {
    personaId: "diogenes",
    gameState: {
      handNumber: 1,
      potTotal: 30,
      board: [],
      seats: [
        { seatId: 0, personaId: "diogenes", stack: 990, holeCards: parseCards("AH AS"), status: "active" },
        { seatId: 1, personaId: "sappho", stack: 980, holeCards: parseCards("2C 2D"), status: "active" },
      ],
      actingSeat: 0,
      dealerSeat: 1,
      bettingRound: "preflop",
    },
    ownHoleCards: parseCards("AH AS"),
    legalActions: [{ type: "fold" }, { type: "call" }, { type: "raise", minAmount: 40, maxAmount: 990 }],
    privateMemory: [],
    tableDigest: [],
    handActionLog: [],
    discussionTopic: null,
  };
}

describe("getPersonaTurnFromOpenRouter", () => {
  it("parses a well-formed tool-call response into a PersonaResponse", async () => {
    const createChatCompletion: CreateChatCompletion = async () => ({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                function: {
                  name: "submit_persona_turn",
                  arguments: JSON.stringify({
                    reasoning: "Ace pair is strong here.",
                    action: "raise",
                    amount: 100,
                    dialogue: "Even a dog knows when to bite.",
                    gesture: "grins",
                    newDiscussionTopic: "",
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const result = await getPersonaTurnFromOpenRouter(
      context(),
      findPersonaProfile("diogenes")!,
      createChatCompletion,
    );
    expect(result).toEqual({
      reasoning: "Ace pair is strong here.",
      action: "raise",
      amount: 100,
      dialogue: "Even a dog knows when to bite.",
      gesture: "grins",
      newDiscussionTopic: null,
    });
  });

  it("forces tool_choice on the submit_persona_turn function and passes legal action types", async () => {
    let capturedParams: Parameters<CreateChatCompletion>[0] | undefined;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      capturedParams = params;
      return {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    name: "submit_persona_turn",
                    arguments: JSON.stringify({
                      reasoning: "x",
                      action: "fold",
                      amount: 0,
                      dialogue: "x",
                      gesture: "x",
                      newDiscussionTopic: "",
                    }),
                  },
                },
              ],
            },
          },
        ],
      };
    };

    await getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion);

    expect(capturedParams?.model).toBeDefined();
    expect(FREE_OPENROUTER_MODELS).toContain(capturedParams?.model);
    expect(capturedParams?.tool_choice).toEqual({ type: "function", function: { name: "submit_persona_turn" } });
    const tool = capturedParams?.tools?.[0];
    expect(tool?.function.name).toBe("submit_persona_turn");
    expect(tool?.function.parameters).toMatchObject({
      required: ["reasoning", "action", "amount", "dialogue", "gesture", "newDiscussionTopic"],
    });
  });

  it("falls back to prompted JSON when the model returns no tool call", async () => {
    let callCount = 0;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      callCount += 1;
      if (callCount === 1) {
        // First call: model ignores tool_choice and just talks.
        return { choices: [{ message: { content: "I'd rather not use tools." } }] };
      }
      // Second call: no tools param this time — prompted-JSON fallback.
      expect(params.tools).toBeUndefined();
      return {
        choices: [
          {
            message: {
              content:
                '```json\n{"reasoning":"pot odds favor a call","action":"call","amount":0,"dialogue":"Fine.","gesture":"shrugs","newDiscussionTopic":""}\n```',
            },
          },
        ],
      };
    };

    const result = await getPersonaTurnFromOpenRouter(
      context(),
      findPersonaProfile("diogenes")!,
      createChatCompletion,
    );
    expect(result).toEqual({
      reasoning: "pot odds favor a call",
      action: "call",
      amount: 0,
      dialogue: "Fine.",
      gesture: "shrugs",
      newDiscussionTopic: null,
    });
    expect(callCount).toBe(2);
  });

  it("throws a combined error when both the tool-call and fallback attempts fail", async () => {
    const createChatCompletion: CreateChatCompletion = async () => ({
      choices: [{ message: { content: "no json here at all" } }],
    });

    await expect(
      getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toThrow(/both tool-call and prompted-JSON attempts failed/);
  });

  it("throws when the fallback JSON is missing a required field", async () => {
    const createChatCompletion: CreateChatCompletion = async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ action: "fold", amount: 0, dialogue: "...", gesture: "shrugs" }),
          },
        },
      ],
    });

    await expect(
      getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toThrow(/reasoning/);
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
      return {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    name: "submit_persona_turn",
                    arguments: JSON.stringify({
                      reasoning: "second model answered",
                      action: "fold",
                      amount: 0,
                      dialogue: "x",
                      gesture: "x",
                      newDiscussionTopic: "",
                    }),
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const result = await getPersonaTurnFromOpenRouter(
      context(),
      findPersonaProfile("diogenes")!,
      createChatCompletion,
    );

    expect(result.reasoning).toBe("second model answered");
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

    await expect(
      getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toBe(timeoutError);
    expect(new Set(calledModels).size).toBe(FREE_OPENROUTER_MODELS.length);
  });

  it("does not retry with a different model on a non-timeout failure", async () => {
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      return { choices: [{ message: { content: "no json here at all" } }] };
    };

    await expect(
      getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toThrow(/both tool-call and prompted-JSON attempts failed/);
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
      return {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    name: "submit_persona_turn",
                    arguments: JSON.stringify({
                      reasoning: "second model answered",
                      action: "fold",
                      amount: 0,
                      dialogue: "x",
                      gesture: "x",
                      newDiscussionTopic: "",
                    }),
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const result = await getPersonaTurnFromOpenRouter(
      context(),
      findPersonaProfile("diogenes")!,
      createChatCompletion,
    );

    expect(result.reasoning).toBe("second model answered");
    expect(calledModels).toHaveLength(2);
    expect(calledModels[0]).not.toBe(calledModels[1]);
    expect(isModelInCooldown(calledModels[0])).toBe(true);
  });

  it("gives up once every free model has hit a capacity error", async () => {
    const capacityError = new OpenRouterCapacityError("rate limited");
    const calledModels: string[] = [];
    const createChatCompletion: CreateChatCompletion = async (params) => {
      calledModels.push(params.model);
      throw capacityError;
    };

    await expect(
      getPersonaTurnFromOpenRouter(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toBe(capacityError);
    expect(new Set(calledModels).size).toBe(FREE_OPENROUTER_MODELS.length);
  });
});
