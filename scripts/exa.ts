#!/usr/bin/env bun
import { loadEnv, trackCost, checkBudget, assertOk, parseLimit, type SearchOutput } from "./util/common.ts";

const [query, limitStr = "5", type = "auto"] = Bun.argv.slice(2);
if (!query) { console.error("Usage: exa.ts <query> [limit] [type]"); process.exit(1); }

const limit = parseLimit(limitStr);
const env = loadEnv();
const apiKey = env.EXA_API_KEY ?? process.env.EXA_API_KEY;
if (!apiKey) { console.error(JSON.stringify({ error: "EXA_API_KEY not set" })); process.exit(1); }
checkBudget("exa");

const start = performance.now();

const res = await fetch("https://api.exa.ai/search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  body: JSON.stringify({
    query,
    type,
    numResults: limit,
    contents: {
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
      text: { maxCharacters: 1000 },
    },
  }),
});
await assertOk(res, "exa");

const data = await res.json() as any;
const latency = Math.round(performance.now() - start);
const cost = 0.005; // ~$5/1k requests (flat per-request estimate)

const output: SearchOutput = {
  provider: "exa",
  query,
  results: (data.results ?? []).map((r: any) => {
    const highlights = r.highlights ?? [];
    return {
      url: r.url ?? "",
      title: r.title ?? "",
      snippet: highlights.join(" ") || (r.text ?? "").slice(0, 300),
      published_date: r.publishedDate ?? "",
      relevance_score: r.score ?? 0.5,
      highlights,
    };
  }),
  cost,
  latency_ms: latency,
};

console.log(JSON.stringify(output, null, 2));
trackCost("exa", query, cost);
