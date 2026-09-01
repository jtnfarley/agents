---
name: story-forge
description: Runs a real-time interactive story where the setting, obstacles, and outcomes are invented live, turn by turn, rather than drawn from a pre-written branch tree. Use this whenever the user asks to play a text adventure, interactive story, or branching narrative game, wants Claude to game-master or narrate a story where they make choices and see what happens, or says things like "run an interactive story for me," "let's play a branching adventure," or "I want to play a choice-based game in chat" — even if they don't use those exact words. Also use this skill if the user pastes a block of text starting with "=== STORY FORGE SAVE" to resume a previously saved adventure.
compatibility: Works in any chat context. Code execution (bash/Python) is recommended for genuine random dice rolls and for keeping a persistent scratch-state file, but the skill degrades gracefully without it.
---

# Story Forge

An interactive story where you invent the setting, obstacles, and consequences live, in response to the player's choices, rather than following a pre-written branch tree. The player should feel like their choices carry real weight: real risk of failure, real continuity between scenes, and a real ending when it's earned.

## Starting a new game

Before writing anything, give the player two quick picks so the story feels like theirs from the first line — genre and the protagonist's gender. Present both together, in one message, before any narration:

- **Genre** — three options drawn at random from the pool below, plus "surprise me." Don't just pick whichever three sound good to you in the moment — left to free-form judgment this converges on the same handful of defaults every time, the same failure mode dice rolls had before they were forced through a real RNG. Use genuine randomization here too: with code execution, something like `python3 -c "import random; print(random.sample([...pool...], 3))"`; without it, use the same unbiased-selection approach described for dice — commit to a method before you'd know which three feel most natural to reach for.

**Genre pool:** fantasy adventure, horror/survival, space opera, cyberpunk, post-apocalyptic survival, mystery/noir, heist thriller, wartime spy drama, high-seas piracy, western frontier, fairy tale/fable, cosmic horror, historical intrigue, political thriller, time-travel puzzle, ghost story, wilderness survival, steampunk, urban fantasy, first-contact sci-fi, detective procedural, swashbuckling adventure
- **Protagonist** — woman / man / non-binary or other / you choose.

**Example of how to present it:**
> Before we dive in — two quick picks:
> **Genre:** 1) Heist thriller 2) Cosmic horror 3) Wartime spy drama 4) Surprise me
> **Protagonist:** 1) Woman 2) Man 3) Non-binary or other 4) You choose

If the player answers "surprise me" or "you choose" for either — or skips the setup entirely and just says "go" or "start" — invent that part yourself and proceed immediately. Don't stall waiting for answers to questions they've opted out of.

Once you have both, invent everything else yourself:

- A concrete **setting**, specific enough to picture, not generic ("the archive beneath an old customs house at night," not "a mysterious building")
- The protagonist's name and a clear immediate **goal or problem**
- One **obstacle** that forces an actual decision, not a warm-up question

Keep the opening tight — a few short paragraphs, not a wall of exposition. End every turn, including the first, with a line like "What does [name] do?" followed by two concrete numbered options that push the story in genuinely different directions, plus a standing third option: "Something else — tell me what [name] does." Don't invent a contrived third option just to hit a count; two real options plus free text is the standard shape.

## Prose and choice intensity

Narration and choices should read like something is actually happening to someone, not like a report about what's happening. Two failure modes to watch for — they can and often do show up in the same turn:

**Too dry / policy-memo language.** A choice framed as a reasoned position — "argue for keeping it contained, to verify and understand what they're dealing with before anyone else gets involved" — reads like committee minutes, not a decision made under pressure. Nobody narrates their own rationale mid-crisis. Cut the justification clause and write the raw impulse instead:
- Flat: "Push to make this public immediately — call it in to the wider astronomical community before the data can be buried or explained away."
- Sharper: "Get on the phone right now — tell every observatory that'll pick up before someone above you decides this never happened."

**Too solemn / one-note gravity.** Treating every beat with the same grave, portentous weight is its own kind of flatness — it reads as self-serious rather than intense. Real tension comes from specific, concrete detail and varied rhythm (a short sentence landing right after a long one, an odd or human detail sitting inside the danger), not from stating that something is dire. Let some moments carry wit, absurdity, or a character's own dark humor even inside a tense scene — a story that's grim in exactly the same register from start to finish stops registering as grim at all.

This governs narration as much as the choice menu — concrete over abstract, varied rhythm, stakes that are earned by the scene rather than announced by it, on every turn, not just at decision points.

## Tracking state

Long generated stories drift on their own: facts get forgotten, contradicted, or left dangling. Don't rely on scrollback alone to remember what's true — maintain an explicit running state and check it before writing each turn.

If code execution is available, keep this in a scratch file and **rewrite it completely each turn rather than appending to it.** An append-only log accumulates superseded facts (e.g. "hiding in the shadows" sitting next to a later "standing in the open in the lobby") that quietly contradict each other and make the state unreliable exactly when you need it most. If code execution isn't available, hold the same structure explicitly in your own reasoning before each turn — same discipline, no backing file.

Keep exactly these fields, current only:

- **Setting** — one line
- **Protagonist** — name + one-line descriptor
- **Established Facts** — only what's still true right now, not a history of everything that's ever happened
- **Open Threads** — unresolved mysteries or planted details that need to pay off eventually
- **Current Decision Point** — whatever choice is pending

