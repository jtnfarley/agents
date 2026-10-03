import { afterEach, describe, expect, it, vi } from "vitest";
import type { CelebrationPromptContext, PersonaPromptContext } from "@/types";
import { parseCards } from "@/lib/engine/testUtils";

function celebrationContext(personaId: string): CelebrationPromptContext {
  return {
    personaId,
    handNumber: 1,
    board: parseCards("AH KH QH"),
    ownHoleCards: parseCards("AS AC"),
    potWon: 100,
    wonAtShowdown: true,
    opponentPersonaIds: ["mozart"],
  };
}

function context(personaId: string): PersonaPromptContext {
  return {
    personaId,
    gameState: {
      handNumber: 1,
      potTotal: 30,
      board: [],
      seats: [{ seatId: 0, personaId, stack: 990, holeCards: parseCards("AH AS"), status: "active" }],
      actingSeat: 0,
      dealerSeat: 0,
      bettingRound: "preflop",
    },
    ownHoleCards: parseCards("AH AS"),
    legalActions: [{ type: "fold" }, { type: "check" }],
    privateMemory: [],
    tableDigest: [],
    handActionLog: [],
    discussionTopic: null,
  };
}

const ORIGINAL_ENV = process.env.STUB_PERSONA_IDS;

afterEach(() => {
  process.env.STUB_PERSONA_IDS = ORIGINAL_ENV;
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("./openrouterModels");
});

describe("getPersonaTurn dispatcher", () => {
  it("uses the stub when the persona is listed in STUB_PERSONA_IDS", async () => {
    process.env.STUB_PERSONA_IDS = "diogenes";
    vi.resetModules();
    const fallbackModule = await import("./fallbackModel");
    const fallbackSpy = vi.spyOn(fallbackModule, "getPersonaTurnFromFallbackModel");
    const { getPersonaTurn } = await import("./index");

    const result = await getPersonaTurn(context("diogenes"));

    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(result.dialogue).toBeTruthy();
  });

  it("calls the fixed-model fallback by default (STUB_PERSONA_IDS unset) when the persona isn't OpenRouter-routed", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => false }));
    const fallbackModule = await import("./fallbackModel");
    const fallbackSpy = vi
      .spyOn(fallbackModule, "getPersonaTurnFromFallbackModel")
      .mockResolvedValue({
        reasoning: "test",
        action: "fold",
        amount: 0,
        dialogue: "I fold, mortal.",
        gesture: "waves dismissively",
        newDiscussionTopic: null,
      });
    const { getPersonaTurn } = await import("./index");

    const result = await getPersonaTurn(context("diogenes"));

    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(result.dialogue).toBe("I fold, mortal.");
  });

  it("calls the OpenRouter persona when live and the persona is OpenRouter-routed", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => true }));
    const openRouterModule = await import("./openrouter");
    const openRouterSpy = vi
      .spyOn(openRouterModule, "getPersonaTurnFromOpenRouter")
      .mockResolvedValue({
        reasoning: "test",
        action: "fold",
        amount: 0,
        dialogue: "I fold, mortal.",
        gesture: "waves dismissively",
        newDiscussionTopic: null,
      });
    const { getPersonaTurn } = await import("./index");

    const result = await getPersonaTurn(context("diogenes"));

    expect(openRouterSpy).toHaveBeenCalledTimes(1);
    expect(openRouterSpy).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(result.dialogue).toBe("I fold, mortal.");
  });

  it("treats '*' as every persona being stubbed", async () => {
    process.env.STUB_PERSONA_IDS = "*";
    vi.resetModules();
    const fallbackModule = await import("./fallbackModel");
    const fallbackSpy = vi.spyOn(fallbackModule, "getPersonaTurnFromFallbackModel");
    const { getPersonaTurn } = await import("./index");

    const result = await getPersonaTurn(context("mozart"));

    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(result.dialogue).toBeTruthy();
  });

  it("throws for a live personaId with no registered profile", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    const { getPersonaTurn } = await import("./index");

    await expect(getPersonaTurn(context("unknown-persona"))).rejects.toThrow(/no persona profile/);
  });

  it("falls back to the stub instead of throwing when the live provider call fails", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => false }));
    const fallbackModule = await import("./fallbackModel");
    vi.spyOn(fallbackModule, "getPersonaTurnFromFallbackModel").mockRejectedValue(
      new Error("getPersonaTurnFromFallbackModel: request failed (429): rate limited"),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getPersonaTurn } = await import("./index");

    const result = await getPersonaTurn(context("diogenes"));

    expect(["fold", "check"]).toContain(result.action);
    expect(result.dialogue).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("getPersonaCelebration dispatcher", () => {
  it("uses the stub when the persona is listed in STUB_PERSONA_IDS", async () => {
    process.env.STUB_PERSONA_IDS = "diogenes";
    vi.resetModules();
    const fallbackModule = await import("./celebrationFallbackModel");
    const fallbackSpy = vi.spyOn(fallbackModule, "getCelebrationFromFallbackModel");
    const { getPersonaCelebration } = await import("./index");

    const result = await getPersonaCelebration(celebrationContext("diogenes"));

    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(result.dialogue).toBeTruthy();
  });

  it("calls the fixed-model fallback by default (STUB_PERSONA_IDS unset) when the persona isn't OpenRouter-routed", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => false }));
    const fallbackModule = await import("./celebrationFallbackModel");
    const fallbackSpy = vi
      .spyOn(fallbackModule, "getCelebrationFromFallbackModel")
      .mockResolvedValue({ dialogue: "Bow before me, mortals.", gesture: "sweeps the pot in" });
    const { getPersonaCelebration } = await import("./index");

    const result = await getPersonaCelebration(celebrationContext("diogenes"));

    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(result.dialogue).toBe("Bow before me, mortals.");
  });

  it("calls the OpenRouter celebration when live and the persona is OpenRouter-routed", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => true }));
    const openRouterModule = await import("./celebrationOpenRouter");
    const openRouterSpy = vi
      .spyOn(openRouterModule, "getCelebrationFromOpenRouter")
      .mockResolvedValue({ dialogue: "Bow before me, mortals.", gesture: "sweeps the pot in" });
    const { getPersonaCelebration } = await import("./index");

    const result = await getPersonaCelebration(celebrationContext("diogenes"));

    expect(openRouterSpy).toHaveBeenCalledTimes(1);
    expect(openRouterSpy).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(result.dialogue).toBe("Bow before me, mortals.");
  });

  it("throws for a live personaId with no registered profile", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    const { getPersonaCelebration } = await import("./index");

    await expect(getPersonaCelebration(celebrationContext("unknown-persona"))).rejects.toThrow(
      /no persona profile/,
    );
  });

  it("falls back to the stub instead of throwing when the live provider call fails", async () => {
    delete process.env.STUB_PERSONA_IDS;
    vi.resetModules();
    vi.doMock("./openrouterModels", () => ({ isOpenRouterPersona: () => false }));
    const fallbackModule = await import("./celebrationFallbackModel");
    vi.spyOn(fallbackModule, "getCelebrationFromFallbackModel").mockRejectedValue(
      new Error("getCelebrationFromFallbackModel: request failed (429): rate limited"),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getPersonaCelebration } = await import("./index");

    const result = await getPersonaCelebration(celebrationContext("diogenes"));

    expect(result.dialogue).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
