/**
 * The one function that calls OpenRouter (plan section 6). Uses the OpenAI Chat Completions shape.
 * Parse, validation and 5xx/429 failures get one retry on MODEL_FALLBACK.
 * Mock mode (MOCK_AI=1) returns each caller's fixture instead of calling a model.
 */
import OpenAI from "openai";
import type { ZodType } from "zod";
import { extractJson, partialText } from "./json";
import { fallbackFor, modelFor, type ModelSpec, type Task } from "./models";
import type { ErrorCode } from "./errors";

type Env = Record<string, string | undefined>;
import type { SpeakerId } from "./types";
import type { Prompt } from "./prompts";

export const LLM_TIMEOUT_MS = 40_000;

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
  /** Hidden reasoning counts against max_tokens. Off where the model allows it, otherwise low. */
  reasoning?: { effort: "low" } | { enabled: false };
}

export interface CompletionResponse {
  choices: { finish_reason: string | null; message: { content: string | null } }[];
  /** The model that actually answered. OpenRouter can route a slug, so this may differ from the request. */
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Injected so tests can run the retry logic without the network. */
export type Completer = (req: CompletionRequest, opts: { timeout: number }) => Promise<CompletionResponse>;

let client: OpenAI | null = null;

/** Built on first use so a missing key fails only when a call is made. */
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AttemptError("other", "OPENROUTER_API_KEY is not set");
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": process.env.SITE_URL ?? "http://localhost:3000",
        "X-Title": "Symposium",
      },
    });
  }
  return client;
}

/** The real completer. */
export const openRouterComplete: Completer = (req, opts) =>
  getClient().chat.completions.create(req, { timeout: opts.timeout }) as unknown as Promise<CompletionResponse>;

/** Yields content deltas and, last, the finish reason. Injected so tests can stream without the network. */
export type StreamCompleter = (
  req: CompletionRequest,
  opts: { timeout: number },
) => AsyncIterable<{ delta?: string; finish?: string | null }>;

