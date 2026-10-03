import { LLM_CALL_TIMEOUT_MS } from "./llmTimeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Narrow request/response shapes for OpenRouter's OpenAI-compatible chat
// completions endpoint — just the fields any caller here actually uses.
export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterChatParams {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  tools?: OpenRouterTool[];
  tool_choice?: { type: "function"; function: { name: string } };
}

interface OpenRouterToolCall {
  function: { name: string; arguments: string };
}

export interface OpenRouterChatResponse {
  choices: {
    message: {
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
  }[];
}

export type CreateChatCompletion = (params: OpenRouterChatParams) => Promise<OpenRouterChatResponse>;

// Thrown instead of a plain Error when a request fails for a
// capacity/availability reason (rate limit, upstream worker exhaustion,
// transient 5xx) rather than a malformed request or bad model output.
// Callers use this to decide when it's worth swapping to a different model
// from the free pool and putting the failing model on cooldown — see
// ./modelCooldown.ts.
export class OpenRouterCapacityError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "OpenRouterCapacityError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isCapacityError(err: unknown): err is OpenRouterCapacityError {
  return err instanceof OpenRouterCapacityError;
}

// HTTP/error codes that indicate the provider is temporarily overloaded or
// unavailable, as opposed to the request itself being malformed. 404 covers
// a `:free` model OpenRouter has retired ("This model is unavailable for
// free") — swapping to another pool model beats dropping to the stub.
const CAPACITY_CODES = new Set([404, 429, 500, 502, 503]);

// OpenRouter sometimes includes a provider-reported retry hint at
// error.metadata.retry_after_seconds; best-effort extraction, undefined if
// absent or the shape doesn't match.
function extractRetryAfterSeconds(raw: unknown): number | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const error = (raw as { error?: { metadata?: { retry_after_seconds?: unknown } } }).error;
  const value = error?.metadata?.retry_after_seconds;
  return typeof value === "number" ? value : undefined;
}

// Shared fetch-based transport for every OpenRouter-routed call (persona
// turns, celebrations, memory writes). `errorLabel` identifies the calling
// module in thrown error messages so failures are traceable to their call
// site. Applies LLM_CALL_TIMEOUT_MS via AbortSignal.timeout.
export function defaultCreateChatCompletion(errorLabel: string): CreateChatCompletion {
  return async (params) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(`${errorLabel}: OPENROUTER_API_KEY is not set`);
    }
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "llm-poker",
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(LLM_CALL_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = await response.text();
      const message = `${errorLabel}: OpenRouter request failed (${response.status}): ${text}`;
      if (CAPACITY_CODES.has(response.status)) {
        let retryAfterSeconds: number | undefined;
        try {
          retryAfterSeconds = extractRetryAfterSeconds(JSON.parse(text));
        } catch {
          // best-effort only — fall through with no retry hint
        }
        throw new OpenRouterCapacityError(message, retryAfterSeconds);
      }
      throw new Error(message);
    }
    const body = (await response.json()) as OpenRouterChatResponse & {
      error?: { message?: string; code?: unknown; metadata?: { retry_after_seconds?: unknown } };
    };
    // OpenRouter sometimes reports provider-side failures (rate limits,
    // moderation, upstream errors) as a 200 response with an `error` body
    // instead of a non-2xx status, so `response.ok` alone can't be trusted.
    if (body.error || !Array.isArray(body.choices)) {
      const message =
        `${errorLabel}: OpenRouter returned no choices` +
        (body.error ? ` (${body.error.code ?? "error"}: ${body.error.message ?? "unknown error"})` : "");
      const code = body.error?.code;
      if (typeof code === "number" && CAPACITY_CODES.has(code)) {
        throw new OpenRouterCapacityError(message, extractRetryAfterSeconds({ error: body.error }));
      }
      throw new Error(message);
    }
    return body;
  };
}

// Free OpenRouter models vary in how reliably they honor tool_choice, so
// prompted-JSON fallbacks can't assume markdown-free output — this strips
// ```json fences and grabs the first balanced {...} block.
export function extractJsonObject(errorLabel: string, text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${errorLabel}: no JSON object found in fallback response`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
