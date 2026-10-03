import type { Card } from "@/types";
import { rankValue } from "./cards";

export type HandCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush";

const CATEGORY_ORDER: HandCategory[] = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
];

export interface HandRank {
  category: HandCategory;
  categoryRank: number;
  // Descending list of rank values used to break ties within a category.
  tiebreakers: number[];
}

function straightHighCard(descendingUniqueValues: number[]): number | null {
  if (descendingUniqueValues.length !== 5) return null;
  if (descendingUniqueValues[0] - descendingUniqueValues[4] === 4) {
    return descendingUniqueValues[0];
  }
  // Wheel: A-2-3-4-5, Ace plays low, straight high card is the 5.
  if (descendingUniqueValues.join(",") === "14,5,4,3,2") {
    return 5;
  }
  return null;
}

function evaluateFiveCardHand(cards: Card[]): HandRank {
  const values = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const uniqueDescending = Array.from(new Set(values)).sort((a, b) => b - a);
  const straightHigh = straightHighCard(uniqueDescending);
  const isStraight = straightHigh !== null;

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const grouped = Array.from(counts.entries()).sort(([valueA, countA], [valueB, countB]) => {
    if (countB !== countA) return countB - countA;
    return valueB - valueA;
  });
  const countPattern = grouped.map(([, count]) => count);
  const groupedValues = grouped.map(([value]) => value);

  let category: HandCategory;
  let tiebreakers: number[];

  if (isStraight && isFlush) {
    category = "straight_flush";
    tiebreakers = [straightHigh as number];
  } else if (countPattern[0] === 4) {
    category = "four_of_a_kind";
    tiebreakers = groupedValues;
  } else if (countPattern[0] === 3 && countPattern[1] === 2) {
    category = "full_house";
    tiebreakers = groupedValues;
  } else if (isFlush) {
    category = "flush";
    tiebreakers = values;
  } else if (isStraight) {
    category = "straight";
    tiebreakers = [straightHigh as number];
  } else if (countPattern[0] === 3) {
    category = "three_of_a_kind";
    tiebreakers = groupedValues;
  } else if (countPattern[0] === 2 && countPattern[1] === 2) {
    category = "two_pair";
    tiebreakers = groupedValues;
  } else if (countPattern[0] === 2) {
    category = "pair";
    tiebreakers = groupedValues;
  } else {
    category = "high_card";
    tiebreakers = values;
  }

  return { category, categoryRank: CATEGORY_ORDER.indexOf(category), tiebreakers };
}

export function compareHandRanks(a: HandRank, b: HandRank): number {
  if (a.categoryRank !== b.categoryRank) return a.categoryRank - b.categoryRank;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// Best 5-card hand out of any number of cards >= 5 (7 for hole + board).
export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, got ${cards.length}`);
  }
  const best = combinations(cards, 5)
    .map(evaluateFiveCardHand)
    .reduce((best, current) => (compareHandRanks(current, best) > 0 ? current : best));
  return best;
}
