/**
 * Model registry. Slugs come from env only, never from client input.
 * Each task reads its own variable and falls back to MODEL_DEFAULT.
 * A turn can be seated on its own model with MODEL_SEAT_A or MODEL_SEAT_B (plan section 6).
 */
import type { SpeakerId } from "./types";

type Env = Record<string, string | undefined>;

export type Task = "turn" | "summary" | "topic_check" | "suggest";

export interface ModelSpec {
  slug: string;
  jsonMode: boolean;
  /** "off" turns hidden reasoning off, for models that allow it. "low" asks for little. */
  reasoning: "off" | "low";
  temperature: number;
  maxTokens: number;
}

const TASK_ENV: Record<Task, string> = {
  turn: "MODEL_TURN",
  summary: "MODEL_SUMMARY",
  topic_check: "MODEL_TOPIC_CHECK",
  suggest: "MODEL_SUGGEST",
};

/** Temperature and max_tokens per task (plan section 6). */
const TASK_PARAMS: Record<Task, { temperature: number; maxTokens: number }> = {
  turn: { temperature: 0.8, maxTokens: 450 },
  summary: { temperature: 0.3, maxTokens: 600 },
  topic_check: { temperature: 0.0, maxTokens: 150 },
  suggest: { temperature: 1.0, maxTokens: 300 },
};

export class ModelConfigError extends Error {}

const slugList = (value: string | undefined): Set<string> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

export function specForSlug(slug: string, task: Task, env: Env = process.env): ModelSpec {
  return {
    slug,
    // Only send response_format to slugs the operator has listed as supporting it.
    jsonMode: slugList(env.MODEL_JSON_MODE_SLUGS).has(slug),
    reasoning: slugList(env.MODEL_REASONING_OFF_SLUGS).has(slug) ? "off" : "low",
    ...TASK_PARAMS[task],
  };
}

/** The model for a task. For a turn, a seat can override with MODEL_SEAT_A or MODEL_SEAT_B. */
export function modelFor(task: Task, seat?: SpeakerId, env: Env = process.env): ModelSpec {
  let slug: string | undefined;
  if (task === "turn" && seat) slug = seat === "A" ? env.MODEL_SEAT_A : env.MODEL_SEAT_B;
  slug = slug || env[TASK_ENV[task]] || env.MODEL_DEFAULT;
  if (!slug) throw new ModelConfigError(`No model configured for ${task}. Set ${TASK_ENV[task]} or MODEL_DEFAULT.`);
  return specForSlug(slug, task, env);
}

/** The retry model for a task, or null when MODEL_FALLBACK is unset. */
export function fallbackFor(task: Task, env: Env = process.env): ModelSpec | null {
  return env.MODEL_FALLBACK ? specForSlug(env.MODEL_FALLBACK, task, env) : null;
}

/** Every slug the app reads from env, for scripts/check-models.ts. */
export function configuredSlugs(env: Env = process.env): string[] {
  const keys = [...Object.values(TASK_ENV), "MODEL_DEFAULT", "MODEL_SEAT_A", "MODEL_SEAT_B", "MODEL_FALLBACK"];
  return [...new Set(keys.map((k) => env[k]).filter((v): v is string => Boolean(v)))];
}
