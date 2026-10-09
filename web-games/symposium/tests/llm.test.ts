import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callJsonWith, LlmError, type CompletionRequest, type CompletionResponse } from "@/lib/llm";
import { modelFor, specForSlug } from "@/lib/models";

const schema = z.object({ text: z.string() });
const prompt = { system: "sys", user: "usr" };
const fixture = { text: "fixture" };

const reply = (content: string, finish: string | null = "stop"): CompletionResponse => ({
  choices: [{ finish_reason: finish, message: { content } }],
  model: "served/model",
});

const env = {
  MODEL_TURN: "primary/model",
  MODEL_FALLBACK: "fallback/model",
  MODEL_JSON_MODE_SLUGS: "primary/model",
  MODEL_REASONING_OFF_SLUGS: "fallback/model",
};

const call = (
  complete: (r: CompletionRequest) => Promise<CompletionResponse>,
  extra: Partial<NodeJS.ProcessEnv> = {},
) => callJsonWith((req) => complete(req), { task: "turn", prompt, schema, mock: () => fixture }, { ...env, ...extra });

describe("callJsonWith", () => {
  it("returns the parsed value from the primary model", async () => {
    const complete = vi.fn(async () => reply('{"text":"hello"}'));
    await expect(call(complete)).resolves.toEqual({ text: "hello" });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("retries once on the fallback model after bad output", async () => {
    const complete = vi
      .fn<(r: CompletionRequest) => Promise<CompletionResponse>>()
      .mockResolvedValueOnce(reply("not json at all"))
      .mockResolvedValueOnce(reply('{"text":"second try"}'));
    await expect(call(complete)).resolves.toEqual({ text: "second try" });
    expect(complete.mock.calls[1][0].model).toBe("fallback/model");
  });

  it("reports bad_output when the fallback also fails", async () => {
    const complete = vi.fn(async () => reply('{"wrong":1}'));
    await expect(call(complete)).rejects.toMatchObject({ code: "bad_output" });
  });

  it("does not retry a client error and reports upstream_error", async () => {
    const complete = vi.fn(async () => {
      throw Object.assign(new Error("bad request"), { status: 400 });
    });
    await expect(call(complete)).rejects.toMatchObject({ code: "upstream_error" });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("reports rate_limited after a 429 with no fallback configured", async () => {
    const complete = vi.fn(async () => {
      throw Object.assign(new Error("slow down"), { status: 429 });
    });
    await expect(call(complete, { MODEL_FALLBACK: "" })).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("returns the mock fixture without calling a model when MOCK_AI=1", async () => {
    const complete = vi.fn(async () => reply("{}"));
    await expect(call(complete, { MOCK_AI: "1" })).resolves.toEqual(fixture);
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses every call when the kill switch is on", async () => {
    const complete = vi.fn(async () => reply("{}"));
    const err = await call(complete, { AI_DISABLED: "1" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).code).toBe("ai_disabled");
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends response_format and reasoning settings from the slug lists", async () => {
    const complete = vi.fn<(r: CompletionRequest) => Promise<CompletionResponse>>(async () => reply('{"text":"ok"}'));
    await call(complete);
    const req = complete.mock.calls[0][0];
    expect(req.response_format).toEqual({ type: "json_object" });
    expect(req.reasoning).toEqual({ effort: "low" });
  });
});

describe("model selection", () => {
  it("lets each seat use its own model for a turn", () => {
    const e = { MODEL_TURN: "shared", MODEL_SEAT_A: "seat-a", MODEL_SEAT_B: "seat-b" };
    expect(modelFor("turn", "A", e).slug).toBe("seat-a");
    expect(modelFor("turn", "B", e).slug).toBe("seat-b");
    expect(modelFor("turn", undefined, e).slug).toBe("shared");
  });

  it("uses MODEL_DEFAULT when a task has no variable of its own", () => {
    expect(modelFor("suggest", undefined, { MODEL_DEFAULT: "default" }).slug).toBe("default");
  });

  it("gives each task its plan temperature and token budget", () => {
    expect(specForSlug("x", "topic_check")).toMatchObject({ temperature: 0, maxTokens: 150 });
    expect(specForSlug("x", "turn")).toMatchObject({ temperature: 0.8, maxTokens: 450 });
  });
});

import { callJsonStreamWith } from "@/lib/llm";

describe("callJsonStreamWith", () => {
  const streamOf = (...parts: { delta?: string; finish?: string }[]) =>
    async function* () {
      for (const p of parts) yield p;
    };

  it("reports growing text and returns the parsed value", async () => {
    const seen: string[] = [];
    const out = await callJsonStreamWith(
      streamOf({ delta: '{"te' }, { delta: 'xt":"Hel' }, { delta: 'lo"}' }, { finish: "stop" }),
      async () => reply("unused"),
      { task: "turn", prompt, schema, mock: () => fixture },
      (t) => seen.push(t),
      env,
    );
    expect(out).toEqual({ text: "Hello" });
    expect(seen).toEqual(["Hel", "Hello"]);
  });

  it("falls back to a one-shot call when the stream is bad", async () => {
    const complete = vi.fn(async () => reply('{"text":"ok"}'));
    const out = await callJsonStreamWith(
      streamOf({ delta: "not json" }, { finish: "stop" }),
      complete,
      { task: "turn", prompt, schema, mock: () => fixture },
      () => {},
      env,
    );
    expect(out).toEqual({ text: "ok" });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
