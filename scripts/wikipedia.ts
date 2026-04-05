#!/usr/bin/env bun
import { assertOk, parseLimit, type SearchOutput } from "./util/common.ts";

const [query, limitStr = "3"] = Bun.argv.slice(2);
if (!query) { console.error("Usage: wikipedia.ts <query> [limit]"); process.exit(1); }

const limit = parseLimit(limitStr, 3);
const start = performance.now();

const params = new URLSearchParams({
  action: "query",
  list: "search",
  srsearch: query,
  srlimit: String(limit),
  srprop: "snippet|timestamp|titlesnippet",
  format: "json",
});

const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
await assertOk(res, "wikipedia");

const data = await res.json() as any;
const latency = Math.round(performance.now() - start);

const output: SearchOutput = {
  provider: "wikipedia",
  query,
  results: (data.query?.search ?? []).map((r: any) => ({
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title ?? "").replace(/%20/g, "_")}`,
    title: r.title ?? "",
    snippet: (r.snippet ?? "").replace(/<[^>]+>/g, ""),
    published_date: r.timestamp ?? "",
    relevance_score: 0.8,
  })),
  cost: 0,
  latency_ms: latency,
};

console.log(JSON.stringify(output, null, 2));
