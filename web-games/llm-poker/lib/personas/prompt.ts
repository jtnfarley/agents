import type {
  Card,
  HandActionLogEntry,
  LegalAction,
  PersonaProfile,
  PersonaPromptContext,
} from "@/types";
import { findPersonaProfile } from "./profiles";

function formatCard(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

function formatCards(cards: Card[]): string {
  return cards.length > 0 ? cards.map(formatCard).join(" ") : "(none dealt)";
}

function formatLegalAction(action: LegalAction): string {
  switch (action.type) {
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "call":
      return "call";
    case "raise":
      return `raise (your total bet this round would land between $${action.minAmount} and $${action.maxAmount})`;
  }
}

export function buildSystemPrompt(profile: PersonaProfile): string {
  return [
    `You are ${profile.displayName}, playing in a persistent, ongoing Texas Hold'em game against other historical and philosophical figures, reimagined as comedic personas at a poker table.`,
    "",
    `Voice: ${profile.voice}`,
    `Temperament and playstyle: ${profile.temperament}`,
    "",
    "Rules of engagement:",
    "- You only ever know your own hole cards. Never assume or invent knowledge of any other seat's hole cards.",
    "- Make your decision using the game state provided, your own hole cards, your temperament, and anything you remember about your opponents.",
    "- Stay in character in both your dialogue and gesture, but keep dialogue to a short spoken line, no more than 3 sentences — this is a live spectator table, not a monologue. Keep gesture to a single short phrase, 10 words or fewer.",
    "- This table is a running conversation, not a series of isolated turns: read what the other seats just said and did (below) and let it land — react to the seat that acted right before you, needle a rival, call back to something said earlier in the hand, or stay pointedly silent if that fits your character better. Address other personas by name when it makes sense.",
    "- This table thrives on conversation, not just cards, via an open-floor discussion topic — a question, provocation, or debate put to everyone, which runs for as long as the table lets it. Check below: if NO discussion is currently active, treat that as an opening, not a fallback — you should be the one who starts one more often than not, especially if you have little to react to this turn. If one IS active, weigh in on it in character rather than starting a new one — only hijack the subject if your character genuinely would. Make it happen by setting newDiscussionTopic in the tool call: your own words to start or redirect the conversation, or an empty string to leave things exactly as they are.",
    "- You must respond by calling the submit_persona_turn tool exactly once, and with nothing else in your response.",
  ].join("\n");
}

function formatHandActionLogEntry(entry: HandActionLogEntry, selfPersonaId: string): string {
  const name =
    entry.personaId === selfPersonaId
      ? "You"
      : (findPersonaProfile(entry.personaId)?.displayName ?? entry.personaId);
  const actionPhrase =
    entry.action === "raise" ? `raised to $${entry.amount}` : `${entry.action}ed`;
  const said = entry.dialogue ? ` — "${entry.dialogue}"` : "";
  return `- [${entry.bettingRound}] ${name} ${actionPhrase}${said}`;
}

// The gameState on PersonaPromptContext is the full, spectator-omniscient
// GameState type (it carries every seat's hole cards for the broadcast).
// CLAUDE.md is explicit that persona prompts must only ever see their own
// hole cards — so every other seat's holeCards gets redacted here, and this
// function is the only place that's allowed to matter.
function formatDiscussionTopic(
  discussionTopic: PersonaPromptContext["discussionTopic"],
  selfPersonaId: string,
): string {
  if (!discussionTopic) {
    return "- (none — this is your opening: put a question, jab, or provocation to the table now, in character)";
  }
  const raisedBySelf = discussionTopic.raisedByPersonaId === selfPersonaId;
  const raiserName = raisedBySelf
    ? "you"
    : (findPersonaProfile(discussionTopic.raisedByPersonaId)?.displayName ??
      discussionTopic.raisedByPersonaId);
  return `- "${discussionTopic.topic}" (put to the table by ${raiserName}, hand #${discussionTopic.handNumber})`;
}

export function buildUserMessage(context: PersonaPromptContext): string {
  const {
    gameState,
    ownHoleCards,
    legalActions,
    privateMemory,
    tableDigest,
    handActionLog,
    discussionTopic,
  } = context;

  const seatLines = gameState.seats.map((seat) => {
    const isSelf = seat.personaId === context.personaId;
    const name = seat.personaId
      ? (findPersonaProfile(seat.personaId)?.displayName ?? seat.personaId)
      : "(open seat)";
    const you = isSelf ? " [YOU]" : "";
    const holeCards = isSelf ? formatCards(ownHoleCards) : "hidden";
    return `- Seat ${seat.seatId} (${name})${you}: stack $${seat.stack}, status ${seat.status}, hole cards ${holeCards}`;
  });

  const legalActionLines = legalActions.map((a) => `- ${formatLegalAction(a)}`);

  const privateMemoryLines =
    privateMemory.length > 0
      ? privateMemory.map((m) => `- (${m.type}${m.target ? `, re: ${m.target}` : ""}) ${m.note}`)
      : ["- (nothing noted yet)"];

  const tableDigestLines =
    tableDigest.length > 0
      ? tableDigest.map((d) => `- ${d.note}`)
      : ["- (nothing recent)"];

  const handActionLogLines =
    handActionLog.length > 0
      ? handActionLog.map((e) => formatHandActionLogEntry(e, context.personaId))
      : ["- (nothing yet — you're first to act this hand)"];

  const lastEntry = handActionLog.at(-1);
  const justHappenedLines: string[] = [];
  if (lastEntry && lastEntry.personaId !== context.personaId) {
    const lastName = findPersonaProfile(lastEntry.personaId)?.displayName ?? lastEntry.personaId;
    const lastActionPhrase =
      lastEntry.action === "raise" ? `raised to $${lastEntry.amount}` : `${lastEntry.action}ed`;
    const lastSaid = lastEntry.dialogue ? ` and said: "${lastEntry.dialogue}"` : "";
    justHappenedLines.push(
      "",
      `The seat right before you was ${lastName}, who just ${lastActionPhrase}${lastSaid}. React to it if it fits your character.`,
    );
  }

  return [
    `Hand #${gameState.handNumber}, ${gameState.bettingRound} betting round.`,
    `Board: ${formatCards(gameState.board)}`,
    `Pot: $${gameState.potTotal}`,
    "",
    "Seats:",
    ...seatLines,
    "",
    `Your hole cards: ${formatCards(ownHoleCards)}`,
    "",
    "Your legal actions this turn:",
    ...legalActionLines,
    "",
    "Your private memory:",
    ...privateMemoryLines,
    "",
    "Shared table digest (recent, from the last few hands):",
    ...tableDigestLines,
    "",
    "Current table discussion:",
    formatDiscussionTopic(discussionTopic, context.personaId),
    "",
    "What's happened at the table so far this hand (public — action and dialogue only):",
    ...handActionLogLines,
    ...justHappenedLines,
  ].join("\n");
}
