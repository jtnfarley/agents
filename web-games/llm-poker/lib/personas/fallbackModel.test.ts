import { describe, expect, it } from "vitest";
import type { PersonaPromptContext } from "@/types";
import { parseCards } from "@/lib/engine/testUtils";
import { getPersonaTurnFromFallbackModel } from "./fallbackModel";
import type { CreateChatCompletion } from "./openrouterClient";
import { findPersonaProfile } from "./profiles";

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

describe("getPersonaTurnFromFallbackModel", () => {
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

    const result = await getPersonaTurnFromFallbackModel(
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

  it("pins requests to the fixed fallback model", async () => {
    let capturedModel: string | undefined;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      capturedModel = params.model;
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

    await getPersonaTurnFromFallbackModel(context(), findPersonaProfile("diogenes")!, createChatCompletion);

    expect(capturedModel).toBe("google/gemma-4-26b-a4b-it:free");
  });

  it("falls back to prompted JSON when the model returns no tool call", async () => {
    let callCount = 0;
    const createChatCompletion: CreateChatCompletion = async (params) => {
      callCount += 1;
      if (callCount === 1) {
        return { choices: [{ message: { content: "I'd rather not use tools." } }] };
      }
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

    const result = await getPersonaTurnFromFallbackModel(
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
      getPersonaTurnFromFallbackModel(context(), findPersonaProfile("diogenes")!, createChatCompletion),
    ).rejects.toThrow(/both tool-call and prompted-JSON attempts failed/);
  });
});
