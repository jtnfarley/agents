/** Shared wrapper for the API routes: kill switch, rate limit, body and schema checks, error mapping. */
import type { z } from "zod";
import { errorText } from "./errors";
import { LlmError } from "./llm";
import { limiter } from "./rateLimit";
import type { ErrorCode } from "./types";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  not_a_place: 422,
  bad_output: 502,
  upstream_error: 502,
  rate_limited: 429,
  ai_disabled: 503,
};

/** Failure body from section 7: { ok: false, code, message } with a matching HTTP status. */
export function failure(code: ErrorCode): Response {
  return Response.json({ ok: false, code, message: errorText(code, "other") }, { status: STATUS[code] });
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function handleRoute<S extends z.ZodType, O extends object>(
  req: Request,
  schema: S,
  run: (input: z.output<S>) => Promise<O>,
): Promise<Response> {
  if (process.env.AI_DISABLED === "1") return failure("ai_disabled");
  if (!limiter.allow(clientKey(req))) return failure("rate_limited");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return failure("invalid_input");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return failure("invalid_input");

  try {
    const result = await run(parsed.data);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof LlmError) return failure(e.code);
    // Log the type only. Never log request text, prompts or the key.
    console.error(JSON.stringify({ event: "route_error", name: (e as Error)?.name ?? "unknown" }));
    return failure("upstream_error");
  }
}
