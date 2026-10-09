# Symposium

Give a topic and two philosophers, drawn at random, will debate it. You sit at the table: ask either one a question, challenge both, or interrupt mid-argument. The design is in [symposium-plan.md](symposium-plan.md).

Stack: Next.js (App Router) with TypeScript, plain CSS, zod, the OpenAI SDK pointed at OpenRouter, Vitest.

## Setup

```bash
cp .env.example .env.local
# Add OPENROUTER_API_KEY, or set MOCK_AI=1 to run on fixtures
npm install
npm run dev
```

With `MOCK_AI=1`, every route answers from fixtures and no model is called. The UI still plays a full debate.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run test` | Vitest: pairing, turn policy, prompt builders (with a snapshot), the LLM retry ladder, the engine in mock mode, the routes, and the saved-state schema |
| `npm run check-models` | Confirms every configured slug exists on OpenRouter and that `MODEL_JSON_MODE_SLUGS` entries accept `response_format` |
| `npm run voice-samples` | Live. One opening per philosopher, written to `voice-samples.md` for review |
| `npm run debate-run -- "topic" kant mill` | Live. A 12-turn debate through the engine, with a visitor interjection and summaries, written to `debate-run.md` |
| `npm run build` | Production build |

## Routes

| Route | In | Out |
|---|---|---|
| `POST /api/debate/start` | `{ topic, previousPair? }` | `{ topic, a, b }`. Runs the topic check and draws the pair. |
| `POST /api/debate/reshuffle` | `{ topic, currentPair, turnCount }` | `{ a, b }`. Refused once `turnCount > 0`. |
| `POST /api/debate/turn` | `{ debate, userText?, target? }` | `{ turns }`. The visitor's turn (if any) and the reply. |
| `POST /api/debate/summarize` | `{ debate }` | `{ rollingSummary, ledger }` |
| `GET /api/suggestions` | none | `{ suggestions }`. Falls back to fixed chips in the UI. |

Errors use one shape: `{ ok: false, code, message }`. Codes: `invalid_input` (400), `off_topic` (422), `bad_output` and `upstream_error` (502), `rate_limited` (429), `ai_disabled` (503). Messages never include model text or upstream detail.

The client sends a snapshot of the debate each time. The server keeps nothing between calls. Each philosopher's model call sees only that philosopher's profile, the topic, the rolling summary, the last six turns, and the visitor's latest message, which is wrapped in `<visitor_text>` as data.

## Models

Each task has its own variable, and each falls back to `MODEL_DEFAULT`. A turn can be seated on its own model with `MODEL_SEAT_A` or `MODEL_SEAT_B`.

Slugs verified live on OpenRouter (see `.env.example`):

| Variable | Slug | Notes |
|---|---|---|
| `MODEL_TURN` | `nvidia/nemotron-3-super-120b-a12b:free` | Reasoning off |
| `MODEL_SUMMARY` | `nvidia/nemotron-3-super-120b-a12b:free` | Reasoning off |
| `MODEL_TOPIC_CHECK`, `MODEL_SUGGEST`, `MODEL_DEFAULT` | `google/gemma-4-31b-it:free` | Rate-limited upstream at times, so expect fallbacks |
| `MODEL_FALLBACK` | `dots-studio/dots-3-note-preview:free` | Reasoning must be off, or the topic check runs out of tokens |

## Safety

- The key is read only on the server. Client code never sees prompts, slugs or the key.
- Visitor text and transcript lines are data inside delimiters. Our own tags are stripped from user text before it reaches a prompt.
- Each IP is limited to 20 requests a minute and 200 a day. The limiter is in memory. On serverless hosting, use a shared store.
- `AI_DISABLED=1` stops every model call.

## Status

| Phase | State |
|---|---|
| 0. Scaffold | Done |
| 1. Static UI | Done |
| 2. Roster and prompts | Prompts and tests done. Profiles are drafts, and the voice samples in `voice-samples.md` are waiting for human review. One known gap: the Socrates sample states a position where the prompt asks him to question, so the prompt needs tuning once the review is in. |
| 3. LLM layer and routes | Done. Verified live: the topic check, four philosopher turns, a visitor interjection, the summary, and reload persistence all run against OpenRouter. |
| 4. Turn engine | Done. The move policy has a stuck-exchange nudge and no back-to-back repeats. Each philosopher states a stance on their first turn. Summaries cover every turn since the last one that succeeded. A live 12-turn run (`debate-run.md`) stays on topic, has no loops, includes modern cases, and has a ledger that matches the transcript. One known weakness: Kant leans on the same "mere means" framing in most turns, so repetition is still noticeable. |
| 5. Streaming and multi-model | Not started. Turns are returned whole, and seat models are configurable but not randomized. |
| 6. Polish and ship | Not started. Playwright smoke test, accessibility pass, deploy. |
