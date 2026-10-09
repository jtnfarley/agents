/**
 * Phase 4 exit test: a live 12-turn debate through the same engine the routes use, with the
 * same summary schedule the client follows. Writes debate-run.md for review: transcript,
 * moves, the visitor interjection, and the ledger after each summary.
 * Run: npm run debate-run -- "Is it ever right to lie?" kant mill
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarize, takeTurn } from "../src/lib/debateEngine";
import { rosterById } from "../src/lib/roster";
import { shouldSummarize, philosopherTurnCount } from "../src/lib/turnPolicy";
import type { Debate, Ledger, Turn } from "../src/lib/types";

const TURNS = 12;
const INTERJECT_AFTER = 6;
const INTERJECTION = "If the lie saved a life, would that change your answer?";

const [topic = "Is it ever right to lie?", a = "kant", b = "mill"] = process.argv.slice(2);

async function main() {
  const names = { A: rosterById(a)?.displayName ?? a, B: rosterById(b)?.displayName ?? b };
  let debate: Debate = {
    id: "run",
    topic,
    philosophers: { A: a, B: b },
    stances: { A: null, B: null },
    turns: [],
    rollingSummary: "",
    ledger: null,
  };

  const label = (t: Turn) => {
    if (t.speaker === "user") return `**Visitor** (to ${t.target === "both" ? "both" : names[t.target]})`;
    if (t.speaker === "error") return "**Error**";
    return `**${names[t.speaker]}** (${t.move}${t.move === "answer" ? "" : ` → ${t.target === "user" ? "visitor" : names[t.target as "A" | "B"]}`})`;
  };

  const log: string[] = [];
  const ledgers: { after: number; summary: string; ledger: Ledger }[] = [];
  let interjected = false;

  const sendSummaryIfDue = async () => {
    if (!shouldSummarize(debate.turns)) return;
    const s = await summarize({ debate });
    debate = { ...debate, rollingSummary: s.rollingSummary, ledger: s.ledger };
    ledgers.push({ after: philosopherTurnCount(debate.turns), summary: s.rollingSummary, ledger: s.ledger });
    console.log(`summary after ${philosopherTurnCount(debate.turns)} philosopher turns`);
  };

  while (philosopherTurnCount(debate.turns) < TURNS) {
    const visitor =
      !interjected && philosopherTurnCount(debate.turns) >= INTERJECT_AFTER
        ? { userText: INTERJECTION, target: "both" as const }
        : {};
    if (visitor.userText) interjected = true;

    const { turns } = await takeTurn({ debate, ...visitor });
    debate = { ...debate, turns: [...debate.turns, ...turns] };
    for (const t of turns) {
      if (t.speaker === "A" || t.speaker === "B") {
        if (t.stance) debate.stances = { ...debate.stances, [t.speaker]: t.stance };
      }
      log.push(`### ${label(t)}\n\n${t.text}\n`);
    }
    console.log(`turn ${philosopherTurnCount(debate.turns)}/${TURNS}`);
    await sendSummaryIfDue();
  }

  const out = [
    "# Debate run",
    "",
    `Topic: ${debate.topic}`,
    `Seats: A = ${names.A}, B = ${names.B}`,
    `Stances: ${names.A}: ${debate.stances.A ?? "-"} | ${names.B}: ${debate.stances.B ?? "-"}`,
    "",
    "## Transcript",
    "",
    ...log,
    "## Ledger snapshots",
    "",
    ...ledgers.flatMap((l) => [
      `### After ${l.after} philosopher turns`,
      "",
      `Summary: ${l.summary}`,
      "",
      `- Common ground: ${l.ledger.agree.join(" / ") || "-"}`,
      `- Fault lines: ${l.ledger.split.join(" / ") || "-"}`,
      `- Open questions: ${l.ledger.openQuestions.join(" / ") || "-"}`,
      "",
    ]),
  ];
  const file = resolve(process.cwd(), "debate-run.md");
  writeFileSync(file, out.join("\n"));
  console.log(`Wrote ${file}`);
}

main().catch((e) => {
  console.error("debate-run failed:", (e as Error).message);
  process.exit(1);
});
