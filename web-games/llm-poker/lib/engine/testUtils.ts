import type { Card } from "@/types";

// Parses a space-separated shorthand like "AH KH 10D" into Card objects.
// Suit letters: H=hearts, D=diamonds, C=clubs, S=spades.
export function parseCards(spec: string): Card[] {
  return spec.split(" ").map((token) => {
    const rank = token.slice(0, -1) as Card["rank"];
    const suitChar = token.slice(-1);
    const suit =
      suitChar === "H"
        ? "hearts"
        : suitChar === "D"
          ? "diamonds"
          : suitChar === "C"
            ? "clubs"
            : "spades";
    return { rank, suit } as Card;
  });
}
