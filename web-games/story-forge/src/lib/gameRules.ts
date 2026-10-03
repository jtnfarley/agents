// Condensed rule set for the narration LLM's system prompt, plus the pure
// (non-LLM) dice resolution logic. Shared by app/api/start and app/api/turn.

import type { GameState } from "./schemas";

export const GENRE_POOL = [
  "fantasy adventure",
  "horror/survival",
  "space opera",
  "cyberpunk",
  "post-apocalyptic survival",
  "mystery/noir",
  "heist thriller",
  "wartime spy drama",
  "high-seas piracy",
  "western frontier",
  "fairy tale/fable",
  "cosmic horror",
  "historical intrigue",
  "political thriller",
  "time-travel puzzle",
  "ghost story",
  "wilderness survival",
  "steampunk",
  "urban fantasy",
  "first-contact sci-fi",
  "detective procedural",
  "swashbuckling adventure",
] as const;

export const SURPRISE_ME = "surprise me";

// Phase 6: palette/mood descriptor per genre, folded into the one-line style
// prefix used for the story's single background image (see
// deriveStylePrefix). Falls back to a generic descriptor for any genre not
// listed here.
const GENRE_STYLE_HINTS: Record<string, string> = {
  "fantasy adventure": "warm parchment and forest-green palette, dappled sunlight",
  "horror/survival": "desaturated, sickly green-grey palette, harsh shadow",
  "space opera": "deep space blacks with neon accent palette, star-glow highlights",
  cyberpunk: "neon magenta and cyan palette, wet night streets",
  "post-apocalyptic survival": "dust-ochre and rust palette, bleached overcast light",
  "mystery/noir": "high-contrast black-and-white palette, hard venetian-blind shadow",
  "heist thriller": "cool steel-blue and gold palette, sleek nocturnal lighting",
  "wartime spy drama": "muted khaki and smoke-grey palette, tense low light",
  "high-seas piracy": "salt-bleached teal and weathered-wood palette, storm light",
  "western frontier": "dusty sepia and burnt-orange palette, harsh noon sun",
  "fairy tale/fable": "saturated jewel-tone palette, soft storybook glow",
  "cosmic horror": "sickly violet and abyssal-black palette, wrong-angled light",
  "historical intrigue": "candlelit amber and oxblood palette, oil-painting warmth",
  "political thriller": "cold institutional grey-blue palette, fluorescent overcast",
  "time-travel puzzle": "chromatic-aberration teal and magenta palette, unstable light",
  "ghost story": "washed-out cold blue palette, thin moonlight",
  "wilderness survival": "earthy green and granite-grey palette, raw natural light",
  steampunk: "brass and umber palette, gaslit warm glow",
  "urban fantasy": "neon-lit indigo palette over gritty city texture",
  "first-contact sci-fi": "sterile white and cool cyan palette, alien bioluminescence",
  "detective procedural": "muted tan and coffee-brown palette, desk-lamp light",
  "swashbuckling adventure": "sun-bleached azure and gold palette, bright Mediterranean light",
};

/**
 * One-line art style prefix for a genre, derived deterministically (no LLM
 * call). Prefixed onto the story's single ambient background-image prompt.
 */
export function deriveStylePrefix(genre: string): string {
  const palette = GENRE_STYLE_HINTS[genre] ?? "muted, genre-appropriate palette";
  return `moody painterly digital illustration, cinematic rim lighting, ${palette}`;
}

