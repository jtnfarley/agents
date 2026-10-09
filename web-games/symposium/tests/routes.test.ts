import { describe, expect, it } from "vitest";
import { POST as start } from "@/app/api/debate/start/route";
import { POST as turn } from "@/app/api/debate/turn/route";
import { turnRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

let n = 0;
const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    // A new client key per request, so the rate limiter never affects these tests.
    headers: { "content-type": "application/json", "x-forwarded-for": `test-${n++}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const emptyDebate = {
  id: "d",
  topic: "t",
  philosophers: { A: "socrates", B: "kant" },
  stances: { A: null, B: null },
  turns: [],
  rollingSummary: "",
  ledger: null,
};

describe("API routes", () => {
  it("rejects a body that is not JSON with invalid_input", async () => {
    const res = await start(post("/api/debate/start", "{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("rejects an unknown philosopher id", async () => {
    const res = await turn(
      post("/api/debate/turn", { debate: { ...emptyDebate, philosophers: { A: "nobody", B: "kant" } } }),
    );
    expect(res.status).toBe(400);
  });

  it("answers a valid start request in mock mode", async () => {
    process.env.MOCK_AI = "1";
    try {
      const res = await start(post("/api/debate/start", { topic: "Does a good life need meaning?" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, topic: "Does a good life need meaning?" });
      expect(body.a).not.toBe(body.b);
    } finally {
      delete process.env.MOCK_AI;
    }
  });

  it("returns 503 ai_disabled when the kill switch is on", async () => {
    process.env.AI_DISABLED = "1";
    try {
      const res = await start(post("/api/debate/start", { topic: "t" }));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ code: "ai_disabled" });
    } finally {
      delete process.env.AI_DISABLED;
    }
  });
});

describe("turnRequest", () => {
  it("requires userText and target together", () => {
    expect(turnRequest.safeParse({ debate: emptyDebate, userText: "hi" }).success).toBe(false);
    expect(turnRequest.safeParse({ debate: emptyDebate, target: "A" }).success).toBe(false);
    expect(turnRequest.safeParse({ debate: emptyDebate, userText: "hi", target: "A" }).success).toBe(true);
    expect(turnRequest.safeParse({ debate: emptyDebate }).success).toBe(true);
  });

  it("caps the visitor text length", () => {
    expect(turnRequest.safeParse({ debate: emptyDebate, userText: "x".repeat(601), target: "A" }).success).toBe(false);
  });
});

describe("handleRoute", () => {
  it("maps an unexpected error to upstream_error without leaking its message", async () => {
    const res = await handleRoute(post("/x", { debate: emptyDebate }), turnRequest, async () => {
      throw new Error("secret detail");
    });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret detail");
  });
});

import { POST as turnStream } from "@/app/api/debate/turn-stream/route";

describe("turn-stream route", () => {
  it("streams start, text and done events in mock mode", async () => {
    process.env.MOCK_AI = "1";
    try {
      const res = await turnStream(post("/api/debate/turn-stream", { debate: emptyDebate }));
      expect(res.headers.get("content-type")).toContain("ndjson");
      const events = (await res.text()).trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
      expect(events[0]).toMatchObject({ type: "start", speaker: "A" });
      expect(events.some((e) => e.type === "text")).toBe(true);
      const last = events.at(-1);
      expect(last.type).toBe("done");
      expect(last.turns[0].text).toBe(events.filter((e) => e.type === "text").at(-1).text);
    } finally {
      delete process.env.MOCK_AI;
    }
  });

  it("rejects bad input before streaming", async () => {
    const res = await turnStream(post("/api/debate/turn-stream", { nope: 1 }));
    expect(res.status).toBe(400);
  });
});
