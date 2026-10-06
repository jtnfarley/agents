import { describe, expect, it } from "vitest";
import { nextSpeaker, planMove, responderFor, shouldSummarize, MOVE_CYCLE } from "@/lib/turnPolicy";
import type { Move, SpeakerId, Turn } from "@/lib/types";

let n = 0;
const phil = (speaker: SpeakerId, move: Move = "rebut"): Turn => ({
  id: `t${n++}`,
  speaker,
  move,
  target: speaker === "A" ? "B" : "A",
  text: "x",
});

describe("nextSpeaker", () => {
  it("opens with A", () => {
    expect(nextSpeaker([])).toBe("A");
  });

  it("alternates A, B, A, B", () => {
    const turns: Turn[] = [];
    const order: SpeakerId[] = [];
    for (let i = 0; i < 6; i++) {
      const s = nextSpeaker(turns);
      order.push(s);
      turns.push(phil(s));
    }
    expect(order).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("ignores visitor turns when choosing the next seat", () => {
    const turns: Turn[] = [phil("A"), { id: "u", speaker: "user", target: "both", text: "hi" }];
    expect(nextSpeaker(turns)).toBe("B");
  });
});

describe("responderFor", () => {
  it("sends A and both to A, and B to B", () => {
    expect(responderFor("A")).toBe("A");
    expect(responderFor("B")).toBe("B");
    expect(responderFor("both")).toBe("A");
  });
});

describe("planMove", () => {
  it("opens the debate with an opening move", () => {
    expect(planMove([])).toBe("open");
  });

  it("never repeats argue three times in a row", () => {
    const turns: Turn[] = [];
    const moves: Move[] = [];
    for (let i = 0; i < 25; i++) {
      const m = planMove(turns);
      moves.push(m);
      turns.push(phil(nextSpeaker(turns), m));
    }
    for (let i = 2; i < moves.length; i++) {
      const run = moves[i] === "argue" && moves[i - 1] === "argue" && moves[i - 2] === "argue";
      expect(run).toBe(false);
    }
    expect(MOVE_CYCLE).toContain("argue");
  });
});

describe("shouldSummarize", () => {
  it("runs after every fourth philosopher turn and not before", () => {
    const turns: Turn[] = [];
    const hits: number[] = [];
    for (let i = 1; i <= 9; i++) {
      turns.push(phil(nextSpeaker(turns)));
      if (shouldSummarize(turns)) hits.push(i);
    }
    expect(hits).toEqual([4, 8]);
  });

  it("does not run on a visitor turn alone", () => {
    expect(shouldSummarize([{ id: "u", speaker: "user", target: "A", text: "hi" }])).toBe(false);
  });
});
