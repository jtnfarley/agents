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

Each task has its own variable, and each falls back to `MODEL_DEFAULT`. Chat can also set a model per guide with `MODEL_GUIDE_LOCAL` and `MODEL_GUIDE_TOURIST`. These are the slugs verified in Phase 2 (run `npm run check-models` to re-check):

| Variable | Suggested slug | Why |
|---|---|---|
| `MODEL_DEFAULT` | `anthropic/claude-sonnet-5.5` | Strong general model, used when a task has no slug |
| `MODEL_DESTINATION` | `anthropic/claude-sonnet-5.5` | Creative and reliable JSON for the two guides |
| `MODEL_REROLL` | `deepseek/deepseek-v4-flash` | Fast and very cheap |
| `MODEL_CHAT` | `google/gemini-3.5-flash-lite` | Quick single replies |
| `MODEL_DEBATE` | `anthropic/claude-sonnet-5.5` | Strong writing for the four-turn argument |
| `MODEL_TRIP` | `x-ai/grok-4.3` | Follows the itinerary structure |
| `MODEL_FALLBACK` | `openai/gpt-6-luna` | One retry on bad output, 5xx or 429 |
| `MODEL_GUIDE_LOCAL` / `MODEL_GUIDE_TOURIST` | empty | Optional: give each guide its own voice in chat |

Set `MODEL_JSON_MODE_SLUGS` to the comma-separated slugs above. Only listed slugs get `response_format`.

Model slugs change. Check them at https://openrouter.ai/models before you deploy.

## Safety

- The API key is read only on the server. Client code never sees prompts, slugs or the key.
- Traveler text and chat history are sent as delimited data, never as instructions.
- Each IP is limited to 20 requests a minute and 200 a day. This limiter is in memory. On serverless hosting each instance keeps its own count, so use a shared store (Upstash Redis or Vercel KV) for a real limit.
- `AI_DISABLED=1` stops every model call and returns the "resting" message.

## Phase status

Phase 2 is complete: the routes, the LLM layer and the tests are in place, and live calls were checked with the slugs above. The UI still runs on mock fixtures on the client until Phase 3 wires it to `fetch`.
