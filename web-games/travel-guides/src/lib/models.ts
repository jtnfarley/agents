/**
 * Model registry. Slugs come from env only, never from client input.
 * Each task reads its own variable and falls back to MODEL_DEFAULT.
 */
import type { Side } from "./types";

export type Task = "destination" | "reroll" | "chat" | "debate" | "trip";

export interface ModelSpec {
  slug: string;
  jsonMode: boolean;
  temperature: number;
  maxTokens: number;
}

const TASK_ENV: Record<Task, string> = {
  destination: "MODEL_DESTINATION",
  reroll: "MODEL_REROLL",
  chat: "MODEL_CHAT",
  debate: "MODEL_DEBATE",
  trip: "MODEL_TRIP",
};

/** Temperature and max_tokens per task, from section 5. */
const TASK_PARAMS: Record<Task, { temperature: number; maxTokens: number }> = {
  destination: { temperature: 0.9, maxTokens: 1200 },
  reroll: { temperature: 1.0, maxTokens: 400 },
  chat: { temperature: 0.8, maxTokens: 700 },
  debate: { temperature: 0.9, maxTokens: 1400 },
  trip: { temperature: 0.6, maxTokens: 1800 },
};

export class ModelConfigError extends Error {}

function jsonModeSlugs(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    (env.MODEL_JSON_MODE_SLUGS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function specFor(slug: string, task: Task, env: NodeJS.ProcessEnv): ModelSpec {
  return {
    slug,
    // Only send response_format to slugs the user has listed as supporting it.
    jsonMode: jsonModeSlugs(env).has(slug),
    ...TASK_PARAMS[task],
  };
}

/** The model for a task. For chat, a side can override with MODEL_GUIDE_LOCAL or MODEL_GUIDE_TOURIST. */
export function modelFor(task: Task, side?: Side, env: NodeJS.ProcessEnv = process.env): ModelSpec {
  let slug: string | undefined;
  if (task === "chat" && side) {
    slug = side === "local" ? env.MODEL_GUIDE_LOCAL : env.MODEL_GUIDE_TOURIST;
  }
  slug = slug || env[TASK_ENV[task]] || env.MODEL_DEFAULT;
  if (!slug) throw new ModelConfigError(`No model configured for ${task}. Set ${TASK_ENV[task]} or MODEL_DEFAULT.`);
  return specFor(slug, task, env);
}

/** The retry model for a task, or null when MODEL_FALLBACK is unset. */
export function fallbackFor(task: Task, env: NodeJS.ProcessEnv = process.env): ModelSpec | null {
  return env.MODEL_FALLBACK ? specFor(env.MODEL_FALLBACK, task, env) : null;
}

/** Every slug the app reads from env, for scripts/check-models.ts. */
export function configuredSlugs(env: NodeJS.ProcessEnv = process.env): string[] {
  const keys = [...Object.values(TASK_ENV), "MODEL_DEFAULT", "MODEL_GUIDE_LOCAL", "MODEL_GUIDE_TOURIST", "MODEL_FALLBACK"];
  return [...new Set(keys.map((k) => env[k]).filter((v): v is string => Boolean(v)))];
}
