// Applied to every outbound LLM call — Claude via the SDK's per-request
// `timeout` option (claude.ts, celebrationClaude.ts), OpenRouter via
// AbortSignal.timeout on fetch (openrouter.ts, celebrationOpenRouter.ts) —
// so a slow provider can't stall a persona's turn indefinitely.
export const LLM_CALL_TIMEOUT_MS = 15_000;

// AbortSignal.timeout() rejects fetch with a DOMException named
// "TimeoutError". Used by the OpenRouter callers to decide whether a failure
// is worth retrying against a different model rather than just failing.
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}
