---
name: search-router
description: |
  Intelligent multi-provider web search for AI agents. Routes queries to the best
  search provider(s) based on information quality dimensions (recency, semantic depth,
  authority, breadth) rather than topic categories. Supports Brave, Exa, Tavily, Serper,
  Wikipedia, and Firecrawl for drill-down scraping. Use when the user wants to search
  the web, research a topic, compare options, look something up, or find information.
  Provides smarter results than any single search provider by fan-out and combination.
triggers:
  - search for
  - look up
  - find information
  - research
  - web search
  - search the web
  - search router
allowed-tools:
  - Bash(bun *)
  - Bash(firecrawl *)
---

# SearchRouter — Intelligent Multi-Provider Search

You have access to multiple search providers via Bun TypeScript scripts in this skill's
`scripts/` directory. Choose the right provider(s) based on what the query
**needs**, not what topic it's about.

## Quick Start

```bash
# Simple search (default: Brave)
bun scripts/brave.ts "your query" 5

# Semantic search
bun scripts/exa.ts "your query" 5

# Fan-out: run providers in parallel
bun scripts/brave.ts "query" 5 > /tmp/sr-brave.json &
bun scripts/exa.ts "query" 5 > /tmp/sr-exa.json &
bun scripts/wikipedia.ts "query" 3 > /tmp/sr-wiki.json &
wait
# Then read all result files and synthesize
```

All scripts are in the skill directory. Use the full path from the skill's location,
e.g., if this skill is at `/path/to/search-router/`, run:
`bash /path/to/search-router/scripts/brave.ts "query" 5`

## Available Providers

### Brave Search (`scripts/brave.ts`)
- **Best for**: General web search, broad discovery, decent recency
- **Strengths**: Independent 30B page index, fast, cheap ($5/1k queries)
- **Weaknesses**: No semantic/similarity search, snippets only (no full content)
- **Use when**: Default for most queries. Good all-rounder.
- **Usage**: `bun scripts/brave.ts "query" [limit] [freshness]`
  - freshness: `pd` (past day), `pw` (past week), `pm` (past month), `py` (past year)

### Exa Search (`scripts/exa.ts`)
- **Best for**: Semantic/conceptual search, "find things like this", code, academic
- **Strengths**: Neural index, highlights feature extracts relevant excerpts (saves tokens),
  specialized indexes (people, companies, code, academic)
- **Weaknesses**: Poor recency — may miss pages published in last few days
- **Use when**: Query is conceptual, exploratory, needs semantic matching, or is about
  finding similar/related things. Great for code and academic content.
- **Usage**: `bun scripts/exa.ts "query" [limit] [type]`
  - type: `auto` (default), `neural` (semantic), `keyword` (traditional)

### Tavily Search (`scripts/tavily.ts`)
- **Best for**: Agent-optimized search with clean snippets, quick answers
- **Strengths**: Returns aggregated content from multiple sources, search_depth control,
  includes answer field for direct responses
- **Weaknesses**: Opaque backend (doesn't disclose index source), snippets may need
  supplementary scraping for full content
- **Use when**: Want quick, clean results optimized for LLM consumption. Good general fallback.
- **Usage**: `bun scripts/tavily.ts "query" [limit] [search_depth]`
  - search_depth: `basic` (default, fast), `advanced` (slower, more thorough)

### Serper (`scripts/serper.ts`)
- **Best for**: Google SERP results — familiar ranking, broad coverage
- **Strengths**: Returns actual Google results, includes knowledge graph, people also ask
- **Weaknesses**: Google SERP wrapper (not independent index), snippets only
- **Use when**: Want Google-quality ranking, or need knowledge graph / PAA data.
- **Usage**: `bun scripts/serper.ts "query" [limit]`

### Wikipedia (`scripts/wikipedia.ts`)
- **Best for**: Established facts, ground truth concepts, definitions
- **Strengths**: Authoritative, structured, free, no API key needed
- **Weaknesses**: No recent events, no opinion/community content, no niche topics
- **Use when**: Query needs grounded factual basis. Pair with other providers for anchoring.
- **Usage**: `bun scripts/wikipedia.ts "query" [limit]`

### Firecrawl Scrape (`scripts/firecrawl-scrape.ts`)
- **Not a search provider** — use for drill-down after finding URLs via other providers
- **Best for**: Extracting full page content as clean markdown
- **Usage**: `bun scripts/firecrawl-scrape.ts "https://url"`

## Routing Framework

Before searching, assess the query along these quality dimensions:

| Dimension | Low (0) | High (1) | Best Provider |
|-----------|---------|----------|--------------|
| **Recency** | Timeless fact | Breaking/today | Brave (freshness=pd) or Tavily |
| **Semantic** | Keyword match fine | Conceptual/similarity | Exa (neural) |
| **Authority** | Any source fine | Official/peer-reviewed | Wikipedia + Exa academic |
| **Depth** | Snippet sufficient | Need full page content | Firecrawl scrape on results |
| **Breadth** | Single best answer | Many perspectives needed | Fan-out: Brave + Exa |

### Decision Logic

**Quick (single provider)** — simple factual lookups, well-defined queries:
- Default: Brave
- Conceptual/semantic: Exa
- Grounding a concept: Wikipedia
- Quick LLM-ready answer: Tavily

**Research (2-3 providers in parallel)** — compare, explore, multi-faceted:
- Brave (breadth + recency) + Exa (semantic depth) is the most valuable combo
- Add Wikipedia when grounding established concepts
- Add Serper when you specifically want Google's ranking perspective
- Run in parallel with `&` + `wait`, then synthesize across result sets

**Deep (all relevant providers + drill-down)** — thorough investigation:
- Fan out to 2-3 search providers in parallel
- Review combined results
- Select the most promising URLs
- Drill down via `firecrawl-scrape.sh` on selected URLs
- Synthesize across all sources with full content

### Result Combination

When you have results from multiple providers:
1. Read all result JSON files
2. Group by URL — results appearing in multiple providers are more likely relevant
3. Rank by: relevance to query > recency (if needed) > source authority
4. Filter out opinion/forum sources when authority is important
5. Present top results with provider attribution
6. Offer drill-down on the most interesting URLs

## Script Conventions

All search scripts output normalized JSON to stdout:
```json
{
  "provider": "brave",
  "query": "original query",
  "results": [
    {
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "published_date": "2026-04-01",
      "relevance_score": 0.85
    }
  ],
  "cost": 0.005,
  "latency_ms": 342
}
```

Each script also logs cost to `.state/costs.jsonl` in the skill directory.

## Cost Tracking

```bash
# Check spend by provider
bun scripts/util/costs.ts

# Check if a provider is within budget
bun scripts/util/costs.ts
```

## Environment Variables

Set these in your shell or in `config/providers.env`:
- `BRAVE_API_KEY` — required for Brave
- `EXA_API_KEY` — required for Exa
- `TAVILY_API_KEY` — required for Tavily
- `SERPER_API_KEY` — required for Serper
- `FIRECRAWL_API_KEY` — required for Firecrawl scrape (or use authenticated CLI)