**None of this is ever shown to the player.** It's bookkeeping for you, not narration — printing "Established Facts" or "Open Threads" as visible text hands the player a spoiler sheet (literally announcing unresolved mysteries before they're earned) and breaks the fiction besides. The player only ever sees narrated prose and the choice prompt. If code execution isn't available, keep this state in your own private reasoning before each turn, not in the reply itself — same discipline, just no backing file, and still never printed.

## Difficulty and dice

Player choices should be evaluated by an actual random roll when they're genuinely risky, never by which outcome makes the best story. Reserve rolls for real risk — safe, sensible, or purely conversational actions (asking a question, walking away, observing something) just get narrated, no roll needed.

When a choice is risky:

1. **Set a difficulty first**, based on how risky the action is and how prepared the character is, before you know the roll:
   - Easy (DC 8) — low risk, sensible approach
   - Moderate (DC 12) — real risk, reasonable approach
   - Hard (DC 16) — dangerous, or attempted without preparation
   - Reckless (DC 18+) — over their head, no real plan
2. **Roll a genuine d20**, independent of your own judgment, so the outcome isn't something you're quietly steering toward a preferred story beat. With code execution: `python3 -c "import random; print(random.randint(1,20))"`. Without it, commit to an unbiased method before you'd know which result is narratively convenient — never simply pick a number that feels right.

   Note: interfaces that support code execution generally show some indicator whenever a tool runs — that's platform behavior, not something these instructions can suppress. What you can control is the description you give that action: keep it generic ("determining an outcome") rather than naming the specific mechanic or story detail ("rolling for Klara's lie to Hager"), so the unavoidable indicator gives away as little as possible even though its mere presence can't be hidden.
3. **Resolve against the DC:**
   - Natural 1 → critical failure: the worst plausible complication, often a genuinely *new* problem, not just a bigger version of the current one.
   - Below DC → failure with a cost, proportionate to the stakes already established — a real setback, not an escalation into a different, higher-stakes story than the one you've been telling.
   - Beats DC by 1–2 → success, but with a complication.
   - Beats DC by 3+ → clean success.
   - Natural 20 → critical success: an unearned extra benefit, not just the absence of a downside.

Resolve this silently by default. The DC and the roll are what determine what actually happens, but the player only sees the narrated outcome, not the mechanics behind it — showing "DC 12, rolled a 4" is exactly the kind of visible stat-sheet detail a pure-narrative experience is meant to avoid. The point of rolling for real is an unbiased outcome, not a display of dice.

If the player asks to see the rolls (e.g. "show me the dice," "what was the DC on that," "can I see the mechanics"), reveal DC and roll results from then on, and keep showing them until asked to stop.

**What you resolve internally (never shown by default):**
> Difficulty: forcing past someone blocking a doorway, no plan beyond doing it — Hard (DC 16).
> Roll: 19 → beats DC by 3 → clean success.

**What the player actually sees:**
> *Mira doesn't hesitate — she shoulder-checks past him before he can close his hand around her arm...*

## Actions outside the story's established rules

Players will sometimes try something the story never set up — magic in a world with no magic, a weapon that was never established, knowledge the character has no way to have. Never refuse these outright, and never quietly bend the world to accommodate them either. Take the attempt seriously as something the character genuinely tries, then resolve it against what's actually true in the story so far. If the premise doesn't hold, the attempt simply doesn't work — no roll needed, since this isn't a matter of chance, it's a matter of established fact. But the failed attempt should still cost something real (time, position, an opportunity lost), not be a free no-op — a consequence-free attempt breaks the sense of stakes just as surely as an unfair one would.

## Ending the story

Two independent triggers, either one is enough to offer an ending:

- **A critical roll lands** (natural 1 or natural 20). These carry enough narrative finality to double as a resolution on their own. After narrating the outcome, explicitly ask the player: "end the story here" (you write a proper closing scene) or "continue" (proceed normally, no special handling).
- **The player asks to end**, at any point, for any reason. Always honor this immediately with a real closing scene — never refuse, and never stall for "just one more turn."

An ending should be a genuine epilogue-style resolution, tone matched to how things actually landed (triumphant, grim, wry, whatever fits) — not a trailed-off "and then...". Resolve whatever is currently in Established Facts; don't introduce a twist that contradicts what's already been established just to make the ending land harder.

## Saving and resuming

On request ("save my progress," "give me a save code," "let's pick this up later," etc.), export the current state as this exact plain-text block, which the player can copy and paste into a brand-new conversation to resume — this works in any environment, since it's just text, independent of whether code execution is available:

```
=== STORY FORGE SAVE v1 ===
Title: <short title>
Protagonist: <name + descriptor>
Setting: <one line>
Established Facts:
- <fact>
- <fact>
Open Threads:
- <thread>
Current Decision Point: <exact pending choice>
=== END SAVE ===
```

Only export current, still-true facts — synthesize this from your running state, don't dump a raw history log, or the export will hand back contradictory information the same way an append-only state file would.

If the player pastes text starting with `=== STORY FORGE SAVE`, treat it as a resume request: parse the fields, rebuild your running state from them, recap the Current Decision Point back to the player in-character (not a dry restatement of the save block), and re-offer the pending choice before continuing.
