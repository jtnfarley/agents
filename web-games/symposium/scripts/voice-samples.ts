/**
 * Phase 2 review artifact: one opening turn per roster philosopher, on one shared topic,
 * written to voice-samples.md for a human to read before the profiles are signed off.
 * Run: npm run voice-samples   (reads .env.local through tsx --env-file)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { takeTurn } from "../src/lib/debateEngine";
import { ROSTER } from "../src/lib/roster";
import type { Debate } from "../src/lib/types";

const TOPIC = "Is it ever right to lie?";

async function main() {
  const lines = [
    "# Voice samples",
    "",
    "Each philosopher opens on the same topic against the next figure in the roster. Review each voice against its profile in `src/lib/roster.ts`.",
    "",
    `Topic: ${TOPIC}`,
    "",
  ];
  for (let i = 0; i < ROSTER.length; i++) {
    const a = ROSTER[i];
    const b = ROSTER[(i + 1) % ROSTER.length];
    const debate: Debate = {
      id: `sample-${a.id}`,
      topic: TOPIC,
      philosophers: { A: a.id, B: b.id },
      stances: { A: null, B: null },
      turns: [],
      rollingSummary: "",
      ledger: null,
    };
    const { turns } = await takeTurn({ debate });
    const opening = turns[0];
    lines.push(`## ${a.displayName}`, "", `*Opposite: ${b.displayName}*`, "", opening.speaker === "user" ? "" : opening.text, "");
    console.log(`ok  ${a.displayName}`);
  }
  const out = resolve(process.cwd(), "voice-samples.md");
  writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error("voice-samples failed:", (e as Error).message);
  process.exit(1);
});
