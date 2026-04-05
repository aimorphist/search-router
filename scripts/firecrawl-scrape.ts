#!/usr/bin/env bun
import { loadEnv, trackCost, checkBudget, assertOk } from "./util/common.ts";

const [url] = Bun.argv.slice(2);
if (!url) { console.error("Usage: firecrawl-scrape.ts <url>"); process.exit(1); }

// Prefer firecrawl CLI if available
const which = Bun.spawnSync(["which", "firecrawl"]);
if (which.exitCode === 0) {
  const proc = Bun.spawn(["firecrawl", "scrape", url], { stdout: "inherit", stderr: "inherit" });
  const exitCode = await proc.exited;
  trackCost("firecrawl", url, 0.001);
  process.exit(exitCode);
}

// Fallback to API
const env = loadEnv();
const apiKey = env.FIRECRAWL_API_KEY ?? process.env.FIRECRAWL_API_KEY;
if (!apiKey) { console.error("Error: firecrawl CLI not found and FIRECRAWL_API_KEY not set"); process.exit(1); }
checkBudget("firecrawl");

const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({ url, formats: ["markdown"] }),
});
await assertOk(res, "firecrawl");

const data = await res.json() as any;
console.log(data.data?.markdown ?? "");
trackCost("firecrawl", url, 0.001);
