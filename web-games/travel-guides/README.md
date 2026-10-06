# Local Voices

Enter a destination and meet two invented guides who live there: one argues for local spots, the other for the big sights. Ask one, make them argue, or reroll their personalities, then build a trip from what they said.

Stack: Next.js (App Router) with TypeScript, plain CSS, zod, and the OpenAI SDK pointed at OpenRouter.

## Setup

```bash
cp .env.example .env.local
# Add OPENROUTER_API_KEY and the model slugs (see below)
npm install
npm run dev
```

Without a key, run the app in mock mode. Set `MOCK_AI=1` in `.env.local`. Every route then returns fixtures and no model is called.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run test` | Vitest: prompts, JSON extraction, schemas, the LLM retry logic, and the routes in mock mode |
| `npm run check-models` | Confirms every configured slug exists on OpenRouter and that `MODEL_JSON_MODE_SLUGS` entries accept `response_format` |

## Models

The app is set up on free-tier models (OpenRouter `:free` slugs that accept `response_format`). Each task has its own variable, and each falls back to `MODEL_DEFAULT`. Chat can also set a model per guide with `MODEL_GUIDE_LOCAL` and `MODEL_GUIDE_TOURIST`.

| Variable | Slug in use | Notes |
|---|---|---|
| `MODEL_DEFAULT` | `google/gemma-4-31b-it:free` | Rate-limited upstream at times |
| `MODEL_DESTINATION` | `nvidia/nemotron-3-super-120b-a12b:free` | Reasoning turned off |
| `MODEL_REROLL` | `liquid/lfm-2.5-2.6b:free` | Reasoning cannot be turned off; often runs out of tokens and falls back |
| `MODEL_CHAT` | `google/gemma-4-26b-a4b-it:free` | Rate-limited upstream at times |
| `MODEL_DEBATE` | `nvidia/nemotron-3-super-120b-a12b:free` | Reasoning turned off |
| `MODEL_TRIP` | `google/gemma-4-31b-it:free` | Rate-limited upstream at times |
| `MODEL_FALLBACK` | `dots-studio/dots-3-note-preview:free` | Used on bad output, 5xx or 429 |

Two settings are per model:

- `MODEL_JSON_MODE_SLUGS`: slugs that get `response_format`.
- `MODEL_REASONING_OFF_SLUGS`: slugs that accept `reasoning: { enabled: false }`. Others get reasoning effort `low`. Hidden reasoning counts against `max_tokens`.

Every `llm_call` log line shows the configured slug (`model`) and the slug that actually answered (`served_model`). Compare them to see routing and fallbacks. Free models are throttled upstream, so expect some 429s.

Check slugs with `npm run check-models` before you deploy. Free models change or leave the free tier, so re-check the list at https://openrouter.ai/models.

## Safety

- The API key is read only on the server. Client code never sees prompts, slugs or the key.
- Traveler text and chat history are sent as delimited data, never as instructions.
- Each IP is limited to 20 requests a minute and 200 a day. This limiter is in memory. On serverless hosting each instance keeps its own count, so use a shared store (Upstash Redis or Vercel KV) for a real limit.
- `AI_DISABLED=1` stops every model call and returns the "resting" message.

## Phase status

Phase 2 (routes, LLM layer, tests) and Phase 3 (UI wired to the routes) are complete. The full flow was checked in a browser against live models: destination, single reply, debate, reroll, trip and revision, with no console errors and no requests leaving the site. The production bundle contains no key, slugs or prompt text.

To develop the UI without a key, set `NEXT_PUBLIC_MOCK_AI=1` (or `MOCK_AI=1` for the routes alone). Phase 4 adds a dev-only comparison page at `/dev/models?place=Kyoto`. It sends one destination to every model in your env file and shows the result, latency and tokens side by side. It returns 404 in production. Its model list comes from the server environment, never from the URL. Phase 5 (accessibility, responsive and smoke-test pass) is still to come.
