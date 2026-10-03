import type { ActionInput } from "@/lib/engine";
import type { LegalAction, PersonaResponse } from "@/types";

// Turns a persona's free-form response into an engine-legal ActionInput.
// The engine itself throws on anything illegal (see betting.ts), so this is
// the one place a persona's mistake gets corrected before it ever reaches
// the engine. Two failure modes:
//   - action type isn't currently legal (e.g. persona tried to "check" into
//     a bet) -> fall back to the safest legal action instead.
//   - raise amount is outside [minAmount, maxAmount] -> clamp into range.
// Clamping never changes the action's `type`, so the applied action always
// matches what dialogue was generated for; only a wrong `type` triggers the
// fallback path.
export function resolveAction(response: PersonaResponse, legalActions: LegalAction[]): ActionInput {
  if (legalActions.length === 0) {
    throw new Error("resolveAction: no legal actions available");
  }

  const legal = legalActions.find((a) => a.type === response.action);
  if (!legal) {
    return fallbackAction(legalActions);
  }

  if (legal.type === "raise") {
    const min = legal.minAmount ?? 0;
    const max = legal.maxAmount ?? min;
    const amount = Math.min(Math.max(response.amount, min), max);
    return { type: "raise", amount };
  }

  return { type: legal.type };
}

function fallbackAction(legalActions: LegalAction[]): ActionInput {
  const preferredOrder: ActionInput["type"][] = ["check", "fold", "call"];
  for (const type of preferredOrder) {
    const legal = legalActions.find((a) => a.type === type);
    if (legal) return { type: legal.type };
  }
  // Only a raise was on offer — take the minimum.
  const raise = legalActions[0];
  return { type: "raise", amount: raise.minAmount ?? 0 };
}
