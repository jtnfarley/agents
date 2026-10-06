import { notFound } from "next/navigation";
import { compareModel, openRouterComplete, type Comparison } from "@/lib/llm";
import { specForSlug, configuredSlugs } from "@/lib/models";
import { destinationPrompt, pickTemps } from "@/lib/prompts";
import { destinationOutput } from "@/lib/schemas";
import { str } from "@/lib/text";

/**
 * Dev-only model comparison (section 5). The same destination goes to every model in
 * .env.local, side by side. The model list comes from env on the server, never from the URL.
 */
export const dynamic = "force-dynamic";

function summary(row: Comparison): string {
  if (!row.ok) return row.outcome;
  const v = row.value as { error?: string; city?: string; tagline?: string; local?: { name?: string }; tourist?: { name?: string } };
  if (v.error) return `returned ${v.error}`;
  return `${v.city ?? "?"}: ${v.local?.name ?? "?"} and ${v.tourist?.name ?? "?"}. ${v.tagline ?? ""}`;
}

export default async function DevModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { place } = await searchParams;
  const input = str(place ?? "Lisbon", 60) || "Lisbon";
  const slugs = configuredSlugs();
  const prompt = destinationPrompt(input, pickTemps([]));

  const rows = await Promise.all(
    slugs.map((slug) =>
      compareModel(openRouterComplete, specForSlug(slug, "destination"), "destination", prompt, destinationOutput),
    ),
  );

  return (
    <div className="app">
      <header className="top">
        <h1>Model comparison</h1>
        <p className="lede">
          Dev only. This page is not served in production. The same destination goes to each model in your env file, with the
          production parsing and validation but no fallback. Set models in .env.local and reload.
        </p>
      </header>

      <form className="entry" action="/dev/models" method="get">
        <label className="label" htmlFor="place">
          Destination
        </label>
        <div className="row-form">
          <input id="place" name="place" type="text" maxLength={60} defaultValue={input} />
          <button className="btn" type="submit">
            Compare
          </button>
        </div>
      </form>

      <section className="panel" aria-labelledby="cmpTitle">
        <h2 id="cmpTitle">
          {slugs.length} models for &ldquo;{input}&rdquo;
        </h2>
        <div className="cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Result</th>
                <th scope="col">Latency</th>
                <th scope="col">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className={row.ok ? "" : "bad"}>
                  <td className="mono-cell">{row.slug}</td>
                  <td>{summary(row)}</td>
                  <td className="num">{(row.latencyMs / 1000).toFixed(1)}s</td>
                  <td className="num">{row.totalTokens ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
