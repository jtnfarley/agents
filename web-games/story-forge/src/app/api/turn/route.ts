import { z } from "zod";
import {
  ENDING_TIER_GUIDANCE,
  RISK_ASSESSMENT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  describeState,
  resolveEndingRoll,
  resolveRoll,
  rollD20,
} from "@/lib/gameRules";
import { generateWithRotation } from "@/lib/llm";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  GameStateSchema,
  NarrationOutputSchema,
  RiskAssessmentSchema,
  type TurnResponse,
} from "@/lib/schemas";

const TurnRequestSchema = z.object({
  state: GameStateSchema,
  action: z.string().min(1).max(500),
  // Skips the risk-assessment call for a player-requested ending — asking to
  // end the story isn't a risky action, it's a request the narration call
  // honors directly via the system prompt's ending-trigger instructions.
  forceEnd: z.boolean().optional(),
});

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(getClientIp(req));
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many actions — try again in about ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = TurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { state, action, forceEnd } = parsed.data;

  try {
    let roll: TurnResponse["roll"];
    let endingRoll: TurnResponse["endingRoll"];

    if (forceEnd) {
      const result = rollD20();
      endingRoll = { result, tier: resolveEndingRoll(result) };
    } else {
      const assessment = await generateWithRotation({
        schema: RiskAssessmentSchema,
        system: RISK_ASSESSMENT_SYSTEM_PROMPT,
        prompt: [describeState(state), `Player action: ${action}`].join("\n\n"),
        label: "risk-assessment",
      });

      if (assessment.risky && assessment.dc) {
        const dc = assessment.dc;
        const result = rollD20();
        roll = { dc, result, outcomeTier: resolveRoll(result, dc) };
      }
    }

    const narrationPrompt = [
      describeState(state),
      `Player action: ${action}`,
      roll
        ? `This action was risky. DC ${roll.dc}, rolled ${roll.result}, outcome tier: ${roll.outcomeTier}. Narrate consistent with this outcome tier — the tier is already decided, do not re-decide success or failure yourself.`
        : "This action was judged not risky (no roll) — resolve it narratively as a matter of established fact, per the off-script-actions rule if the premise doesn't hold.",
      forceEnd
        ? `The player has asked to end the story now, picking up exactly where things stand at "${state.currentDecisionPoint}" — do not restart or re-describe the scene, and do not soften or contradict what just happened. Set "narration" to a single short sentence bridging into the ending (one sentence only — the real ending goes in "epilogue"). "epilogue" is where the actual resolution belongs: a genuine, tone-matched epilogue that follows directly from the current situation and resolves establishedFacts, not a trail-off. The ending's tone is already decided — do not re-decide it yourself: ${ENDING_TIER_GUIDANCE[endingRoll!.tier]} Set ended: true and endingOffered: true. The schema still requires two choices; they will be ignored, so use short placeholders.`
        : "",
      !forceEnd && (roll?.outcomeTier === "critFail" || roll?.outcomeTier === "critSuccess")
        ? "This was a critical roll (natural 1 or 20). Per the ending-trigger rule, offer the player a genuine option to end the story here: make one of your two choices a clear ending path, and set endingOffered: true. Don't force it — the other choice should let them continue, and ended should stay false unless the player actually picks the ending path."
        : "",
      `Third person, strictly — narrate ${state.protagonist.name} doing things; never address the player as "you".`,
      forceEnd
        ? ""
        : "Narration: at most 2 paragraphs, no more than 6 sentences each. Keep it tight.",
      forceEnd
        ? ""
        : `Move the story forward. Don't hand back a decision that's basically the same one as before — if "${action}" was cautious or non-committal, something in the world changes anyway (time passes, someone acts, a threat closes in) so the next choice isn't just "wait some more."`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const narration = await generateWithRotation({
      schema: NarrationOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: narrationPrompt,
      label: forceEnd ? "narration (forced end)" : "narration",
    });

    const turnResponse: TurnResponse = {
      ...narration,
      roll,
      endingRoll,
      updatedState: {
        ...narration.updatedState,
        genre: state.genre,
        protagonist: state.protagonist,
      },
    };

    return Response.json(turnResponse);
  } catch (err) {
    console.error("api/turn failed", err);
    return Response.json({ error: "Failed to continue the story" }, { status: 500 });
  }
}
