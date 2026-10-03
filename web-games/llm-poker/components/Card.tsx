import type { Card as CardType } from "@/types";
import styles from "./Table.module.css";

const SUIT_SYMBOL: Record<CardType["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS = new Set<CardType["suit"]>(["hearts", "diamonds"]);

export function Card({ card, variant = "hole" }: { card: CardType; variant?: "hole" | "board" }) {
  const isRed = RED_SUITS.has(card.suit);
  const classes = [
    styles.card,
    variant === "board" ? styles.cardBoard : styles.cardHole,
    isRed ? styles.cardRed : styles.cardBlack,
  ].join(" ");

  return (
    <span className={classes}>
      {card.rank}
      {SUIT_SYMBOL[card.suit]}
    </span>
  );
}