/** Sample `count` distinct genres at random from the pool. */
export function sampleGenres(count: number): string[] {
  const pool = [...GENRE_POOL];
  const picks: string[] = [];
  while (picks.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

export type DcLabel = "Easy" | "Moderate" | "Hard" | "Reckless";

export const DC_TABLE: { label: DcLabel; dc: number; description: string }[] = [
  { label: "Easy", dc: 8, description: "low risk, sensible approach" },
  { label: "Moderate", dc: 12, description: "real risk, reasonable approach" },
  { label: "Hard", dc: 16, description: "dangerous, or attempted unprepared" },
  { label: "Reckless", dc: 18, description: "over their head, no real plan" },
];

export type OutcomeTier =
  | "critFail"
  | "fail"
  | "successComplication"
  | "cleanSuccess"
  | "critSuccess";

/** Server-side d20 roll. Never let the LLM produce this number. */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Pure resolution logic, given a roll and a DC. Natural 1 and natural 20
 * override everything else, even below/above the DC.
 */
export function resolveRoll(roll: number, dc: number): OutcomeTier {
  if (roll === 1) return "critFail";
  if (roll === 20) return "critSuccess";
  if (roll < dc) return "fail";
  if (roll - dc <= 2) return "successComplication";
  return "cleanSuccess";
}

export type EndingTier = "triumphant" | "hopeful" | "bittersweet" | "grim" | "tragic";

/**
 * Ending-severity roll, used when the player chooses to end the story.
 * Unlike resolveRoll, this isn't a pass/fail check against a DC — it's a
 * tone dial, but it runs the same direction as the risk rolls: a high roll
 * is the happy end of the scale, a low roll is the dark end.
 */
export function resolveEndingRoll(roll: number): EndingTier {
  if (roll <= 4) return "tragic";
  if (roll <= 8) return "grim";
  if (roll <= 12) return "bittersweet";
  if (roll <= 16) return "hopeful";
  return "triumphant";
}

export const ENDING_TIER_GUIDANCE: Record<EndingTier, string> = {
  triumphant: "Everything the protagonist wanted lands — narrate this as a genuine, unambiguous win.",
  hopeful: "The ending leans positive — real cost was paid along the way, but things land in a good place.",
  bittersweet: "A true bittersweet ending — real gains and real losses, held in balance, neither softened.",
  grim: "The ending leans dark — something important is lost or fails, though it stops short of total ruin.",
  tragic: "This ending is tragic — narrate a genuine loss or downfall for the protagonist, not softened or undercut.",
};

export const OPENING_SCENE_INSTRUCTIONS = `Invent a concrete, specific setting (not generic), the protagonist's name and an immediate goal, and one obstacle that forces a real decision. End every turn with a prompt like "What does [name] do?" plus two concrete numbered choices that push the story in genuinely different directions (the client adds the standing third option, free text, automatically — you only need to produce two).`;

export const PROSE_STYLE_GUIDE = `Choices and narration should read like something is happening to someone, not a report about it — cut justification clauses, write the raw impulse. Avoid one-note solemnity; vary rhythm, let specific concrete detail and the occasional bit of wit carry tension rather than stating that something is dire.`;

export const NARRATION_LENGTH_LIMIT = `Narration: at most 2 paragraphs, no more than 6 sentences each. Keep the action moving — cut description that doesn't change the decision in front of the player.`;

export const POINT_OF_VIEW_RULE = `Strict third person, always — in narration, choice text, and epilogue alike. Never write "you" or otherwise address the player directly; the protagonist is a named character in the story, not the reader. Use their name or a pronoun matching their gender, the way third-person prose fiction does: "Rae ducks behind the crate," never "You duck behind the crate."`;

export const FORWARD_MOMENTUM_RULE = `Every turn must move the story forward — never let the scene freeze in place or hand back a decision point that's a close paraphrase of one already offered. If the player hesitates, waits, or picks the cautious/non-committal option, the world doesn't pause for them: time passes, an NPC acts on their own agenda, a threat closes in, new information surfaces, or the stakes rise. Inaction is itself a choice with consequences, never a free reset button. If you notice the player has been avoiding commitment for a turn or two, that's exactly the moment to force the issue — have something happen that makes standing still no longer an option.`;

export const STATE_DISCIPLINE = `Rewrite establishedFacts, openThreads, and currentDecisionPoint completely each turn (not append), keeping only what's still true. This state is bookkeeping — never surface it as visible narration text. If the player is stalling or avoiding a decision, capture the mounting pressure here (a clock running out, someone's patience thinning, a window closing) so the next turn can pay it off instead of re-presenting the same stalemate.`;

export const OFF_SCRIPT_HANDLING = `Never refuse an off-script attempt outright and never silently accommodate it either. Resolve it against what's actually true in the story so far; if the premise doesn't hold, the attempt fails without a roll (it's a matter of established fact, not chance) — but the failure should still cost something real, never a free no-op.`;

export const ENDING_TRIGGERS = `Offer an ending when a critical roll lands (natural 1 or 20) or whenever the player asks to end, at any point. An ending should be a genuine tone-matched epilogue resolving establishedFacts, not a trail-off.`;

export const SYSTEM_PROMPT = `You are the game master for a choice-driven narrative game with no pre-written branch tree — you invent the story as it unfolds.

Opening scene: ${OPENING_SCENE_INSTRUCTIONS}

Prose style: ${PROSE_STYLE_GUIDE}

${NARRATION_LENGTH_LIMIT}

Point of view: ${POINT_OF_VIEW_RULE}

Forward momentum: ${FORWARD_MOMENTUM_RULE}

State discipline: ${STATE_DISCIPLINE}

Off-script actions: ${OFF_SCRIPT_HANDLING}

Endings: ${ENDING_TRIGGERS}`;

export const RISK_ASSESSMENT_SYSTEM_PROMPT = `You referee whether the player's proposed action is risky, before any dice are rolled. Judge purely from the established fiction: is failure plausible here, and would it cost something real?

If risky, assign a DC from this table:
- Easy — low risk, sensible approach: DC 8
- Moderate — real risk, reasonable approach: DC 12
- Hard — dangerous, or attempted unprepared: DC 16
- Reckless — over their head, no real plan: DC 18-20 (push toward 20 for the most reckless attempts)

If the action is not risky — safe, low-stakes, or something already established settles it outright — set risky: false and omit dc.`;

/** Renders a GameState as prompt text for the LLM calls. */
export function describeState(state: GameState): string {
  const facts = state.establishedFacts.length
    ? state.establishedFacts.map((f) => `- ${f}`).join("\n")
    : "(none yet)";
  const threads = state.openThreads.length
    ? state.openThreads.map((t) => `- ${t}`).join("\n")
    : "(none yet)";

  return [
    `Genre: ${state.genre}`,
    `Protagonist: ${state.protagonist.name}, ${state.protagonist.descriptor} (${state.protagonist.gender})`,
    `Established facts:\n${facts}`,
    `Open threads:\n${threads}`,
    `Current decision point: ${state.currentDecisionPoint}`,
  ].join("\n\n");
}
