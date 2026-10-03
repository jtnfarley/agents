import type { Card, Rank, Suit } from "@/types";

export const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2; // "2" -> 2 ... "A" -> 14
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
