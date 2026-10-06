import { beforeAll, describe, expect, it } from "vitest";
import { POST as destination } from "@/app/api/destination/route";
import { POST as chat } from "@/app/api/chat/route";
import { POST as reroll } from "@/app/api/reroll/route";
import { POST as trip } from "@/app/api/trip/route";

const guide = {
  name: "Sam Okafor",
  role: "Baker",
  brief: "You bake bread every morning.",
  personality: { trait: "Warm", how: "Kind and quick to help." },
};
const destinationBody = {
  city: "Lisbon",
  guides: { local: guide, tourist: { ...guide, name: "Priya Shah", role: "Guide" } },
};

const post = (handler: (r: Request) => Promise<Response>, body: unknown, ip = "test") =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeAll(() => {
  process.env.MOCK_AI = "1";
  delete process.env.AI_DISABLED;
});

describe("API routes in MOCK_AI mode", () => {
  it("returns a destination with two guides and three prompts", async () => {
    const res = await post(destination, { place: "Lisbon" }, "dest-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.destination.city).toBe("Lisbon");
    expect(body.destination.prompts).toHaveLength(3);
    expect(body.destination.local.name).toBeTruthy();
    expect(body.destination.tourist.name).toBeTruthy();
  });

  it("returns not_a_place for gibberish, with HTTP 422", async () => {
    const res = await post(destination, { place: "asdfgh" }, "dest-2");
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, code: "not_a_place" });
  });

  it("rejects a bad body with invalid_input and HTTP 400", async () => {
    const res = await post(destination, { place: "x".repeat(61) }, "dest-3");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("rejects malformed JSON with invalid_input", async () => {
    const res = await post(destination, "{not json", "dest-4");
    expect(res.status).toBe(400);
  });

  it("answers one guide with a single reply", async () => {
    const res = await post(chat, { destination: destinationBody, target: "tourist", text: "Where first?", history: [] }, "chat-1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, kind: "single" });
    expect(typeof body.reply).toBe("string");
  });

  it("returns a debate with turns and common ground when both are asked", async () => {
    const res = await post(chat, { destination: destinationBody, target: "both", text: "Is it worth it?", history: [] }, "chat-2");
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, kind: "debate" });
    expect(body.turns.length).toBeGreaterThan(0);
    expect(body.turns.length).toBeLessThanOrEqual(6);
  });

  it("drafts a trip with at least one day", async () => {
    const options = { days: 2, pace: "Balanced", lean: "split", interests: ["Food"] };
    const res = await post(trip, { destination: destinationBody, options, history: [] }, "trip-1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trip.days.length).toBeGreaterThan(0);
  });

  it("rerolls two personalities that are different from each other", async () => {
    const body = {
      city: "Lisbon",
      local: { name: "Sam", role: "Baker", trait: "Warm" },
      tourist: { name: "Priya", role: "Guide", trait: "Enthusiastic" },
    };
    const res = await post(reroll, body, "reroll-1");
    const out = await res.json();
    expect(out.ok).toBe(true);
    expect(out.local.trait).toBeTruthy();
    expect(out.tourist.trait).toBeTruthy();
  });

  it("answers rate_limited after 20 requests in a minute from one address", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await post(destination, { place: "Kyoto" }, "burst-ip");
    }
    expect(last?.status).toBe(429);
    expect(await last?.json()).toMatchObject({ code: "rate_limited" });
  });
});
