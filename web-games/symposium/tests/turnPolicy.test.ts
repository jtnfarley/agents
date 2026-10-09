import { describe, expect, it } from "vitest";
import {
  isStuck,
  MOVE_CYCLE,
  nextSpeaker,
  planMove,
  responderFor,
  shouldSummarize,
  turnsSinceSummary,
} from "@/lib/turnPolicy";
import type { Move, SpeakerId, Turn } from "@/lib/types";

let n = 0;
const phil = (speaker: SpeakerId, move: Move = "rebut"): Turn => ({
  id: `t${n++}`,
  speaker,
  move,
  target: speaker === "A" ? "B" : "A",
  text: "x",
});

/** Plays `count` philosopher turns with the given policy and returns the turns and moves. */
function play(count: number) {
  const turns: Turn[] = [];
  const moves: Move[] = [];
  for (let i = 0; i < count; i++) {
    const m = planMove(turns);
    moves.push(m);
    turns.push(phil(nextSpeaker(turns), m));
  }
  return { turns, moves };
}

describe("nextSpeaker", () => {
  it("opens with A", () => {
    expect(nextSpeaker([])).toBe("A");
  });

  it("alternates A, B, A, B", () => {
    const { turns } = play(6);
    expect(turns.map((t) => (t.speaker === "user" ? "?" : t.speaker))).toEqual(["A", "B", "A", "B", "A", "B"]);
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

  it("never repeats a move back to back", () => {
    const { moves } = play(40);
    for (let i = 2; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1]);
  });

  it("never repeats argue three times in a row", () => {
    const { moves } = play(40);
    for (let i = 2; i < moves.length; i++) {
      expect(moves[i] === "argue" && moves[i - 1] === "argue" && moves[i - 2] === "argue").toBe(false);
    }
  });

  it("nudges toward a question or a concession when the exchange is stuck", () => {
    const turns = [phil("A", "open"), phil("B", "rebut"), phil("A", "argue")];
    expect(isStuck(turns)).toBe(true);
    expect(["question", "concede"]).toContain(planMove(turns));
  });

  it("does not let a visitor answer hide a stuck exchange", () => {
    const turns: Turn[] = [
      phil("A", "rebut"),
      { id: "u", speaker: "user", target: "B", text: "hm" },
      phil("B", "answer"),
      phil("A", "argue"),
    ];
    expect(isStuck(turns)).toBe(true);
  });

  it("uses every rotation move over a long debate", () => {
    const { moves } = play(12);
    for (const m of MOVE_CYCLE) expect(moves).toContain(m);
  });
});

describe("shouldSummarize", () => {
  it("runs after every fourth philosopher turn and not before", () => {
    const hits: number[] = [];
    for (let i = 1; i <= 9; i++) {
      const { turns } = play(i);
      if (shouldSummarize(turns)) hits.push(i);
    }
    expect(hits).toEqual([4, 8]);
  });

  it("does not run on a visitor turn alone", () => {
    expect(shouldSummarize([{ id: "u", speaker: "user", target: "A", text: "hi" }])).toBe(false);
  });
});

describe("turnsSinceSummary", () => {
  it("returns every turn when nothing has been summarized", () => {
    const { turns } = play(3);
    expect(turnsSinceSummary(turns, 0)).toEqual(turns);
  });

  it("returns only the turns after the last summarized philosopher turn", () => {
    const { turns } = play(6);
    const since = turnsSinceSummary(turns, 4);
    expect(since).toEqual(turns.slice(4));
  });

  it("keeps a visitor turn that falls after the summarized point", () => {
    const { turns } = play(4);
    const visitor: Turn = { id: "u", speaker: "user", target: "A", text: "hi" };
    expect(turnsSinceSummary([...turns, visitor], 4)).toEqual([visitor]);
  });
});
