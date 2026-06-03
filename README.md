# SearchRouter

Intelligent multi-provider web search skill for Claude Code. Routes queries to the best search provider(s) based on information quality dimensions — recency, semantic depth, authority, and breadth — rather than topic categories.

## Providers

| Provider | Key required | Best for |
|----------|-------------|----------|
| **Brave** | `BRAVE_API_KEY` | General discovery, broad web search, recency filters |
| **Exa** | `EXA_API_KEY` | Semantic/conceptual search, code, academic content |
| **Tavily** | `TAVILY_API_KEY` | Agent-optimized search with clean snippets |
| **Serper** | `SERPER_API_KEY` | Google SERP results, knowledge graph, "people also ask" |
| **Wikipedia** | none | Established facts, definitions, ground truth |
| **Firecrawl** | `FIRECRAWL_API_KEY` or CLI | Full-page content extraction (drill-down, not search) |

## Requirements

- [Bun](https://bun.sh) runtime
- API keys for whichever providers you want to use (Wikipedia needs none)

## Installation

### As a Claude Code skill (global)

```bash
git clone git@github.com:aimorphist/search-router.git ~/.agents/skills/search-router
ln -s ../../.agents/skills/search-router ~/.claude/skills/search-router
```

### As a Claude Code skill (per-project)

```bash
git clone git@github.com:aimorphist/search-router.git .claude/skills/search-router
```

## Configuration

Copy the example env file and add your API keys:

```bash
cp config/providers.env.example config/providers.env
```

Edit `config/providers.env` and uncomment/set the keys you have:

```bash
BRAVE_API_KEY=your-key-here
EXA_API_KEY=your-key-here
TAVILY_API_KEY=your-key-here
SERPER_API_KEY=your-key-here
FIRECRAWL_API_KEY=your-key-here
```

Alternatively, set these as environment variables in your shell.

Optional monthly budget limits (USD) can be set to cap spending per provider:

```bash
BRAVE_MONTHLY_BUDGET=50
EXA_MONTHLY_BUDGET=30
```

## Usage

Each provider has a standalone script in `scripts/` that outputs normalized JSON:

```bash
bun scripts/brave.ts "query" [limit] [freshness]
bun scripts/exa.ts "query" [limit] [type]
bun scripts/tavily.ts "query" [limit] [search_depth]
bun scripts/serper.ts "query" [limit]
bun scripts/wikipedia.ts "query" [limit]
bun scripts/firecrawl-scrape.ts "https://url-to-scrape"
```

### Provider-specific options

- **Brave** `freshness`: `pd` (past day), `pw` (past week), `pm` (past month), `py` (past year)
- **Exa** `type`: `auto` (default), `neural` (semantic), `keyword` (traditional)
- **Tavily** `search_depth`: `basic` (default), `advanced` (slower, more thorough)

### Fan-out (parallel multi-provider search)

```bash
bun scripts/brave.ts "query" 5 > /tmp/sr-brave.json &
bun scripts/exa.ts "query" 5 > /tmp/sr-exa.json &
bun scripts/wikipedia.ts "query" 3 > /tmp/sr-wiki.json &
wait
```

## Output format

All scripts output normalized JSON to stdout:

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

## Cost tracking

Each search logs its cost to `.state/costs.jsonl`. View a summary:

```bash
bun scripts/util/costs.ts
```

## How it works as a skill

When installed, Claude Code reads the `SKILL.md` file which teaches it how to:

1. Check which API keys are available before searching
2. Route queries to the optimal provider(s) based on query characteristics
3. Fan out to multiple providers in parallel for research tasks
4. Combine and rank results across providers
5. Drill down into promising URLs with Firecrawl

The routing is automatic — Claude picks providers based on what the query needs, not what topic it's about.

## License

MIT
