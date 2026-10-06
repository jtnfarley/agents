import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callJsonWith, LlmError, type CompletionRequest, type CompletionResponse } from "@/lib/llm";

const schema = z.object({ reply: z.string() });
const prompt = { system: "sys", user: "usr" };
const ok = (content: string, finish = "stop"): CompletionResponse => ({
  choices: [{ finish_reason: finish, message: { content } }],
  usage: { total_tokens: 10 },
});

const env = {
  MODEL_DEFAULT: "primary/model",
  MODEL_FALLBACK: "fallback/model",
  MODEL_JSON_MODE_SLUGS: "primary/model",
} as unknown as NodeJS.ProcessEnv;

function fake(...replies: (CompletionResponse | Error)[]) {
  const calls: CompletionRequest[] = [];
  const complete = vi.fn(async (req: CompletionRequest) => {
    calls.push(req);
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next ?? ok("{}");
  });
  return { complete, calls };
}

const call = (complete: ReturnType<typeof fake>["complete"], e: NodeJS.ProcessEnv = env) =>
  callJsonWith(complete, { task: "chat", side: "local", prompt, schema }, e);

describe("callJsonWith", () => {
  it("returns validated JSON from the primary model in one call", async () => {
    const { complete, calls } = fake(ok('{"reply":"hi"}'));
    await expect(call(complete)).resolves.toEqual({ reply: "hi" });
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("primary/model");
  });

  it("sends response_format only to slugs listed in MODEL_JSON_MODE_SLUGS", async () => {
    const { complete, calls } = fake(ok('{"reply":"hi"}'));
    await call(complete, { ...env, MODEL_JSON_MODE_SLUGS: "" } as unknown as NodeJS.ProcessEnv);
    expect(calls[0].response_format).toBeUndefined();
  });

  it("accepts JSON wrapped in fences or prose", async () => {
    const { complete } = fake(ok('Here you go:\n```json\n{"reply":"hi"}\n```'));
    await expect(call(complete)).resolves.toEqual({ reply: "hi" });
  });

  it("retries once on the fallback after bad output, with the JSON-only reminder", async () => {
    const { complete, calls } = fake(ok("not json"), ok('{"reply":"second"}'));
    await expect(call(complete)).resolves.toEqual({ reply: "second" });
    expect(calls).toHaveLength(2);
    expect(calls[1].model).toBe("fallback/model");
    expect(calls[1].messages[0].content).toContain("JSON object only");
    expect(calls[0].messages[0].content).not.toContain("JSON object only");
  });

  it("retries on upstream 503 and 429", async () => {
    const serverDown = Object.assign(new Error("down"), { status: 503 });
    const { complete, calls } = fake(serverDown, ok('{"reply":"ok"}'));
    await expect(call(complete)).resolves.toEqual({ reply: "ok" });
    expect(calls[1].model).toBe("fallback/model");
  });

  it("maps a truncated reply (finish_reason length) to bad_output after the retry", async () => {
    const { complete } = fake(ok('{"reply":"cut', "length"), ok("still nothing"));
    await expect(call(complete)).rejects.toMatchObject({ code: "bad_output" });
  });

  it("does not retry a 401 and reports upstream_error", async () => {
    const { complete, calls } = fake(Object.assign(new Error("auth"), { status: 401 }));
    await expect(call(complete)).rejects.toMatchObject({ code: "upstream_error" });
    expect(calls).toHaveLength(1);
  });

  it("reports rate_limited when the retry is also rate limited", async () => {
    const limited = () => Object.assign(new Error("slow"), { status: 429 });
    const { complete } = fake(limited(), limited());
    await expect(call(complete)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("reports bad_output without a retry when MODEL_FALLBACK is unset", async () => {
    const { complete, calls } = fake(ok("nope"));
    await expect(call(complete, { MODEL_DEFAULT: "primary/model" } as unknown as NodeJS.ProcessEnv)).rejects.toMatchObject({
      code: "bad_output",
    });
    expect(calls).toHaveLength(1);
  });

  it("refuses to call anything when AI_DISABLED=1", async () => {
    const { complete, calls } = fake();
    const err = await call(complete, { ...env, AI_DISABLED: "1" } as unknown as NodeJS.ProcessEnv).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.code).toBe("ai_disabled");
    expect(calls).toHaveLength(0);
  });

  it("returns fixtures without calling the network in MOCK_AI mode", async () => {
    const { complete, calls } = fake();
    const out = await callJsonWith(
      complete,
      {
        task: "chat",
        side: "local",
        prompt,
        schema: z.object({ reply: z.string(), stops: z.array(z.unknown()) }),
      },
      { ...env, MOCK_AI: "1" } as unknown as NodeJS.ProcessEnv,
    );
    expect(typeof out.reply).toBe("string");
    expect(calls).toHaveLength(0);
  });
});
