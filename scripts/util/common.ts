import { existsSync, readFileSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const SKILL_DIR = join(dirname(new URL(import.meta.url).pathname), "../..");
const STATE_DIR = join(SKILL_DIR, ".state");
const COSTS_FILE = join(STATE_DIR, "costs.jsonl");
const CONFIG_FILE = join(SKILL_DIR, "config/providers.env");

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  published_date?: string;
  relevance_score?: number;
  [key: string]: any;
}

export interface SearchOutput {
  provider: string;
  query: string;
  results: SearchResult[];
  cost: number;
  latency_ms: number;
  error?: string;
  [key: string]: any;
}

/** Load providers.env as key-value pairs, with ${VAR:-default} support */
export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(CONFIG_FILE)) return env;
  for (const line of readFileSync(CONFIG_FILE, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).replace(/^export\s+/, "").trim();
    let val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    // Parse ${VAR:-default} — extract the default value
    const shellMatch = val.match(/^\$\{(\w+):-([^}]*)\}$/);
    if (shellMatch) {
      const [, envVar, defaultVal] = shellMatch;
      val = process.env[envVar] ?? defaultVal;
    }
    // Skip pure ${VAR} references with no default
    else if (/^\$\{.+\}$/.test(val)) {
      const envVar = val.slice(2, -1);
      val = process.env[envVar] ?? "";
    }
    if (val) env[key] = val;
  }
  return env;
}

/** Append a cost record to the JSONL log */
export function trackCost(provider: string, query: string, cost: number) {
  mkdirSync(STATE_DIR, { recursive: true });
  const record = JSON.stringify({
    ts: new Date().toISOString(),
    provider,
    query,
    cost,
  });
  appendFileSync(COSTS_FILE, record + "\n");
}

/** Check if a provider is within its monthly budget (only if a limit is explicitly set) */
export function checkBudget(provider: string) {
  const env = loadEnv();
  const budgetKey = `${provider.toUpperCase()}_MONTHLY_BUDGET`;
  const budgetStr = env[budgetKey] ?? process.env[budgetKey];
  if (!budgetStr) return; // no limit set, skip

  const budget = parseFloat(budgetStr);
  if (isNaN(budget)) return;

  mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(COSTS_FILE)) return;

  const month = new Date().toISOString().slice(0, 7);
  let total = 0;
  for (const line of readFileSync(COSTS_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.provider === provider && record.ts?.startsWith(month)) {
        total += record.cost;
      }
    } catch {}
  }

  if (total >= budget) {
    console.error(`Budget exceeded: ${provider} spent $${total.toFixed(4)} / $${budget.toFixed(2)}`);
    process.exit(1);
  }
}

/** Get cost summary across all providers */
export function costSummary(): Record<string, { cost: number; queries: number }> {
  if (!existsSync(COSTS_FILE)) return {};
  const summary: Record<string, { cost: number; queries: number }> = {};
  for (const line of readFileSync(COSTS_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const p = record.provider;
      if (!summary[p]) summary[p] = { cost: 0, queries: 0 };
      summary[p].cost += record.cost;
      summary[p].queries += 1;
    } catch (e) {
      console.error(`Warning: skipping malformed cost record: ${line.trim()}`);
    }
  }
  return summary;
}

/** Check HTTP response, exit with error JSON if not ok. Only track cost on success. */
export async function assertOk(res: Response, provider: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(JSON.stringify({
      error: `${provider}: ${res.status} ${res.statusText}`,
      body: body.slice(0, 500),
    }));
    process.exit(1);
  }
}

/** Parse a limit string to a validated integer */
export function parseLimit(str: string, fallback = 5): number {
  const n = parseInt(str, 10);
  if (isNaN(n) || n < 1) {
    console.error(`Invalid limit: "${str}", using default ${fallback}`);
    return fallback;
  }
  return n;
}
