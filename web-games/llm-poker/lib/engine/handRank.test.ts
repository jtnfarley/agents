import { describe, expect, it } from "vitest";
import { compareHandRanks, evaluateHand } from "./handRank";
import { parseCards as cards } from "./testUtils";

describe("evaluateHand categories", () => {
  it("recognizes a straight flush", () => {
    const hand = evaluateHand(cards("9H 8H 7H 6H 5H 2C 3D"));
    expect(hand.category).toBe("straight_flush");
  });

  it("recognizes the wheel straight (A-2-3-4-5) as low", () => {
    const hand = evaluateHand(cards("AH 2D 3C 4S 5H 9C KD"));
    expect(hand.category).toBe("straight");
    expect(hand.tiebreakers[0]).toBe(5);
  });

  it("recognizes four of a kind", () => {
    const hand = evaluateHand(cards("9H 9D 9C 9S 2H 3D 4C"));
    expect(hand.category).toBe("four_of_a_kind");
  });

  it("recognizes a full house", () => {
    const hand = evaluateHand(cards("9H 9D 9C 2S 2H 3D 4C"));
    expect(hand.category).toBe("full_house");
  });

  it("recognizes a flush over a straight", () => {
    const hand = evaluateHand(cards("2H 4H 9H JH KH 3C 5D"));
    expect(hand.category).toBe("flush");
  });

  it("recognizes two pair", () => {
    const hand = evaluateHand(cards("9H 9D 2C 2S 4H 6D 7C"));
    expect(hand.category).toBe("two_pair");
  });

  it("recognizes high card", () => {
    const hand = evaluateHand(cards("2H 5D 9C JS KH 3D 7C"));
    expect(hand.category).toBe("high_card");
  });
});

describe("compareHandRanks", () => {
  it("ranks a flush above a straight", () => {
    const flush = evaluateHand(cards("2H 4H 9H JH KH 3C 5D"));
    const straight = evaluateHand(cards("5S 6D 7C 8H 9D 2C 3D"));
    expect(compareHandRanks(flush, straight)).toBeGreaterThan(0);
  });

  it("breaks ties within a category by kicker", () => {
    const pairAcesKingKicker = evaluateHand(cards("AH AD KC 4S 7H 2D 9C"));
    const pairAcesQueenKicker = evaluateHand(cards("AH AD QC 4S 7H 2D 9C"));
    expect(compareHandRanks(pairAcesKingKicker, pairAcesQueenKicker)).toBeGreaterThan(0);
  });

  it("treats equal hands as a tie", () => {
    const a = evaluateHand(cards("2H 4H 9H JH KH 3C 5D"));
    const b = evaluateHand(cards("2S 4S 9S JS KS 3D 5C"));
    expect(compareHandRanks(a, b)).toBe(0);
  });
});
