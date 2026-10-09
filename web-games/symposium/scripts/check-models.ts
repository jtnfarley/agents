/**
 * Checks that every model slug in the environment exists on OpenRouter, and that each slug
 * listed in MODEL_JSON_MODE_SLUGS actually accepts response_format.
 * Run: npm run check-models   (reads .env.local through tsx --env-file)
 */
import { configuredSlugs } from "../src/lib/models";

interface ModelInfo {
  id: string;
  supported_parameters?: string[];
}

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) {
    console.error(`OpenRouter model list returned HTTP ${res.status}`);
    process.exit(1);
  }
  const models = ((await res.json()) as { data: ModelInfo[] }).data;
  const byId = new Map(models.map((m) => [m.id, m]));

  const slugs = configuredSlugs();
  if (slugs.length === 0) {
    console.error("No model slugs are set. Fill them in .env.local (see .env.example).");
    process.exit(1);
  }

  const jsonSlugs = new Set(
    (process.env.MODEL_JSON_MODE_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );

  let failures = 0;
  for (const slug of slugs) {
    const model = byId.get(slug);
    if (!model) {
      console.error(`MISSING  ${slug}`);
      failures++;
      continue;
    }
    const acceptsJson = model.supported_parameters?.includes("response_format") ?? false;
    if (jsonSlugs.has(slug) && !acceptsJson) {
      console.error(`NO JSON  ${slug} is in MODEL_JSON_MODE_SLUGS but does not list response_format`);
      failures++;
      continue;
    }
    console.log(`ok       ${slug}${acceptsJson ? "  (response_format)" : ""}`);
  }

  if (failures) {
    console.error(`${failures} problem(s). Fix the slugs in .env.local.`);
    process.exit(1);
  }
  console.log(`All ${slugs.length} configured slugs exist on OpenRouter.`);
}

main().catch((e) => {
  console.error("check-models failed:", (e as Error).message);
  process.exit(1);
});
