/**
 * The only place the UI talks to the API routes. Requests go to /api/* with fetch.
 * Mock output comes from the server when MOCK_AI=1, so the browser needs no mock of its own.
 */
import { ApiError, type ErrorCode } from "./errors";
import type { Debate, Move, Pair, Speaker, SpeakerId, Target, Turn } from "./types";

/** Slightly longer than the server's 40 second model timeout, so the server's error arrives first. */
const CLIENT_TIMEOUT_MS = 45_000;

type Ok<T> = { ok: true } & T;

async function call<T extends object>(path: string, init: { method: "GET" } | { method: "POST"; body: unknown }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method,
      headers: init.method === "POST" ? { "content-type": "application/json" } : undefined,
      body: init.method === "POST" ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    throw new ApiError("upstream_error", timedOut ? "timeout" : "network error");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // A non-JSON body means a framework error page or a proxy failure.
    throw new ApiError("upstream_error", `HTTP ${res.status} without a JSON body`);
  }
  const data = body as { ok?: boolean; code?: ErrorCode; message?: string } | null;
  if (!data || typeof data !== "object") throw new ApiError("upstream_error", "empty response");
  if (!data.ok) throw new ApiError(data.code ?? "upstream_error", data.message ?? "request failed");
  return data as Ok<T>;
}

/** What the server sends before the first word of a streamed turn. */
export interface TurnStart {
  speaker: SpeakerId;
  move: Move;
  target: Speaker;
  visitor: { text: string; target: Target } | null;
}

/**
 * Streams one turn. onStart fires when the speaker is known, onText with the whole text so far.
 * Resolves with the finished turns. The timeout is per gap between chunks, not for the whole turn.
 */
async function turnStream(
  input: { debate: Debate; userText?: string; target?: Target },
  on: { onStart(s: TurnStart): void; onText(text: string): void },
): Promise<{ turns: Turn[] }> {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  const rearm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  };
  try {
    let res: Response;
    try {
      res = await fetch("/api/debate/turn-stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      throw new ApiError("upstream_error", "network error");
    }
    if (!res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
      // Up-front failures (rate limit, kill switch, bad input) are the ordinary JSON failure body.
      const data = (await res.json().catch(() => null)) as { code?: ErrorCode; message?: string } | null;
      throw new ApiError(data?.code ?? "upstream_error", data?.message ?? `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let result: { turns: Turn[] } | null = null;
    const handle = (line: string) => {
      if (!line.trim()) return;
      const ev = JSON.parse(line) as { type: string } & Record<string, unknown>;
      if (ev.type === "start") on.onStart(ev as unknown as TurnStart);
      else if (ev.type === "text") on.onText(ev.text as string);
      else if (ev.type === "done") result = { turns: ev.turns as Turn[] };
      else if (ev.type === "error") throw new ApiError((ev.code as ErrorCode) ?? "upstream_error", String(ev.message ?? "request failed"));
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        rearm();
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buf);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("upstream_error", e instanceof Error && e.name === "AbortError" ? "timeout" : "stream error");
    }
    if (!result) throw new ApiError("upstream_error", "stream ended early");
    return result;
  } finally {
    clearTimeout(timer);
  }
}

const post = <T extends object>(path: string, body: unknown) => call<T>(path, { method: "POST", body });

export interface StartResult {
  topic: string;
  a: string;
  b: string;
}

export const api = {
  start: (input: { topic: string; previousPair?: Pair }) => post<StartResult>("/api/debate/start", input),

  reshuffle: (input: { topic: string; currentPair: Pair; turnCount: number }) =>
    post<{ a: string; b: string }>("/api/debate/reshuffle", input),

  turn: (input: { debate: Debate; userText?: string; target?: Target }) =>
    post<{ turns: Turn[] }>("/api/debate/turn", input),

  turnStream,

  summarize: (input: { debate: Debate }) =>
    post<{ rollingSummary: string; ledger: NonNullable<Debate["ledger"]> }>("/api/debate/summarize", input),

  suggestions: () => call<{ suggestions: string[] }>("/api/suggestions", { method: "GET" }),
};
