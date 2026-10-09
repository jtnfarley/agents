import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reshuffle, startDebate, summarize, suggestions, takeTurn } from "@/lib/debateEngine";
import { LlmError } from "@/lib/llm";
import type { Debate } from "@/lib/types";

const debate: Debate = {
  id: "d1",
  topic: "Is it ever right to lie?",
  philosophers: { A: "socrates", B: "kant" },
  stances: { A: null, B: null },
  turns: [],
  rollingSummary: "",
  ledger: null,
};

const savedMock = process.env.MOCK_AI;
beforeAll(() => {
  process.env.MOCK_AI = "1";
});
afterAll(() => {
  if (savedMock === undefined) delete process.env.MOCK_AI;
  else process.env.MOCK_AI = savedMock;
});

describe("debate engine in mock mode", () => {
  it("draws a pair that differs from the previous one", async () => {
    const res = await startDebate({ topic: "Is it ever right to lie?", previousPair: { A: "socrates", B: "kant" } });
    expect(res.topic).toBe("Is it ever right to lie?");
    expect(res.a).not.toBe(res.b);
    expect([res.a, res.b].sort().join("|")).not.toBe("kant|socrates");
  });

  it("refuses to reshuffle once a turn exists", async () => {
    const err = await reshuffle({
      topic: debate.topic,
      currentPair: { A: "socrates", B: "kant" },
      turnCount: 1,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).code).toBe("invalid_input");
  });

  it("opens with seat A and sets a stance", async () => {
    const { turns } = await takeTurn({ debate });
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ speaker: "A", move: "open", target: "B" });
    expect(turns[0]).toHaveProperty("stance");
  });

  it("answers a visitor with the visitor turn first, then the addressed seat", async () => {
    const opened = { ...debate, turns: [{ id: "t1", speaker: "A" as const, move: "open" as const, target: "B" as const, text: "x", stance: "s" }] };
    const { turns } = await takeTurn({
      debate: opened,
      userText: "What about the friend at the door?",
      target: "B",
    });
    expect(turns.map((t) => t.speaker)).toEqual(["user", "B"]);
    expect(turns[1]).toMatchObject({ move: "answer", target: "user" });
  });

  it("summarizes with an updated turn count", async () => {
    const out = await summarize({ debate });
    expect(out.ledger.updatedAfterTurn).toBe(0);
    expect(out.ledger.agree.length).toBeGreaterThan(0);
  });

  it("returns suggestion chips", async () => {
    const out = await suggestions();
    expect(out.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});
