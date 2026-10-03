# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read this first, then read `docs/SPEC.md` for full architecture, data schemas, and the phased build plan before writing code.

## This is not the Next.js you know

This repo pins a Next.js version newer than your training data — APIs, conventions, and file structure may differ from what you expect. Before writing App Router / Next.js-specific code, check the relevant guide under `node_modules/next/dist/docs/` and heed any deprecation notices you find there.

## What this project is

A website where a rotating cast of historical, artistic, and philosophical figures — reimagined as comedic personas — play a persistent poker game. Visitors are spectators; when a persona busts out, visitors pick who fills the empty seat from a short list. Each persona is an LLM-powered agent, routed through free OpenRouter models — see `lib/personas/openrouterModels.ts` — with a distinct voice and playstyle; personas also keep an open-floor table discussion topic alive across hands and deliver a short victory line whenever they win a pot. A deterministic game engine (no LLM involved) owns all poker math.

## Stack

- Next.js (App Router), TypeScript, React
- No external database — in-memory store for game state and memory (single Node process; this is explicit MVP scope, not built for horizontal scaling yet)
- Server-Sent Events (`/api/table/stream`) for pushing table state and dialogue to spectators — no WebSocket server needed, this is one-directional broadcast plus occasional client POSTs
- OpenRouter for persona decisions and dialogue (one structured JSON call per persona turn), memory writing, and celebrations. Most personas draw a random model per call from a rotating pool of free models (`lib/personas/openrouterModels.ts`'s `FREE_OPENROUTER_MODELS`, retried against a different model on a 15s timeout — `lib/personas/llmTimeout.ts`); any persona not in that rotation (`isOpenRouterPersona`) falls back to a single fixed free model (`lib/personas/fallbackModel.ts`). All routes go through the same `getPersonaTurn` entry point.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm test` — run the full Vitest suite once (`vitest run`); tests live colocated as `*.test.ts` under `/lib`, no separate `/tests` tree
- `npx vitest run path/to/file.test.ts` — run a single test file
- `npx vitest <pattern>` — watch mode filtered by name/file, e.g. `npx vitest pots`
- `npx tsc --noEmit` — typecheck without emitting

Vitest is configured (`vitest.config.ts`) to alias `@/*` to the repo root and to load `.env.local` itself (Next's own env loader skips `.env.local` when `NODE_ENV=test`, which is what Vitest sets) — so `OPENROUTER_API_KEY` etc. are visible in tests without extra setup.

Every persona uses real LLM calls by default. `STUB_PERSONA_IDS` (comma-separated persona ids, or `*`) is an opt-out denylist for deliberately holding specific personas back on the no-cost random-action stub — unset/empty means nobody is stubbed, so a new persona needs no config change to go live (`lib/personas/liveConfig.ts`). `lib/personas/liveSmoke.test.ts` is an opt-in, credit-spending manual review harness (skipped unless `RUN_LIVE_PERSONA_SMOKE=1` and `OPENROUTER_API_KEY` are both set in the same shell invocation) that plays 20 hands and prints real dialogue for a human to read — it doesn't assert coherence itself.

## The rule that matters most

**The game engine and the persona agents must never call each other directly.** All state and all decisions pass through the orchestrator. If you catch yourself writing engine logic that reads a persona's response, or a persona prompt that reaches directly into engine internals, stop — that boundary is intentional (see `docs/SPEC.md`). It's what keeps the poker math trustworthy regardless of what an LLM call returns.

## Where things live

```
/app
  /api/table/stream/route.ts   SSE broadcast endpoint (built)
  /api/table/seat/route.ts     POST — spectator fills an open seat (built)
  /page.tsx                    renders <Table />
/lib
  /engine          deterministic poker logic only — no API calls, no LLM, no unseeded randomness
                    cards/rng (seeded shuffle), betting, pots (side-pot math), handRank, showdown, seats, state
  /orchestrator    playHand (turn loop; also generates each winner's victory line via the opt-in getCelebration/
                    onCelebration options once a hand resolves), validateAction (legal-action clamp), context
                    (assembles PersonaPromptContext), postHand (memory writer hookup) — this is where engine,
                    personas, and memory get wired together
  /personas        profiles.ts (identity/voice, 33 personas), prompt.ts + parseResponse.ts (structured call),
                    openrouterClient.ts (shared OpenRouter fetch transport), openrouter.ts (rotating free-model
                    pool call) / fallbackModel.ts (single fixed-model call for a persona not in the rotation),
                    openrouterModels.ts (the free-model pool + isOpenRouterPersona routing — currently every
                    profiled persona is OpenRouter-routed, so fallbackModel.ts is a safety net rather than a hot
                    path), llmTimeout.ts (15s call timeout + timeout detection), modelCooldown.ts (short
                    cross-call cooldown for a model that just hit a capacity error, so other persona/celebration/
                    memory calls steer around it too), liveConfig.ts (STUB_PERSONA_IDS gate), stub.ts
                    (random-legal-action fallback) — all reached only through getPersonaTurn (index.ts).
                    celebrationPrompt.ts / celebrationOpenRouter.ts / celebrationFallbackModel.ts /
                    celebrationStub.ts mirror that same split for post-hand winner reactions, reached only
                    through getPersonaCelebration (index.ts)
  /memory          store.ts, writer.ts (post-hand writer), filters.ts (retrieval-time filtering), dispatch.ts
                    (live vs stub writer routing), prompt.ts — private memory (per-persona, importance-pinned,
                    capped at 6) + table digest (shared, 4-hand decay)
  /store           tableStore.ts — in-memory singleton holding current game + memory state (also carries the
                    table's live DiscussionTopic across hands); roster.ts — bench of personas available to fill
                    an open seat, plus seat-fill/elimination reconciliation helpers
  /events          in-process pub/sub feeding the SSE endpoint
/components        Table, Seat, Card, Portrait (persona avatar image, falls back to a deterministic
                    initials-on-hue badge), DialogueLog, SeatPickerModal (seat-refill picker triggered by
                    seat_open, POSTs to /api/table/seat), useTableStream (client hook consuming the SSE stream),
                    useThinkingWord (rotates an in-character "thinking..." word while a persona's turn is pending)
/design            handoff design reference (Poker Table.dc.html, screenshots) the frontend was built from —
                    see design/README.md
/public/avatars    per-persona portrait images referenced by Portrait.tsx, named by persona id
/types/index.ts    shared schema — mirror docs/SPEC.md exactly, don't let these drift apart
```

## Build order

`docs/SPEC.md`'s phased plan (phase 0 scaffold → 1 engine → 2 orchestrator+stubs → 3 real personas → 4 memory → 5 SSE/frontend → 6 seat-refill UI → 7 cost/polish) is fully built through phase 6. Phase 7 is partial: timeout/malformed-response fallback and cross-model cooldown are done, but there's no cost-skip on routine folds/checks yet (every live turn still makes a full LLM call), and visual polish is ongoing. The table discussion topic and post-hand celebration line are built but were never part of the original phased plan — see `docs/SPEC.md`'s "Beyond the original plan" note. Each phase has an acceptance check in the spec — treat it as a gate, not a suggestion, and don't assume a later phase is done just because files for it exist.

## Conventions

- `strict: true` in tsconfig. No `any` inside `/lib/engine` or `/lib/orchestrator`.
- Engine functions take state, return new state — no mutation, no side effects, no randomness that isn't seeded.
- Every persona interaction goes through one function: `getPersonaTurn(context: PersonaPromptContext): Promise<PersonaResponse>`. Don't inline OpenRouter API calls anywhere else.
- The `reasoning` field on a `PersonaResponse` is stripped before anything reaches `/lib/events`. Never let it leak to the SSE stream or the frontend.
- Requires `OPENROUTER_API_KEY` in `.env.local`.

## Before you start

If anything in `docs/SPEC.md` seems to conflict with a decision that would be easier to build a different way, flag it and ask rather than silently deviating — several of the constraints here (the engine/persona boundary, stripping `reasoning`, the two different memory decay rules) were chosen on purpose and aren't arbitrary.
