import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/engine";
import { playHand } from "@/lib/orchestrator";
import type { SeatState } from "@/types";
import { isLivePersona } from "./liveConfig";

// Both must be set, or the test skips. If every seated persona is stubbed
// via STUB_PERSONA_IDS, that would otherwise pass silently with nothing to
// review — see the loggedCount assertion below, which turns that into a
// loud failure instead of a quiet no-op.
const RUN_LIVE =
  process.env.RUN_LIVE_PERSONA_SMOKE === "1" && Boolean(process.env.OPENROUTER_API_KEY);

function seat(seatId: number, personaId: string): SeatState {
  return { seatId, personaId, stack: 1000, holeCards: [], status: "active" };
}

// Manual verification harness for phase 3's acceptance check: "dialogue is
// coherent with the action chosen, every time, across at least 20 hands."
// That's a qualitative call only a human can make, so this doesn't assert
// coherence — it plays 20 hands with real OpenRouter calls for every seated
// persona that's live (the default, unless held back via STUB_PERSONA_IDS)
// and prints their dialogue for review. Nothing is written to a file — read
// the printed lines.
//
// Skipped by default — this spends real API credits. Set both env vars in
// the SAME shell invocation, e.g. (PowerShell):
//   $env:RUN_LIVE_PERSONA_SMOKE = "1"; npx vitest run liveSmoke
// Add $env:STUB_PERSONA_IDS to hold specific personas back on the stub.
describe.skipIf(!RUN_LIVE)("live persona smoke test", () => {
  it("plays 20 hands and logs the live persona's turns for manual review", async () => {
    const seats = [seat(0, "diogenes"), seat(1, "sappho"), seat(2, "nietzsche")];
    let loggedCount = 0;

    console.log(`\n--- live persona smoke test ---\n`);

    for (let hand = 1; hand <= 20; hand++) {
      const result = await playHand(
        {
          seats: seats.map((s) => ({ ...s, stack: 1000 })),
          handNumber: hand,
          dealerSeat: hand % seats.length,
          smallBlind: 10,
          bigBlind: 20,
          rng: createRng(hand),
        },
        { onEvent: () => {} },
      );

      for (const event of result.events) {
        if (isLivePersona(event.personaId)) {
          loggedCount++;
          console.log(
            `[hand ${hand}] ${event.personaId} ${event.bettingRound} ${event.action}` +
              `${event.amount ? ` $${event.amount}` : ""} — "${event.dialogue}"`,
          );
        }
      }

      expect(result.payouts.length).toBeGreaterThan(0);
    }

    console.log(`\n--- ${loggedCount} live persona turns logged above ---\n`);
    // A misconfigured run (e.g. STUB_PERSONA_IDS="*" left set from a prior
    // session) would otherwise pass silently with nothing to review — fail
    // loudly instead.
    expect(loggedCount).toBeGreaterThan(0);
  }, 300_000);
});
