# Symposium

Give a topic and two philosophers, drawn at random, will debate it. You sit at the table: ask either one a question, challenge both, or interrupt mid-argument. The design is in [symposium-plan.md](symposium-plan.md).

Stack: Next.js (App Router) with TypeScript, plain CSS, zod, Vitest. The model layer (OpenAI SDK pointed at OpenRouter) arrives in Phase 3.

## Status

| Phase | State |
|---|---|
| 0. Scaffold | Done |
| 1. Static UI with mocks | Done. The mock debate plays end to end, with a visitor interjection and the ledger. |
| 2. Roster and prompts | Draft profiles are written in `src/lib/roster.ts`. Human review of each voice is still to come. |
| 3. LLM layer and routes | Not started |
| 4. Turn engine | Not started. Mock lines in `src/lib/mockEngine.ts` are placeholders. |
| 5. Streaming and multi-model | Not started |
| 6. Polish and ship | Not started |

## Setup

```bash
npm install
npm run dev
```

No key is needed yet. Phase 1 runs entirely in the browser on placeholder output. The debate is saved to `localStorage` under `symposium:v1`, and it survives a reload.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run test` | Vitest: pairing rules, turn policy, the reducer and the saved-state schema |
| `npm run build` | Production build |

## Layout

- `src/lib/roster.ts`: the eight philosophers. Each profile is hand-written.
- `src/lib/pairing.ts`: draws the pair. Uniform over distinct pairs, never the previous pair, seats assigned at random.
- `src/lib/turnPolicy.ts`: who speaks next, which move comes next, and when the summary runs.
- `src/lib/mockEngine.ts`: stands in for the Phase 3 routes.
- `src/state/store.tsx`: reducer and context. One request is in flight at a time.
- `src/lib/storage.ts`: `localStorage`, wrapped in try/catch.
