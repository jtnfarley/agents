import { afterEach, describe, expect, it } from "vitest";
import { clearAllCooldowns, markModelCooldown } from "./modelCooldown";
import { FREE_OPENROUTER_MODELS, isOpenRouterPersona, pickRandomOpenRouterModel } from "./openrouterModels";

afterEach(() => {
  clearAllCooldowns();
});

describe("pickRandomOpenRouterModel", () => {
  it("always returns a model from the free pool", () => {
    for (let i = 0; i < 20; i++) {
      expect(FREE_OPENROUTER_MODELS).toContain(pickRandomOpenRouterModel());
    }
  });

  it("never returns an excluded model while alternatives remain", () => {
    const [excluded] = FREE_OPENROUTER_MODELS;
    for (let i = 0; i < 20; i++) {
      expect(pickRandomOpenRouterModel([excluded])).not.toBe(excluded);
    }
  });

  it("falls back to the full pool once every model has been excluded", () => {
    expect(FREE_OPENROUTER_MODELS).toContain(pickRandomOpenRouterModel([...FREE_OPENROUTER_MODELS]));
  });

  it("never returns a model that's in cooldown while alternatives remain", () => {
    const [cooling] = FREE_OPENROUTER_MODELS;
    markModelCooldown(cooling);
    for (let i = 0; i < 20; i++) {
      expect(pickRandomOpenRouterModel()).not.toBe(cooling);
    }
  });

  it("falls back to a cooling-down model once every model is in cooldown", () => {
    for (const model of FREE_OPENROUTER_MODELS) markModelCooldown(model);
    expect(FREE_OPENROUTER_MODELS).toContain(pickRandomOpenRouterModel());
  });
});

describe("isOpenRouterPersona", () => {
  it("is true for a persona routed through OpenRouter", () => {
    expect(isOpenRouterPersona("diogenes")).toBe(true);
  });

  it("is false for an unknown persona", () => {
    expect(isOpenRouterPersona("not-a-real-persona")).toBe(false);
  });
});
