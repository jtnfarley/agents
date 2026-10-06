import { describe, expect, it } from "vitest";
import { drawPair, type Pair } from "@/lib/pairing";
import { ROSTER } from "@/lib/roster";

const key = (p: Pair) => [p.A, p.B].sort().join("|");

/** A deterministic sequence of values in [0, 1). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("drawPair", () => {
  it("never draws the same philosopher twice", () => {
    for (let n = 0; n < 200; n++) {
      const p = drawPair(ROSTER, null);
      expect(p.A).not.toBe(p.B);
    }
  });

  it("only draws ids from the roster", () => {
    const ids = new Set(ROSTER.map((r) => r.id));
    const p = drawPair(ROSTER, null);
    expect(ids.has(p.A)).toBe(true);
    expect(ids.has(p.B)).toBe(true);
  });

  it("excludes the previous pair in either seat order", () => {
    const previous: Pair = { A: "socrates", B: "kant" };
    for (let n = 0; n < 300; n++) {
      expect(key(drawPair(ROSTER, previous))).not.toBe("kant|socrates");
    }
  });

  it("can draw a random seat assignment", () => {
    const first = drawPair(ROSTER, null, seq(0.5, 0.1));
    const second = drawPair(ROSTER, null, seq(0.5, 0.9));
    expect(first.A).toBe(second.B);
    expect(first.B).toBe(second.A);
  });

  it("throws when the roster cannot offer a new pair", () => {
    const tiny = ROSTER.slice(0, 2);
    expect(() => drawPair(tiny, { A: tiny[0].id, B: tiny[1].id })).toThrow();
  });
});
