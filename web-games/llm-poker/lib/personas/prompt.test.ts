import { describe, expect, it } from "vitest";
import type { PersonaPromptContext } from "@/types";
import { parseCards } from "@/lib/engine/testUtils";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { findPersonaProfile } from "./profiles";

function context(overrides: Partial<PersonaPromptContext> = {}): PersonaPromptContext {
  return {
    personaId: "diogenes",
    gameState: {
      handNumber: 3,
      potTotal: 60,
      board: parseCards("10H JH QH"),
      seats: [
        {
          seatId: 0,
          personaId: "diogenes",
          stack: 940,
          holeCards: parseCards("AH AS"),
          status: "active",
        },
        {
          seatId: 1,
          personaId: "sappho",
          stack: 970,
          holeCards: parseCards("2C 2D"),
          status: "active",
        },
      ],
      actingSeat: 0,
      dealerSeat: 1,
      bettingRound: "flop",
    },
    ownHoleCards: parseCards("AH AS"),
    legalActions: [
      { type: "fold" },
      { type: "call" },
      { type: "raise", minAmount: 40, maxAmount: 940 },
    ],
    privateMemory: [
      { type: "tell_noticed", target: "sappho", note: "Sappho slow-plays big pairs.", importance: 3 },
    ],
    tableDigest: [{ note: "Nietzsche went all-in preflop last hand.", handWritten: 2, importance: 2 }],
    handActionLog: [
      {
        seatId: 1,
        personaId: "sappho",
        action: "raise",
        amount: 40,
        dialogue: "A small wager, like a fragment left unfinished.",
        bettingRound: "flop",
      },
    ],
    discussionTopic: null,
    ...overrides,
  };
}

describe("buildUserMessage", () => {
  it("never includes another seat's hole cards", () => {
    const message = buildUserMessage(context());
    // Sappho's actual hole cards (2C 2D) must never appear anywhere in the prompt.
    expect(message).not.toContain("2C");
    expect(message).not.toContain("2D");
    expect(message).toContain("hole cards hidden");
  });

  it("includes the persona's own hole cards", () => {
    const message = buildUserMessage(context());
    expect(message).toContain("AH AS");
  });

  it("marks the acting persona's own seat and names opponents by display name", () => {
    const message = buildUserMessage(context());
    expect(message).toContain("[YOU]");
    expect(message).toContain(findPersonaProfile("sappho")!.displayName);
  });

  it("labels an open seat instead of leaking a null personaId", () => {
    const withOpenSeat = context();
    withOpenSeat.gameState.seats.push({
      seatId: 2,
      personaId: null,
      stack: 0,
      holeCards: [],
      status: "eliminated",
    });
    const message = buildUserMessage(withOpenSeat);
    expect(message).toContain("(open seat)");
  });

  it("lists legal actions and memory/digest content", () => {
    const message = buildUserMessage(context());
    expect(message).toContain("fold");
    expect(message).toContain("call");
    expect(message).toContain("raise");
    expect(message).toContain("Sappho slow-plays big pairs.");
    expect(message).toContain("Nietzsche went all-in preflop last hand.");
  });

  it("includes this hand's action log and nudges a reaction to the seat that just acted", () => {
    const message = buildUserMessage(context());
    expect(message).toContain("A small wager, like a fragment left unfinished.");
    expect(message).toContain("Sappho raised to $40");
    expect(message).toContain("The seat right before you was Sappho");
    expect(message).toContain("React to it");
  });

  it("does not prompt a self-reaction when the persona was the last to act", () => {
    const withOverrides = context({
      handActionLog: [
        {
          seatId: 0,
          personaId: "diogenes",
          action: "call",
          amount: 0,
          dialogue: "Fine, I'll indulge you.",
          bettingRound: "flop",
        },
      ],
    });
    const message = buildUserMessage(withOverrides);
    expect(message).not.toContain("The seat right before you");
  });

  it("says nothing yet when no one has acted this hand", () => {
    const message = buildUserMessage(context({ handActionLog: [] }));
    expect(message).toContain("you're first to act this hand");
  });

  it("invites starting a discussion when none is active", () => {
    const message = buildUserMessage(context({ discussionTopic: null }));
    expect(message).toContain("this is your opening");
  });

  it("renders the active discussion topic and who raised it", () => {
    const message = buildUserMessage(
      context({ discussionTopic: { topic: "Is love a distraction from the Forms?", raisedByPersonaId: "sappho", handNumber: 2 } }),
    );
    expect(message).toContain("Is love a distraction from the Forms?");
    expect(message).toContain(findPersonaProfile("sappho")!.displayName);
    expect(message).toContain("hand #2");
  });

  it("says 'you' when the acting persona was the one who raised the current topic", () => {
    const message = buildUserMessage(
      context({ discussionTopic: { topic: "Who really won that hand?", raisedByPersonaId: "diogenes", handNumber: 1 } }),
    );
    expect(message).toContain("put to the table by you");
  });
});

describe("buildSystemPrompt", () => {
  it("includes the persona's voice, temperament, and the single-tool instruction", () => {
    const profile = findPersonaProfile("diogenes")!;
    const system = buildSystemPrompt(profile);
    expect(system).toContain(profile.displayName);
    expect(system).toContain(profile.voice);
    expect(system).toContain(profile.temperament);
    expect(system).toContain("submit_persona_turn");
    expect(system).toContain("only ever know your own hole cards");
  });
});
