/**
 * Fixtures for MOCK_AI mode. Each route returns the same JSON body the real route will,
 * so the UI can be built and tested without an API key.
 */
import type { ApiFailure, ApiResponse, Personality } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PERSONALITIES: Personality[] = [
  { trait: "Wry", how: "Speaks in short, dry sentences and laughs at their own jokes. Knows every shortcut." },
  { trait: "Over-eager", how: "Gushes about everything and insists you must see it before dinner. Always has a tangent." },
  { trait: "Deadpan", how: "Understated and funny without raising the voice. Sighs at tourists kindly." },
  { trait: "Poetic", how: "Notices light and weather first. Speaks in small, careful images." },
];

let rotation = 0;
const nextPersonality = () => PERSONALITIES[rotation++ % PERSONALITIES.length];

const fail = (code: ApiFailure["code"], message: string): ApiFailure => ({ ok: false, code, message });

function mockDestination(place: string) {
  if (place.trim().toLowerCase() === "asdfgh") {
    return fail("not_a_place", "Not a place");
  }
  const city = place.trim() || "Mock City";
  return {
    ok: true,
    destination: {
      city,
      tagline: "Mock tagline for layout work",
      prompts: [
        "What should I do on my first day?",
        "Where should I eat on night one?",
        "Is the most famous sight worth the line?",
      ],
      local: {
        name: "Sam Okafor",
        role: "Baker, Old Town",
        brief:
          "You are a baker who has worked the same corner for twenty years. You believe the best day starts before the tourists wake up.",
        personality: { trait: "Warm", how: "Hands you bread before you ask and asks where you are staying." },
      },
      tourist: {
        name: "Priya Shah",
        role: "Licensed guide, City Centre",
        brief:
          "You are a licensed guide who loves the big landmarks. You believe first-time visitors should see the famous sights up close.",
        personality: { trait: "Enthusiastic", how: "Counts the sights off on her fingers and checks the time often." },
      },
    },
  };
}

// Request bodies arrive as loose JSON; the routes check what they need.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;

function mockReroll(body: Body) {
  let local = nextPersonality();
  let tourist = nextPersonality();
  if (local.trait === body.local.trait) local = nextPersonality();
  if (tourist.trait === body.tourist.trait || tourist.trait === local.trait) tourist = nextPersonality();
  return { ok: true, local, tourist };
}

function mockChat(body: Body) {
  const { guides } = body.destination;
  if (body.target === "both") {
    const turns = [
      { speaker: "local", text: `Skip the queue, ${guides.local.name.split(" ")[0]}'s way: start early.`, stops: [{ name: "Morning market", when: "8:00", note: "Go before the crowds." }] },
      { speaker: "tourist", text: "Early is wonderful, but the famous viewpoint is only worth it at sunset.", stops: [{ name: "Main viewpoint", when: "18:30", note: "Arrive 20 minutes early." }] },
      { speaker: "local", text: "Sunset is a crowd. Come back at dusk, when the locals go.", stops: [] },
      { speaker: "tourist", text: "Fine, but book the sights you cannot miss first.", stops: [] },
    ];
    return {
      ok: true,
      kind: "debate",
      turns,
      common_ground: `Start at the market, then the viewpoint at dusk, with a check on opening times first.`,
    };
  }
  const side = body.target === "tourist" ? "tourist" : "local";
  return {
    ok: true,
    kind: "single",
    reply: `${guides[side].name} answers your question: "${body.text.slice(0, 60)}". Start early and check opening hours before you go.`,
    stops: [{ name: side === "local" ? "Corner bakery" : "Old cathedral", when: "9:00", note: "Ask for the house special." }],
    tip: side === "local" ? "Bring small change for the cafes." : "",
  };
}

function mockTrip(body: Body) {
  const days = Array.from({ length: body.options.days }, (_, i) => ({
    label: `Day ${i + 1}`,
    stops: [
      { time: "9:30", name: "Morning market", note: "Buy something to eat on the walk.", from: "local" },
      { time: "13:00", name: "Main square", note: "Lunch with a view.", from: "tourist" },
      { time: "17:00", name: "Riverside walk", note: "Golden hour, no ticket needed.", from: "local" },
    ],
  }));
  return {
    ok: true,
    trip: {
      title: body.change ? `Mock plan, revised: ${body.change.slice(0, 40)}` : "Mock itinerary",
      days,
    },
  };
}

/** Stands in for the server. Returns the JSON body a real route would send. */
export async function mockRoute(path: string, body: unknown): Promise<ApiResponse<Record<string, unknown>>> {
  await delay(400);
  const b = body as Body;
  switch (path) {
    case "/api/destination":
      return mockDestination(String(b.place ?? "")) as ApiResponse<Record<string, unknown>>;
    case "/api/reroll":
      return mockReroll(b) as ApiResponse<Record<string, unknown>>;
    case "/api/chat":
      return mockChat(b) as ApiResponse<Record<string, unknown>>;
    case "/api/trip":
      return mockTrip(b) as ApiResponse<Record<string, unknown>>;
    default:
      return fail("invalid_input", `Unknown route ${path}`);
  }
}
