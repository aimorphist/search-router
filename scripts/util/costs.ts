#!/usr/bin/env bun
import { costSummary } from "./common.ts";

const summary = costSummary();
if (Object.keys(summary).length === 0) {
  console.log("No usage recorded yet.");
  process.exit(0);
}

let totalCost = 0;
let totalQueries = 0;
for (const [provider, { cost, queries }] of Object.entries(summary).sort()) {
  console.log(`${provider}: $${cost.toFixed(4)} (${queries} queries)`);
  totalCost += cost;
  totalQueries += queries;
}
console.log(`TOTAL: $${totalCost.toFixed(4)} (${totalQueries} queries)`);
