import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Loads .env.local so tests (e.g. the opt-in live persona smoke test) see
// the same OPENROUTER_API_KEY / STUB_PERSONA_IDS the app would, without
// requiring them to be exported in the shell too.
//
// This intentionally does NOT go through Next's own loader (@next/env):
// Vitest sets NODE_ENV=test, and @next/env deliberately skips .env.local
// under NODE_ENV=test (it only loads .env.test.local/.env.test/.env there),
// which is exactly the file this project's env vars live in.
const envLocalPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