export const openRouterStream: StreamCompleter = async function* (req, opts) {
  try {
    const stream = await getClient().chat.completions.create({ ...req, stream: true } as never, {
      timeout: opts.timeout,
    });
    for await (const chunk of stream as unknown as AsyncIterable<{
      choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
    }>) {
      const ch = chunk.choices?.[0];
      if (ch?.delta?.content) yield { delta: ch.delta.content };
      if (ch?.finish_reason) yield { finish: ch.finish_reason };
    }
  } catch (e) {
    throw classify(e);
  }
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

const REMINDER = "\n\nReply with the JSON object only. No prose before or after it.";

function buildRequest(spec: ModelSpec, prompt: Prompt, reminder: boolean): CompletionRequest {
  return {
    model: spec.slug,
    messages: [
      { role: "system", content: prompt.system + (reminder ? REMINDER : "") },
      { role: "user", content: prompt.user },
    ],
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    reasoning: spec.reasoning === "off" ? { enabled: false } : { effort: "low" },
    ...(spec.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  };
}

function validate<T>(content: string, finish: string | null | undefined, schema: ZodType<T>): T {
  if (!content || finish === "length") throw new AttemptError("parse", "empty or truncated output");
  let value: unknown;
  try {
    value = extractJson(content);
  } catch {
    throw new AttemptError("parse", "no JSON in output");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AttemptError("parse", "output failed validation");
  return parsed.data;
}

async function attempt<T>(
  complete: Completer,
  spec: ModelSpec,
  prompt: Prompt,
  schema: ZodType<T>,
  reminder: boolean,
): Promise<T> {
  let res: CompletionResponse;
  try {
    res = await complete(buildRequest(spec, prompt, reminder), { timeout: LLM_TIMEOUT_MS });
  } catch (e) {
    throw classify(e);
  }
  const choice = res.choices?.[0];
  if (!choice) throw new AttemptError("parse", "empty or truncated output");
  return validate(choice.message?.content ?? "", choice.finish_reason, schema);
}

/** Like attempt, but reports the growing "text" field as the reply arrives. */
async function attemptStream<T>(
  stream: StreamCompleter,
  spec: ModelSpec,
  prompt: Prompt,
  schema: ZodType<T>,
  reminder: boolean,
  onText: (text: string) => void,
): Promise<T> {
  let raw = "";
  let sent = "";
  let finish: string | null | undefined;
  try {
    for await (const part of stream(buildRequest(spec, prompt, reminder), { timeout: LLM_TIMEOUT_MS })) {
      if (part.finish) finish = part.finish;
      if (!part.delta) continue;
      raw += part.delta;
      const text = partialText(raw);
      if (text !== null && text !== sent) {
        sent = text;
        onText(text);
      }
    }
  } catch (e) {
    throw classify(e);
  }
  return validate(raw, finish, schema);
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
  seat?: SpeakerId;
  prompt: Prompt;
  schema: ZodType<T>;
  /** Returns the fixture for MOCK_AI=1. The caller knows the context, so it builds the fixture. */
  mock: () => T;
}

/** Calls the model for a task. Kill switch and mock mode are handled here. */
export async function callJsonWith<T>(
  complete: Completer,
  args: CallArgs<T>,
  env: Env = process.env,
): Promise<T> {
  const { task, seat, prompt, schema } = args;
  if (env.AI_DISABLED === "1") throw new LlmError("ai_disabled");

  if (env.MOCK_AI === "1") {
    const parsed = schema.safeParse(args.mock());
    if (!parsed.success) throw new LlmError("bad_output", "mock fixture failed validation");
    return parsed.data;
  }

  let primary: ModelSpec;
  try {
    primary = modelFor(task, seat, env);
  } catch (e) {
    throw new LlmError("upstream_error", (e as Error).message);
  }

  try {
    return await attempt(complete, primary, prompt, schema, false);
  } catch (e) {
    if (!(e instanceof AttemptError) || e.failure === "other") throw toLlmError(e as AttemptError);
    const fallback = fallbackFor(task, env);
    if (!fallback) throw toLlmError(e);
    try {
      return await attempt(complete, fallback, prompt, schema, true);
    } catch (e2) {
      throw toLlmError(e2 as AttemptError);
    }
  }
}

/** Production entry point. */
export function callJson<T>(args: CallArgs<T>): Promise<T> {
  return callJsonWith(openRouterComplete, args);
}

/**
 * Like callJsonWith, but streams the "text" field of the reply to onText as it arrives.
 * The primary model streams. A failed attempt falls back to one non-streamed call, as callJsonWith does.
 */
export async function callJsonStreamWith<T>(
  stream: StreamCompleter,
  complete: Completer,
  args: CallArgs<T>,
  onText: (text: string) => void,
  env: Env = process.env,
): Promise<T> {
  const { task, seat, prompt, schema } = args;
  if (env.AI_DISABLED === "1") throw new LlmError("ai_disabled");

  if (env.MOCK_AI === "1") {
    const parsed = schema.safeParse(args.mock());
    if (!parsed.success) throw new LlmError("bad_output", "mock fixture failed validation");
    const text = (parsed.data as { text?: unknown }).text;
    if (typeof text === "string") {
      // Word by word, so mock mode shows the streaming UI too.
      let sent = "";
      for (const word of text.split(/(?<=\s)/)) {
        sent += word;
        onText(sent);
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    return parsed.data;
  }

  let primary: ModelSpec;
  try {
    primary = modelFor(task, seat, env);
  } catch (e) {
    throw new LlmError("upstream_error", (e as Error).message);
  }

  try {
    return await attemptStream(stream, primary, prompt, schema, false, onText);
  } catch (e) {
    if (!(e instanceof AttemptError) || e.failure === "other") throw toLlmError(e as AttemptError);
    const fallback = fallbackFor(task, env);
    if (!fallback) throw toLlmError(e);
    try {
      return await attempt(complete, fallback, prompt, schema, true);
    } catch (e2) {
      throw toLlmError(e2 as AttemptError);
    }
  }
}

export function callJsonStream<T>(args: CallArgs<T>, onText: (text: string) => void): Promise<T> {
  return callJsonStreamWith(openRouterStream, openRouterComplete, args, onText);
}
