/**
 * Raw model-output fixtures for MOCK_AI=1 on the server. They have the shape a model
 * returns, and callJson validates them with the same schemas as live output.
 */
import type { Side } from "./types";
import type { Task } from "./models";

const travelerText = (user: string) => {
  const m = /<traveler_text>\n([\s\S]*?)\n<\/traveler_text>/.exec(user);
  return m ? m[1].trim() : "";
};

function destinationFixture(place: string) {
  if (place.toLowerCase() === "asdfgh") return { error: "not_a_place" };
  return {
    city: place || "Mock City",
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
  };
}

const PERSONALITIES = [
  { trait: "Wry", how: "Speaks in short, dry sentences and laughs at their own jokes. Knows every shortcut." },
  { trait: "Over-eager", how: "Gushes about everything and insists you must see it before dinner." },
  { trait: "Deadpan", how: "Understated and funny without raising the voice. Sighs at tourists kindly." },
  { trait: "Poetic", how: "Notices light and weather first. Speaks in small, careful images." },
];

let turn = 0;
const nextPersonality = () => PERSONALITIES[turn++ % PERSONALITIES.length];

function debateFixture() {
  return {
    turns: [
      { speaker: "local", text: "Start early at the market, before the crowds arrive.", stops: [{ name: "Morning market", when: "8:00", note: "Go before the crowds." }] },
      { speaker: "tourist", text: "Early is lovely, but the famous viewpoint is only worth it at sunset.", stops: [{ name: "Main viewpoint", when: "18:30", note: "Arrive 20 minutes early." }] },
      { speaker: "local", text: "Sunset is a crowd. Come back at dusk, when the locals go.", stops: [] },
      { speaker: "tourist", text: "Fine, but book the sights you cannot miss first.", stops: [] },
    ],
    common_ground: "Start at the market, then the viewpoint at dusk, and check opening times first.",
  };
}

function singleFixture(side: Side) {
  return {
    reply: `This is a mock answer from your ${side === "local" ? "local" : "must-see"} guide. Start early and check opening hours before you go.`,
    stops: [{ name: side === "local" ? "Corner bakery" : "Old cathedral", when: "9:00", note: "Ask for the house special." }],
    tip: side === "local" ? "Bring small change for the cafes." : "",
  };
}

function tripFixture() {
  return {
    title: "Mock itinerary",
    days: [1, 2].map((n) => ({
      label: `Day ${n}`,
      stops: [
        { time: "9:30", name: "Morning market", note: "Buy something to eat on the walk.", from: "local" },
        { time: "13:00", name: "Main square", note: "Lunch with a view.", from: "tourist" },
        { time: "17:00", name: "Riverside walk", note: "Golden hour, no ticket needed.", from: "local" },
      ],
    })),
  };
}

/** Raw model output for a task, as if the model had replied. */
export function mockOutput(task: Task, user: string, side?: Side): unknown {
  switch (task) {
    case "destination":
      return destinationFixture(travelerText(user));
    case "reroll":
      return { local: nextPersonality(), tourist: nextPersonality() };
    case "chat":
      return singleFixture(side ?? "local");
    case "debate":
      return debateFixture();
    case "trip":
      return tripFixture();
  }
}
