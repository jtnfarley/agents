import type { PersonaPromptContext, PersonaResponse } from "@/types";

const STUB_DIALOGUE: Record<PersonaResponse["action"], string> = {
  fold: "I fold.",
  check: "Check.",
  call: "I'll call.",
  raise: "Raising.",
};

// Placeholder `getPersonaTurn`: picks uniformly among the legal actions and
// returns fixed dialogue. Phase 3 replaces this with a real Claude call
// behind the same signature — nothing outside /lib/personas should change.
export function createStubPersona(
  rng: () => number = Math.random,
): (context: PersonaPromptContext) => Promise<PersonaResponse> {
  return async (context: PersonaPromptContext): Promise<PersonaResponse> => {
    const { legalActions } = context;
    if (legalActions.length === 0) {
      throw new Error("createStubPersona: no legal actions to choose from");
    }
    const choice = legalActions[Math.floor(rng() * legalActions.length)];

    let amount = 0;
    if (choice.type === "raise") {
      const min = choice.minAmount ?? 0;
      const max = choice.maxAmount ?? min;
      amount = min + Math.floor(rng() * (max - min + 1));
    }

    return {
      reasoning: "stub persona: chose randomly among legal actions",
      action: choice.type,
      amount,
      dialogue: STUB_DIALOGUE[choice.type],
      gesture: "shrugs",
      newDiscussionTopic: null,
    };
  };
}

export const getPersonaTurn = createStubPersona();
