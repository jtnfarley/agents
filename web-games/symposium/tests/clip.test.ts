import { describe, expect, it } from "vitest";
import { clip, summaryOutput, turnOutput } from "@/lib/schemas";

describe("clip", () => {
  it("leaves text under the limit alone", () => {
    expect(clip("Short and sound.", 50)).toBe("Short and sound.");
  });

  it("cuts at the last sentence end before the limit", () => {
    const text = "First point holds well. Second point runs on and on without stopping for a while";
    expect(clip(text, 40)).toBe("First point holds well.");
  });

  it("hard-cuts when no sentence end falls in the second half", () => {
    expect(clip("a very long unbroken clause with no stop", 10)).toBe("a very lon");
  });
});

describe("model output schemas", () => {
  it("accepts an over-long turn and clips it to the stored limit", () => {
    const parsed = turnOutput.parse({ text: "x".repeat(950) });
    expect(parsed.text.length).toBeLessThanOrEqual(900);
  });

  it("rejects an empty turn", () => {
    expect(turnOutput.safeParse({ text: "   " }).success).toBe(false);
  });

  it("keeps at most four agree items from a summary", () => {
    const out = summaryOutput.parse({
      rollingSummary: "s",
      ledger: { agree: ["1", "2", "3", "4", "5"], split: [], openQuestions: [] },
    });
    expect(out.ledger.agree).toHaveLength(4);
  });
});
