#!/usr/bin/env bun
import { loadEnv, trackCost, checkBudget, assertOk, parseLimit, type SearchOutput } from "./util/common.ts";

const [query, limitStr = "5", freshness] = Bun.argv.slice(2);
if (!query) { console.error("Usage: brave.ts <query> [limit] [freshness]"); process.exit(1); }

const limit = parseLimit(limitStr);
const env = loadEnv();
const apiKey = env.BRAVE_API_KEY ?? process.env.BRAVE_API_KEY;
if (!apiKey) { console.error(JSON.stringify({ error: "BRAVE_API_KEY not set" })); process.exit(1); }
checkBudget("brave");

const start = performance.now();
const params = new URLSearchParams({ q: query, count: String(limit) });
if (freshness) params.set("freshness", freshness);

const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
  headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
});
await assertOk(res, "brave");

const data = await res.json() as any;
const latency = Math.round(performance.now() - start);
const cost = 0.005; // $5/1k requests (flat per-request)

const output: SearchOutput = {
  provider: "brave",
  query,
  results: (data.web?.results ?? []).map((r: any) => ({
    url: r.url ?? "",
    title: r.title ?? "",
    snippet: r.description ?? "",
    published_date: r.page_age ?? "",
    relevance_score: 0.7,
    extra_snippets: r.extra_snippets ?? [],
  })),
  cost,
  latency_ms: latency,
};

console.log(JSON.stringify(output, null, 2));
trackCost("brave", query, cost);
