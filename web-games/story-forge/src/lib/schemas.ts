import { z } from "zod";

export const GameStateSchema = z.object({
  genre: z.string(),
  protagonist: z.object({
    name: z.string(),
    descriptor: z.string(),
    gender: z.enum(["woman", "man", "nonbinary", "unspecified"]),
  }),
  establishedFacts: z.array(z.string()),
  openThreads: z.array(z.string()),
  currentDecisionPoint: z.string(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const RiskAssessmentSchema = z.object({
  risky: z.boolean(),
  // `.nullable()` rather than `.optional()`: OpenAI's strict structured-
  // output mode requires every schema property to appear in `required` —
  // optional properties are rejected outright, but nullable ones work fine
  // everywhere (OpenAI, Gemini, DeepSeek, Anthropic).
  dc: z.number().min(8).max(20).nullable(),
  reasoning: z.string().nullable(),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const TurnResponseSchema = z.object({
  narration: z.string(),
  choices: z.array(z.object({ id: z.string(), text: z.string() })).length(2),
  updatedState: GameStateSchema,
  roll: z
    .object({
      dc: z.number(),
      result: z.number(),
      outcomeTier: z.enum([
        "critFail",
        "fail",
        "successComplication",
        "cleanSuccess",
        "critSuccess",
      ]),
    })
    .optional(),
  endingOffered: z.boolean(),
  ended: z.boolean(),
  // `.nullable()`, not `.optional()` — see RiskAssessmentSchema comment.
  epilogue: z.string().nullable(),
  // Set only on a forceEnd turn — the server-rolled tone dial for the
  // epilogue (see gameRules.resolveEndingRoll). Same reasoning as `roll`:
  // the model narrates to this tier but never invents the number itself.
  endingRoll: z
    .object({
      result: z.number(),
      tier: z.enum(["triumphant", "hopeful", "bittersweet", "grim", "tragic"]),
    })
    .optional(),
});
export type TurnResponse = z.infer<typeof TurnResponseSchema>;

// What the narration LLM call itself is asked to produce. `roll` is
// deliberately excluded — the server computes it in plain code and splices
// it into the final TurnResponse, so the model narrates an outcome it's
// told about but never gets to invent the number for.
export const NarrationOutputSchema = TurnResponseSchema.omit({
  roll: true,
  endingRoll: true,
});
export type NarrationOutput = z.infer<typeof NarrationOutputSchema>;

// What the client sends api/art, once per story, to generate the single
// ambient background image for the session.
export const ArtRequestSchema = z.object({
  genre: z.string().min(1).max(80),
  narration: z.string().min(1).max(4000),
});
export type ArtRequest = z.infer<typeof ArtRequestSchema>;
