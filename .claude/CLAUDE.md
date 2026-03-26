# FinOps Dashboard

## Commands
- Dev: `npm run dev` (Turbopack, http://localhost:3000)
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format: `npm run format`
- Add shadcn component: `npx shadcn@latest add [name]`

## What This Is
FinOps cloud spend tracking dashboard. Queries live GCP BigQuery billing export, aggregates cost data, generates AI insights via Anthropic (`claude-haiku-4-5`), and renders a real-time dashboard. Budget: $50k/month (March 2026).

## Structure (non-obvious parts)

```
app/[page]/page.tsx          # Shell ONLY — one import + one return. No logic.
Presentation/[Page]/         # All page layout, state, and API hooks live here
  ├── index.tsx              # Full page layout
  ├── use[Page].ts           # Maps API data → UI shape
  └── useApi[Page].ts        # TanStack useQuery → /api/bigquery
components/[Name]/index.tsx  # Feature components — never flat files
lib/types/                   # ALL types here — never inline in components
  ├── dashboard.ts           # FinancialMetric, CostDriver, Alert, QuickAction
  └── billing.ts             # BillingRow, AggregatedDashboard, BigQueryDashboardResponse
lib/finops-engine.ts         # aggregate() + generateInsights() — server-only
lib/env.ts                   # Zod-validated env vars — NEVER use process.env directly
lib/redis.ts                 # Cache layer — graceful degradation if REDIS_URL not set
app/api/bigquery/route.ts    # Single API entry point — BigQuery + Redis + Anthropic
```

## Data Flow
```
useApiDashboard() [TanStack useQuery, 5min staleTime + refetchInterval]
  → GET /api/bigquery
    → Redis cache check (300s TTL)
    → BigQuery fetch → aggregate() → generateInsights() [Anthropic]
    → { statistics, charts, drilldown, byService, byProject, bySku, aiInsights }
  → useDashboard() maps payload → components
```

## Key Constants
- `MONTHLY_BUDGET = 50_000` — in `lib/finops-engine.ts` only, change here
- Redis TTL: 300s default, 1800s heavy, 0 = skip cache
- Polling: `refetchInterval: 5 * 60 * 1000` (aligned with Redis TTL)

## First-time Setup (required after cloning)
```bash
git config core.hooksPath .githooks   # activate branch protection hooks
```
This blocks direct pushes to `staging` and `production` from any terminal.

## Hard Rules
- Types ONLY in `lib/types/[feature].ts` — never inline
- `process.env` NEVER in components — always `lib/env.ts`
- `"use client"` only when truly needed (hooks, events, browser APIs)
- Semantic color tokens only — no hardcoded colors, dark mode mandatory
- Lucide React icons exclusively — no emojis, no unicode
- TailwindCSS only — no inline styles, no CSS modules
- Absolute imports only — `@/components/`, `@/lib/`, `@/Presentation/`
- Never extend data sources — use `useDashboard()` / `useApiDashboard()` exclusively
- Never modify: `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `package.json`

## Styling Tokens
| Token | Use for |
|-------|---------|
| `bg-background` | Page background |
| `bg-card` | Card surfaces |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/helper text |
| `border-border` | Borders and dividers |
| `bg-accent` | Hover states |

Trend colors: `text-green-600 dark:text-green-400` (up), `text-red-600 dark:text-red-400` (down)

## shadcn/ui Installed
`button`, `chart` (Recharts wrapper), `sonner` (toast)

## Project Docs (auto-loaded at session start via `.claude/docs/`)
| File | Content |
|------|---------|
| `docs/architecture.md` | Directory structure, data flow, key constants |
| `docs/conventions.md` | Icons, imports, types, styling, dark mode, naming |
| `docs/stack.md` | Dependencies, TanStack Query, hard rules |
| `docs/flow.md` | Full system flow — client/server boundary map |
| `docs/bigquery-api-flow.md` | Step-by-step trace of `/api/bigquery` |
| `docs/finops-engine-flow.md` | Full trace of `aggregate()` + `generateInsights()` |
| `docs/last-month-spend.md` | Stat cards reference, period derivation, edge cases |
| `docs/bigquery-schema.md` | Real BigQuery billing row schema |
| `docs/components.md` | All components and hooks inventory |

> To add project knowledge: drop a `.md` file in `.claude/docs/` — auto-loaded next session.
