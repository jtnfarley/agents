import { describe, expect, it } from "vitest";
import { createDeck, rankValue } from "./cards";
import { createRng, shuffle } from "./rng";

describe("createDeck", () => {
  it("has 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const unique = new Set(deck.map((c) => `${c.rank}-${c.suit}`));
    expect(unique.size).toBe(52);
  });
});

describe("rankValue", () => {
  it("orders 2 through A ascending", () => {
    expect(rankValue("2")).toBe(2);
    expect(rankValue("10")).toBe(10);
    expect(rankValue("J")).toBe(11);
    expect(rankValue("A")).toBe(14);
  });
});

describe("shuffle", () => {
  it("is deterministic for a given seed", () => {
    const deck = createDeck();
    const a = shuffle(deck, createRng(42));
    const b = shuffle(deck, createRng(42));
    expect(a).toEqual(b);
  });

  it("produces a different order for a different seed", () => {
    const deck = createDeck();
    const a = shuffle(deck, createRng(1));
    const b = shuffle(deck, createRng(2));
    expect(a).not.toEqual(b);
  });

  it("does not mutate the input array", () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck, createRng(7));
    expect(deck).toEqual(original);
  });

  it("keeps all 52 cards, just reordered", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, createRng(99));
    expect(shuffled).toHaveLength(52);
    const unique = new Set(shuffled.map((c) => `${c.rank}-${c.suit}`));
    expect(unique.size).toBe(52);
  });
});
