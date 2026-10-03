import type { Card, CelebrationPromptContext, PersonaProfile } from "@/types";
import { findPersonaProfile } from "./profiles";

function formatCard(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

function formatCards(cards: Card[]): string {
  return cards.length > 0 ? cards.map(formatCard).join(" ") : "(none dealt)";
}

export function buildCelebrationSystemPrompt(profile: PersonaProfile): string {
  return [
    `You are ${profile.displayName}, playing in a persistent, ongoing Texas Hold'em game against other historical and philosophical figures, reimagined as comedic personas at a poker table.`,
    "",
    `Voice: ${profile.voice}`,
    `Temperament and playstyle: ${profile.temperament}`,
    "",
    "You just won a hand. Deliver one short, in-character reaction — gloating, celebrating, or savoring the win however this persona would. Keep it to a single spoken line, this is a live spectator table, not a monologue.",
    "You must respond by calling the submit_hand_celebration tool exactly once, and with nothing else in your response.",
  ].join("\n");
}

export function buildCelebrationUserMessage(context: CelebrationPromptContext): string {
  const { handNumber, board, ownHoleCards, potWon, wonAtShowdown, opponentPersonaIds } = context;

  const opponentNames = opponentPersonaIds.map(
    (id) => findPersonaProfile(id)?.displayName ?? id,
  );
  const opponentLine =
    opponentNames.length > 0
      ? `Seats you just beat: ${opponentNames.join(", ")}.`
      : "You won uncontested.";

  return [
    `Hand #${handNumber} just ended — you won.`,
    `Board: ${formatCards(board)}`,
    `Your hole cards: ${formatCards(ownHoleCards)}`,
    `Pot won: $${potWon}`,
    wonAtShowdown
      ? "You won at showdown — everyone still in got to see your hand."
      : "Everyone else folded — nobody saw your cards.",
    opponentLine,
  ].join("\n");
}
