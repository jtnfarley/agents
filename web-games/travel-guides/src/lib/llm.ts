/**
 * The one function that calls OpenRouter. It uses the OpenAI Chat Completions shape.
 * Parse, validation and 5xx/429 failures get one retry on MODEL_FALLBACK.
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import { extractJson } from "./json";
import { fallbackFor, modelFor, type ModelSpec, type Task } from "./models";
import { mockOutput } from "./modelFixtures";
import type { ErrorCode, Side } from "./types";
import type { Prompt } from "./prompts";
import { LLM_TIMEOUT_MS } from "./constants";

export class LlmError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = "LlmError";
    this.code = code;
  }
}

/** Reasons an attempt failed. Only some reasons are retried. */
type Failure = "parse" | "server" | "rate_limit" | "other";

class AttemptError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure, message: string) {
    super(message);
    this.failure = failure;
  }
}

export interface CompletionRequest {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  temperature: number;
  max_tokens: number;
  response_format?: { type: "json_object" };
}

export interface CompletionResponse {
  choices: { finish_reason: string | null; message: { content: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Injected so tests can run the retry logic without the network. */
export type Completer = (req: CompletionRequest, opts: { timeout: number }) => Promise<CompletionResponse>;

let client: OpenAI | null = null;

/** The real completer. Built on first use so a missing key fails only when a call is made. */
export const openRouterComplete: Completer = (req, opts) => {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AttemptError("other", "OPENROUTER_API_KEY is not set");
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": process.env.SITE_URL ?? "http://localhost:3000",
        "X-Title": "Local Voices",
      },
    });
  }
  return client.chat.completions.create(req, { timeout: opts.timeout }) as unknown as Promise<CompletionResponse>;
};

function classify(e: unknown): AttemptError {
  if (e instanceof AttemptError) return e;
  const status = (e as { status?: unknown })?.status;
  const name = (e as { name?: unknown })?.name;
  if (name === "APIConnectionTimeoutError") return new AttemptError("other", "timeout");
  if (typeof status === "number") {
    if (status === 429) return new AttemptError("rate_limit", `upstream ${status}`);
    if (status >= 500) return new AttemptError("server", `upstream ${status}`);
    return new AttemptError("other", `upstream ${status}`);
  }
  return new AttemptError("other", "network error");
}

function logCall(task: Task, spec: ModelSpec, started: number, usage?: CompletionResponse["usage"], outcome = "ok") {
  // Model, task, latency and token counts only. No prompt text and no key.
  console.info(
    JSON.stringify({
      event: "llm_call",
      task,
      model: spec.slug,
      outcome,
      latency_ms: Date.now() - started,
      tokens: usage ?? null,
    }),
  );
}

const REMINDER = "\n\nReply with the JSON object only. No prose before or after it.";

async function attempt<T>(
  complete: Completer,
  task: Task,
  spec: ModelSpec,
  prompt: Prompt,
  schema: ZodType<T>,
  reminder: boolean,
): Promise<T> {
  const started = Date.now();
  const req: CompletionRequest = {
    model: spec.slug,
    messages: [
      { role: "system", content: prompt.system + (reminder ? REMINDER : "") },
      { role: "user", content: prompt.user },
    ],
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    ...(spec.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  };

  let res: CompletionResponse;
  try {
    res = await complete(req, { timeout: LLM_TIMEOUT_MS });
  } catch (e) {
    const err = classify(e);
    logCall(task, spec, started, undefined, err.failure);
    throw err;
  }
  const choice = res.choices?.[0];
  if (!choice || choice.finish_reason === "length") {
    logCall(task, spec, started, res.usage, "parse");
    throw new AttemptError("parse", "empty or truncated output");
  }
  let value: unknown;
  try {
    value = extractJson(choice.message?.content ?? "");
  } catch {
    logCall(task, spec, started, res.usage, "parse");
    throw new AttemptError("parse", "no JSON in output");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    // Paths and messages only. The values themselves stay out of the log.
    const paths = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).slice(0, 5);
    logCall(task, spec, started, res.usage, `validation: ${paths.join("; ")}`);
    throw new AttemptError("parse", "output failed validation");
  }
  logCall(task, spec, started, res.usage);
  return parsed.data;
}

function toLlmError(err: AttemptError): LlmError {
  switch (err.failure) {
    case "parse":
      return new LlmError("bad_output", err.message);
    case "rate_limit":
      return new LlmError("rate_limited", err.message);
    default:
      return new LlmError("upstream_error", err.message);
  }
}

export interface CallArgs<T> {
  task: Task;
  side?: Side;
  prompt: Prompt;
  schema: ZodType<T>;
}

/** Calls the model for a task. Mock mode and the kill switch are handled here. */
export async function callJsonWith<T>(
  complete: Completer,
  args: CallArgs<T>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const { task, side, prompt, schema } = args;
  if (env.AI_DISABLED === "1") throw new LlmError("ai_disabled");

  if (env.MOCK_AI === "1") {
    const parsed = schema.safeParse(mockOutput(task, prompt.user, side));
    if (!parsed.success) throw new LlmError("bad_output", "mock fixture failed validation");
    return parsed.data;
  }

  let primary: ModelSpec;
  try {
    primary = modelFor(task, side, env);
  } catch (e) {
    throw new LlmError("upstream_error", (e as Error).message);
  }

  try {
    return await attempt(complete, task, primary, prompt, schema, false);
  } catch (e) {
    if (!(e instanceof AttemptError) || e.failure === "other") throw toLlmError(e as AttemptError);
    const fallback = fallbackFor(task, env);
    if (!fallback) throw toLlmError(e);
    try {
      return await attempt(complete, task, fallback, prompt, schema, true);
    } catch (e2) {
      throw toLlmError(e2 as AttemptError);
    }
  }
}

/** Production entry point. */
export function callJson<T>(args: CallArgs<T>): Promise<T> {
  return callJsonWith(openRouterComplete, args);
}
