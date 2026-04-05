#!/usr/bin/env bun
import { loadEnv, trackCost, checkBudget, assertOk, parseLimit, type SearchOutput } from "./util/common.ts";

const [query, limitStr = "5"] = Bun.argv.slice(2);
if (!query) { console.error("Usage: serper.ts <query> [limit]"); process.exit(1); }

const limit = parseLimit(limitStr);
const env = loadEnv();
const apiKey = env.SERPER_API_KEY ?? process.env.SERPER_API_KEY;
if (!apiKey) { console.error(JSON.stringify({ error: "SERPER_API_KEY not set" })); process.exit(1); }
checkBudget("serper");

const start = performance.now();

const res = await fetch("https://google.serper.dev/search", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
  body: JSON.stringify({ q: query, num: limit }),
});
await assertOk(res, "serper");

const data = await res.json() as any;
const latency = Math.round(performance.now() - start);
const cost = 0.001; // ~$1/1k queries

const output: SearchOutput & { knowledge_graph?: any; people_also_ask?: any[] } = {
  provider: "serper",
  query,
  results: (data.organic ?? []).map((r: any) => ({
    url: r.link ?? "",
    title: r.title ?? "",
    snippet: r.snippet ?? "",
    published_date: r.date ?? "",
    relevance_score: 0.7,
    position: r.position ?? 0,
  })),
  cost,
  latency_ms: latency,
};

if (data.knowledgeGraph) {
  output.knowledge_graph = {
    title: data.knowledgeGraph.title ?? "",
    type: data.knowledgeGraph.type ?? "",
    description: data.knowledgeGraph.description ?? "",
  };
}

if (data.peopleAlsoAsk?.length) {
  output.people_also_ask = data.peopleAlsoAsk.slice(0, 3).map((p: any) => ({
    question: p.question ?? "",
    answer: p.snippet ?? "",
  }));
}

console.log(JSON.stringify(output, null, 2));
trackCost("serper", query, cost);
