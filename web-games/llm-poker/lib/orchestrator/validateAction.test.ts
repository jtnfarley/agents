import { describe, expect, it } from "vitest";
import type { LegalAction, PersonaResponse } from "@/types";
import { resolveAction } from "./validateAction";

function response(overrides: Partial<PersonaResponse> = {}): PersonaResponse {
  return {
    reasoning: "because",
    action: "check",
    amount: 0,
    dialogue: "...",
    gesture: "nods",
    newDiscussionTopic: null,
    ...overrides,
  };
}

describe("resolveAction", () => {
  it("passes a legal fold/check/call through unchanged", () => {
    const legalActions: LegalAction[] = [{ type: "fold" }, { type: "call" }];
    expect(resolveAction(response({ action: "call" }), legalActions)).toEqual({ type: "call" });
  });

  it("caps a raise amount above the legal max", () => {
    const legalActions: LegalAction[] = [
      { type: "fold" },
      { type: "call" },
      { type: "raise", minAmount: 40, maxAmount: 200 },
    ];
    const result = resolveAction(response({ action: "raise", amount: 100_000 }), legalActions);
    expect(result).toEqual({ type: "raise", amount: 200 });
  });

  it("raises a below-minimum raise amount up to the legal minimum", () => {
    const legalActions: LegalAction[] = [
      { type: "fold" },
      { type: "call" },
      { type: "raise", minAmount: 40, maxAmount: 200 },
    ];
    const result = resolveAction(response({ action: "raise", amount: 1 }), legalActions);
    expect(result).toEqual({ type: "raise", amount: 40 });
  });

  it("leaves an in-range raise amount alone", () => {
    const legalActions: LegalAction[] = [{ type: "raise", minAmount: 40, maxAmount: 200 }];
    const result = resolveAction(response({ action: "raise", amount: 75 }), legalActions);
    expect(result).toEqual({ type: "raise", amount: 75 });
  });

  it("falls back to check when the chosen action type isn't legal and check is available", () => {
    const legalActions: LegalAction[] = [{ type: "check" }, { type: "raise", minAmount: 20, maxAmount: 100 }];
    const result = resolveAction(response({ action: "call", amount: 0 }), legalActions);
    expect(result).toEqual({ type: "check" });
  });

  it("falls back to fold when the chosen action type isn't legal and check isn't available", () => {
    const legalActions: LegalAction[] = [{ type: "fold" }, { type: "call" }, { type: "raise", minAmount: 20, maxAmount: 100 }];
    const result = resolveAction(response({ action: "check", amount: 0 }), legalActions);
    expect(result).toEqual({ type: "fold" });
  });

  it("throws if there are no legal actions at all", () => {
    expect(() => resolveAction(response(), [])).toThrow();
  });
});
