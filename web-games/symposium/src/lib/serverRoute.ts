/** Shared wrapper for the API routes: kill switch, rate limit, body and schema checks, error mapping. */
import type { z } from "zod";
import { ApiError, errorText, type ErrorCode } from "./errors";
import { LlmError } from "./llm";
import { limiter } from "./rateLimit";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  off_topic: 422,
  bad_output: 502,
  upstream_error: 502,
  rate_limited: 429,
  ai_disabled: 503,
};

/** Failure body: { ok: false, code, message } with a matching HTTP status. */
export function failure(code: ErrorCode): Response {
  return Response.json({ ok: false, code, message: errorText(code) }, { status: STATUS[code] });
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

async function respond<O extends object>(req: Request, work: () => Promise<O>): Promise<Response> {
  if (process.env.AI_DISABLED === "1") return failure("ai_disabled");
  if (!limiter.allow(clientKey(req))) return failure("rate_limited");
  try {
    return Response.json({ ok: true, ...(await work()) });
  } catch (e) {
    if (e instanceof LlmError || e instanceof ApiError) {
      // Our own messages only: upstream status, timeouts, missing config. Never request text or the key.
      console.error(JSON.stringify({ event: "route_error", code: e.code, message: e.message }));
      return failure(e.code);
    }
    // Log the error type only for anything unexpected.
    console.error(JSON.stringify({ event: "route_error", name: (e as Error)?.name ?? "unknown" }));
    return failure("upstream_error");
  }
}

/** A POST route with a JSON body that must match the schema. */
export function handleRoute<S extends z.ZodType, O extends object>(
  req: Request,
  schema: S,
  run: (input: z.output<S>) => Promise<O>,
): Promise<Response> {
  return respond(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError("invalid_input", "body is not JSON");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError("invalid_input", "body failed validation");
    return run(parsed.data);
  });
}

/** A GET route with no body. */
export function handleGet<O extends object>(req: Request, run: () => Promise<O>): Promise<Response> {
  return respond(req, run);
}

function logRouteError(e: unknown): ErrorCode {
  if (e instanceof LlmError || e instanceof ApiError) {
    console.error(JSON.stringify({ event: "route_error", code: e.code, message: e.message }));
    return e.code;
  }
  console.error(JSON.stringify({ event: "route_error", name: (e as Error)?.name ?? "unknown" }));
  return "upstream_error";
}

/**
 * A POST route that streams newline-delimited JSON events. Checks that can fail up front return the
 * usual failure response. Once streaming starts, a failure arrives as a final { type: "error" } event.
 * The last event of a good run is { type: "done", ...result }.
 */
export async function handleStream<S extends z.ZodType, O extends object>(
  req: Request,
  schema: S,
  run: (input: z.output<S>, emit: (event: { type: string } & Record<string, unknown>) => void) => Promise<O>,
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

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(enc.encode(JSON.stringify(event) + "\n"));
      try {
        emit({ type: "done", ...(await run(parsed.data, emit)) });
      } catch (e) {
        const code = logRouteError(e);
        emit({ type: "error", code, message: errorText(code) });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
