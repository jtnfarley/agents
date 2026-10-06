/** zod schemas: model output shapes (checked after extraction) and API request bodies (checked on entry). */
import { z } from "zod";
import { INTERESTS, LIMITS } from "./constants";

// ---- Model output ----

const personalityOut = z.object({ trait: z.string(), how: z.string().nullish() });

const guideOut = z.object({
  name: z.string(),
  role: z.string(),
  brief: z.string(),
  personality: personalityOut,
});

const stopOut = z.object({
  name: z.string(),
  when: z.string().nullish(),
  note: z.string().nullish(),
});

export const destinationOutput = z.union([
  z.object({ error: z.literal("not_a_place") }),
  z.object({
    city: z.string(),
    tagline: z.string(),
    prompts: z.array(z.string()),
    local: guideOut,
    tourist: guideOut,
  }),
]);

export const rerollOutput = z.object({ local: personalityOut, tourist: personalityOut });

export const chatSingleOutput = z.object({
  reply: z.string(),
  stops: z.array(stopOut).nullish(),
  tip: z.string().nullish(),
});

export const debateOutput = z.object({
  turns: z
    .array(z.object({ speaker: z.string(), text: z.string(), stops: z.array(stopOut).nullish() }))
    .min(1)
    // Both guides must answer. A reply with only one of them counts as bad output and is retried.
    .refine((turns) => turns.some((t) => t.speaker === "local") && turns.some((t) => t.speaker === "tourist"), {
      message: "debate needs a turn from each guide",
    }),
  common_ground: z.string().nullish(),
});

export const tripOutput = z.object({
  title: z.string().nullish(),
  days: z
    .array(
      z.object({
        label: z.string().nullish(),
        stops: z.array(
          z.object({
            time: z.string().nullish(),
            name: z.string(),
            note: z.string().nullish(),
            from: z.string().nullish(),
          }),
        ),
      }),
    )
    .min(1),
});

// ---- API requests ----

const short = (max: number) => z.string().max(max);

const personalityRef = z.object({ name: short(LIMITS.guideName), role: short(LIMITS.role), trait: short(LIMITS.trait) });

const guideRef = z.object({
  name: short(LIMITS.guideName),
  role: short(LIMITS.role),
  brief: short(LIMITS.brief),
  personality: z.object({ trait: short(LIMITS.trait), how: short(LIMITS.how) }),
});

const destinationRef = z.object({
  city: short(LIMITS.city),
  guides: z.object({ local: guideRef, tourist: guideRef }),
});

export const historyItem = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "divider", "guide", "ground", "error"]),
  text: z.string().max(LIMITS.chatText),
  side: z.enum(["local", "tourist"]).optional(),
  stops: z.array(stopOut).max(5).optional(),
  tip: z.string().max(LIMITS.tip).optional(),
});

export const destinationRequest = z.object({ place: short(LIMITS.place) });

export const rerollRequest = z.object({
  city: short(LIMITS.city),
  local: personalityRef,
  tourist: personalityRef,
});

export const chatRequest = z.object({
  destination: destinationRef,
  target: z.enum(["local", "tourist", "both"]),
  text: z.string().min(1).max(LIMITS.question),
  history: z.array(historyItem).max(12),
});

export const tripRequest = z.object({
  destination: destinationRef,
  options: z.object({
    days: z.number().int().min(1).max(3),
    pace: z.enum(["Relaxed", "Balanced", "Packed"]),
    lean: z.enum(["split", "local", "tourist"]),
    interests: z.array(z.enum(INTERESTS as [string, ...string[]])).max(INTERESTS.length),
  }),
  history: z.array(historyItem).max(12),
  currentTrip: z
    .object({ title: short(LIMITS.tripTitle), days: z.array(z.unknown()).max(3) })
    .optional(),
  change: short(200).optional(),
});
