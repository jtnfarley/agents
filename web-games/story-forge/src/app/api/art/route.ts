import { deriveStylePrefix } from "@/lib/gameRules";
import { generateArt } from "@/lib/llm";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ArtRequestSchema } from "@/lib/schemas";

/**
 * The narration panel is docked to the left of the viewport (BackgroundLayer
 * scrims left-to-right to match), so the subject needs to stay clear of it
 * on the right instead.
 */
function buildArtPrompt(genre: string, narration: string): string {
  return `${deriveStylePrefix(genre)}. Ambient establishing shot for a ${genre} story. Scene: ${narration} Compose the primary subject in the right third of the frame, with generous open negative space across the center and left two-thirds of the composition.`;
}

export async function POST(req: Request) {
  // Shares the same per-IP bucket as api/start and api/turn — art costs
  // more per call, so it's a deliberately tighter effective budget, not an
  // oversight.
  const rateLimit = checkRateLimit(getClientIp(req));
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many requests — try again in about ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ArtRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { genre, narration } = parsed.data;

  try {
    const { dataUrl } = await generateArt({ prompt: buildArtPrompt(genre, narration) });
    return Response.json({ image: dataUrl });
  } catch (err) {
    // Never fatal — the client just shows no background on any failure here,
    // so this just logs for visibility.
    console.error("api/art failed", err);
    return Response.json({ error: "Failed to generate art" }, { status: 500 });
  }
}
