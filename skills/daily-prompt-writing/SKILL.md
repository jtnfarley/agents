---
name: daily-writing-prompt
description: Generates a writing prompt on demand — a required opening line plus a character/setting to work in, rotating across fiction, journaling/reflective, poetry, and hybrid/experimental forms — and can also critique a draft the user writes in response. Checks recent conversation history and any prompt log the user provides so it doesn't repeat lines or seeds already used. Use this whenever the user asks for "a writing prompt," "today's prompt," "something to write about," wants to start or keep up a daily writing habit or streak, invokes "/writing-prompt," asks for a prompt in a specific genre (fiction/poetry/journaling), or shares something they wrote for one of these prompts and wants feedback, a critique, or thoughts on it — even if they don't say the word "skill."
---

# Daily Writing Prompt

## What it does
One prompt per invocation: a hook premise plus a twist or constraint. Mixed-genre by default so the practice doesn't get stale — fiction, journaling/reflective, poetry, hybrid/experimental — unless the user asks for one lane specifically.

## Workflow

### 1. Avoid repeats
Before writing anything new:
- Run `conversation_search` with something like "writing prompt" (try a second query if the first comes back thin) to see what's been given recently. Note the subjects and twist mechanisms already used.
- If the user has uploaded or pasted a prompt log (e.g. `writing-prompt-log.md`), read that too — it's the more reliable record, since it's explicit rather than inferred from chat snippets.
- Keep a short mental "used recently" list of both opening lines and character/setting seeds from whichever of these turn something up. If neither does (first time, or nothing found), that's fine — just proceed.

### 2. Pick a lane
Rotate across **fiction**, **journaling/reflective**, **poetry**, **hybrid/experimental**. Check what lane was used most recently (from step 1) and lean toward a different one, unless the user requested a specific lane.

### 3. Compose
Every prompt has exactly two required parts — nothing layered on top:

1. **An opening line** — a literal sentence, in quotes, that the user must use as the actual first line of their piece.
2. **A character or setting** — a short, vivid description of a person or place the piece must use somewhere. This is a description, not an instruction — don't tell the user what to do with it, just hand it over.

That's the whole prompt. Don't add a POV rule, word limit, or structural game on top — the two required elements are constraint enough.

Pick the opening line and the character/setting so they don't neatly resolve into each other — a little friction between the two is what makes the prompt generative, since the writer has to do the work of reconciling them. Don't hand over a line and a setting that already obviously belong to the same scene.

See `references/prompt-elements.md` for a bank of opening lines and character/setting seeds across all four lanes — remix and write fresh variations inspired by them rather than quoting an entry outright, and skip anything that matches what step 1 flagged as recently used.

Present it as two short labeled parts, nothing else:

> **First line:** "..."
> **Include:** ...

No preamble ("Here's your prompt:"), no explanation of why it works, no extra framing.

### 4. Offer to log it (don't force it)
If this reads like an ongoing practice rather than a one-off ask, briefly offer to start or continue a running log file (date, lane, prompt text) that the user can keep and re-upload in future sessions — that way future runs of this skill can read it directly in step 1 instead of relying on conversation search alone. Only create or update the file if they say yes. If they already have a log, append to it rather than starting a new one.

### 5. Critiquing a draft (optional, on request or when they share writing)
If the user comes back with something they wrote for one of these prompts and wants a reaction — whether they ask outright or just paste the piece and it's clear that's why — give a short critique.

**Match the register to how done the piece is.** Gauge this from what the user says about it ("quick draft," "just freewrote this," "polished this a bit," "final version") and from how the text itself reads (a freewrite vs. something clearly revised):
- **Rough / first-pass:** stay macro-level and warm. Point at what's alive in it and give one clear next step — skip line-level wording nitpicks, they're not useful yet on a draft this early.
- **Polished / revised:** get specific. Line-level notes are fair game now — a wobbly sentence, a soft ending, a repeated word — the writer has earned real notes, not padding.
- **Can't tell:** default toward the gentler end.

**Every critique covers three things, woven into normal prose — not a rigid template or a checklist with headers:**
1. *What's working* — one or two things, specific to their piece, pointing at an actual line or choice rather than generic praise.
2. *Constraint check* — note, neutrally, whether they used the opening line verbatim and worked in the required character/setting. If they changed or dropped one, that's not a foul — prompts are a springboard, not a test — just observe it plainly rather than flagging it as something to fix.
3. *One revision idea* — a single, concrete suggestion tied to something specific in their draft (a line to cut, an ending to move earlier, a detail worth pushing further), not a generic craft tip that could apply to any piece.

Keep it tight — a paragraph or two, not a full workshop letter. No numeric scores or grades.

## Tone
Specific and a little odd beats generic. Avoid stock openers: "You wake up and...", "It was a dark and stormy night...", "In a world where...". A concrete, unexpected detail does more work than an abstract setup.

## Example prompts

**Fiction**
> **First line:** "My mother's ghost was, unfortunately, a font of financial advice."
> **Include:** A retired lighthouse keeper who has become the town's most reliable rumor mill.

**Journaling**
> **First line:** "I didn't notice the house had gone quiet until I noticed I'd stopped noticing."
> **Include:** A junk drawer that hasn't been reorganized since a specific year everyone remembers for a different reason.

**Poetry**
> **First line:** "Here is everything the river agreed to keep."
> **Include:** A pair of shoes left by a door long after anyone was coming back for them.

**Hybrid**
> **First line:** "Item 4(b): The Customer agrees to forget this memory only under the conditions described below."
> **Include:** A notary public who specializes in agreements between people who no longer speak.

## Example critique

If the user pastes back a short, clearly-first-pass piece written from a fiction prompt, a reasonable critique reads like:

> There's a real hook in that opening image of the notary stamping things she hasn't read — that's the kind of detail worth keeping. You dropped the required setting about halfway through and let the notary's office just be an office, which is fine, the piece didn't need it once the voice took over. If you kept going with this, I'd cut the last paragraph entirely — it explains what the first two already showed, and the piece is stronger ending on her holding the pen without signing.

Note the shape: a specific strength, a plain (not scolding) note on the constraint, one concrete revision idea — no headers, no score, short.
