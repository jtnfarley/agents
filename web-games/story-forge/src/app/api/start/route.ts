import { z } from "zod";
import { SYSTEM_PROMPT } from "@/lib/gameRules";
import { generateWithRotation } from "@/lib/llm";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { GameStateSchema, NarrationOutputSchema, type TurnResponse } from "@/lib/schemas";

const StartRequestSchema = z.object({
  genre: z.string().min(1).max(80),
  protagonist: GameStateSchema.shape.protagonist,
});

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(getClientIp(req));
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many requests — try again in about ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = StartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { genre, protagonist } = parsed.data;

  try {
    const object = await generateWithRotation({
      schema: NarrationOutputSchema,
      system: SYSTEM_PROMPT,
      label: "start",
      prompt: [
        "Begin a brand new story. There is no prior state yet.",
        `Genre: ${genre}`,
        `Protagonist: ${protagonist.name}, ${protagonist.descriptor} (${protagonist.gender})`,
        "Write the opening scene per the opening-scene instructions, and invent establishedFacts, openThreads, and currentDecisionPoint from scratch. This is the very first beat — it is not a risky action, so do not include a roll, and ended/endingOffered must both be false.",
        `Third person, strictly — narrate ${protagonist.name} doing things; never address the player as "you".`,
        "Narration: at most 2 paragraphs, no more than 6 sentences each. Keep it tight.",
      ].join("\n"),
    });

    const turnResponse: TurnResponse = {
      ...object,
      ended: false,
      endingOffered: false,
      updatedState: { ...object.updatedState, genre, protagonist },
    };

    return Response.json(turnResponse);
  } catch (err) {
    console.error("api/start failed", err);
    return Response.json({ error: "Failed to start the story" }, { status: 500 });
  }
}
