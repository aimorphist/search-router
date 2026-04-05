#!/usr/bin/env bun
import { loadEnv, trackCost, checkBudget, assertOk, parseLimit, type SearchOutput } from "./util/common.ts";

const [query, limitStr = "5", searchDepth = "basic"] = Bun.argv.slice(2);
if (!query) { console.error("Usage: tavily.ts <query> [limit] [search_depth]"); process.exit(1); }

const limit = parseLimit(limitStr);
const env = loadEnv();
const apiKey = env.TAVILY_API_KEY ?? process.env.TAVILY_API_KEY;
if (!apiKey) { console.error(JSON.stringify({ error: "TAVILY_API_KEY not set" })); process.exit(1); }
checkBudget("tavily");

const start = performance.now();

const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    query,
    max_results: limit,
    search_depth: searchDepth,
    include_answer: true,
    include_raw_content: false,
  }),
});
await assertOk(res, "tavily");

const data = await res.json() as any;
const latency = Math.round(performance.now() - start);
const cost = searchDepth === "advanced" ? 0.002 : 0.001;

const output: SearchOutput & { answer?: string } = {
  provider: "tavily",
  query,
  results: (data.results ?? []).map((r: any) => ({
    url: r.url ?? "",
    title: r.title ?? "",
    snippet: r.content ?? "",
    published_date: r.published_date ?? "",
    relevance_score: r.score ?? 0.5,
  })),
  cost,
  latency_ms: latency,
};

if (data.answer) output.answer = data.answer;

console.log(JSON.stringify(output, null, 2));
trackCost("tavily", query, cost);
