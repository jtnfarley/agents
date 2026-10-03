// Single place the narration/risk-assessment/art models are configured.
// Swapping providers means editing this file, not the API routes that call
// it.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateImage, generateObject } from "ai";
import type { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Primary rotation: cheap models confirmed (via OpenRouter's catalog) to
// support structured_outputs, from labs with a solid track record on JSON
// reliability specifically — chosen after the initial free-tier rotation
// turned out mostly unusable (upstream congestion, and some models not
// reliably honoring structured output at all despite returning 200s).
const MODEL_IDS = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini",
  "mistralai/mistral-small-24b-instruct-2501",
] as const;

// Last-resort fallback if every primary model fails. Costs more than the
// primary rotation, but we've already proven Anthropic models work
// flawlessly with generateObject in this app (the original narration
// integration, before this OpenRouter migration), so it's the reliability
// backstop rather than part of the cost-optimized rotation.
const FALLBACK_MODEL_ID = "anthropic/claude-haiku-4.5";

// A model that hasn't responded in this long is treated as failed and the
// call moves to the next model in rotation, same as any other failure.
const TIMEOUT_MS = 10_000;

let rotationIndex = 0;

/** Next model id in rotation, round-robin. */
function nextModelId(): string {
  const id = MODEL_IDS[rotationIndex % MODEL_IDS.length];
  rotationIndex += 1;
  return id;
}

async function tryGenerate<Schema extends z.ZodTypeAny>(
  modelId: string,
  params: { schema: Schema; system: string; prompt: string },
  label: string
): Promise<z.infer<Schema>> {
  const start = Date.now();
  console.log(`[llm] ${label}: calling ${modelId}`);
  try {
    const { object } = await generateObject({
      model: openrouter(modelId),
      schema: params.schema,
      system: params.system,
      prompt: params.prompt,
      // Our rotation/fallback loop is the retry strategy — the SDK's own
      // default retries (3 attempts with backoff) would otherwise stack on
      // top of it, turning one flaky model into a minutes-long stall before
      // ever reaching the next one.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    console.log(`[llm] ${label}: ${modelId} responded in ${Date.now() - start}ms`);
    return object as z.infer<Schema>;
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    if (timedOut) {
      throw new Error(`timed out after ${TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

/**
 * Structured-output call with automatic fallback: tries each model in the
 * primary rotation once (round-robin order), and if all of them fail, makes
 * one last attempt against FALLBACK_MODEL_ID before giving up. Models are
 * prone to two failure modes a single attempt can't tell apart in advance —
 * transient upstream rate-limiting/capacity errors, and models that return
 * a 200 but don't reliably honor structured JSON output — and moving to the
 * next model is the fix for both.
 *
 * `label` identifies the call site (e.g. "start", "risk-assessment",
 * "narration") in the console log, so which model produced which response
 * is traceable while evaluating output quality.
 */
export async function generateWithRotation<Schema extends z.ZodTypeAny>(params: {
  schema: Schema;
  system: string;
  prompt: string;
  label: string;
}): Promise<z.infer<Schema>> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MODEL_IDS.length; attempt++) {
    const modelId = nextModelId();
    try {
      return await tryGenerate(modelId, params, params.label);
    } catch (err) {
      lastError = err;
      console.error(
        `[llm] ${params.label}: ${modelId} failed (attempt ${attempt + 1}/${MODEL_IDS.length})`,
        err instanceof Error ? err.message : err
      );
    }
  }

  try {
    return await tryGenerate(FALLBACK_MODEL_ID, params, params.label);
  } catch (err) {
    console.error(`[llm] ${params.label}: fallback ${FALLBACK_MODEL_ID} also failed`, err instanceof Error ? err.message : err);
    throw err ?? lastError;
  }
}

// Phase 6 — Nano Banana 2 Lite: cheapest OpenRouter image model available,
// chosen over full Nano Banana 2 for cost given this generates just one
// ambient background image per story. No rotation/fallback here (unlike the
// narration models above) — a single deliberately-chosen model, since art
// failures degrade gracefully (the caller just shows no background) rather
// than needing a retry-with-a-different-model strategy.
const ART_MODEL_ID = "google/gemini-3.1-flash-lite-image";
const ART_TIMEOUT_MS = 25_000;

/** Generates a 16:9 background image via OpenRouter's unified Image API. Returns a data URL — there's no server storage. */
export async function generateArt(params: { prompt: string }): Promise<{ dataUrl: string }> {
  const { image } = await generateImage({
    model: openrouter.imageModel(ART_MODEL_ID),
    prompt: params.prompt,
    aspectRatio: "16:9",
    abortSignal: AbortSignal.timeout(ART_TIMEOUT_MS),
  });
  return { dataUrl: `data:${image.mediaType};base64,${image.base64}` };
}
