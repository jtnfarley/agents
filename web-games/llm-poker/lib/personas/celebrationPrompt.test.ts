import { describe, expect, it } from "vitest";
import type { CelebrationPromptContext } from "@/types";
import { parseCards } from "@/lib/engine/testUtils";
import { buildCelebrationSystemPrompt, buildCelebrationUserMessage } from "./celebrationPrompt";
import { findPersonaProfile } from "./profiles";

function context(overrides: Partial<CelebrationPromptContext> = {}): CelebrationPromptContext {
  return {
    personaId: "diogenes",
    handNumber: 3,
    board: parseCards("10H JH QH"),
    ownHoleCards: parseCards("AH AS"),
    potWon: 240,
    wonAtShowdown: true,
    opponentPersonaIds: ["sappho"],
    ...overrides,
  };
}

describe("buildCelebrationSystemPrompt", () => {
  it("includes the persona's voice and temperament", () => {
    const profile = findPersonaProfile("diogenes")!;
    const prompt = buildCelebrationSystemPrompt(profile);

    expect(prompt).toContain(profile.voice);
    expect(prompt).toContain(profile.temperament);
    expect(prompt).toContain("submit_hand_celebration");
  });
});

describe("buildCelebrationUserMessage", () => {
  it("reports the hand number, board, hole cards, and pot won", () => {
    const message = buildCelebrationUserMessage(context());

    expect(message).toContain("Hand #3");
    expect(message).toContain("10H JH QH");
    expect(message).toContain("AH AS");
    expect(message).toContain("$240");
  });

  it("names opponents by display name when the hand went to showdown", () => {
    const message = buildCelebrationUserMessage(context({ wonAtShowdown: true, opponentPersonaIds: ["sappho"] }));

    expect(message).toContain(findPersonaProfile("sappho")!.displayName);
    expect(message).toMatch(/showdown/i);
  });

  it("reports an uncontested win when there were no opponents", () => {
    const message = buildCelebrationUserMessage(context({ wonAtShowdown: false, opponentPersonaIds: [] }));

    expect(message).toMatch(/uncontested/i);
    expect(message).toMatch(/folded/i);
  });
});
