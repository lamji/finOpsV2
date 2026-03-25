# Architecture — FinOps Dashboard

FinOps cloud spend tracking dashboard. Next.js 16 App Router + React 19. Data flows through `Presentation/Dashboard/useDashboard.ts` (mock fallback) → `useApiDashboard.ts` → `GET /api/bigquery` → BigQuery + Anthropic.

## Structure

```
app/
└── page.tsx                        # Shell — imports and renders <Dashboard />

Presentation/
└── Dashboard/
    ├── index.tsx                   # Full page layout — assembles feature components
    ├── useDashboard.ts             # Mock data + API fallback logic
    └── useApiDashboard.ts          # useQuery → GET /api/bigquery

components/
├── ui/                             # shadcn/ui primitives only
│   ├── button.tsx
│   ├── chart.tsx
│   └── sonner.tsx
├── DashboardHeader/index.tsx
├── DashboardContent/index.tsx
├── DashboardFooter/index.tsx
├── DashboardSidebar/index.tsx
├── StatsSection/
│   ├── index.tsx
│   └── StatCard.tsx
├── ChartSection/index.tsx
├── MainContent/index.tsx
├── ThemeProvider/index.tsx
└── QueryProvider/index.tsx

lib/
├── utils.ts                        # cn() only
├── env.ts                          # Validated env vars (zod)
├── finops-engine.ts                # aggregate() — BigQuery rows → dashboard types
├── redis.ts                        # Redis cache layer
├── logger.ts                       # Server-side logging
├── query-client.ts                 # TanStack Query client (5min staleTime, 1 retry)
└── types/
    ├── dashboard.ts                # FinancialMetric, CostDriver, Alert, QuickAction, etc.
    └── billing.ts                  # BillingRow, AggregatedDashboard, BigQueryDashboardResponse

app/api/
└── bigquery/route.ts               # GET — fetch BigQuery rows, aggregate, call Anthropic
```

## Data Flow

```
Presentation/Dashboard/useDashboard.ts
  └─ useApiDashboard() → GET /api/bigquery
        ├─ Redis cache check
        ├─ BigQuery fetch → lib/finops-engine.ts aggregate()
        ├─ Anthropic SDK (claude-haiku-4-5) → aiInsights: Alert[]
        └─ returns { statistics, charts, drilldown, aiInsights }
```

## Key Constants (useDashboard.ts)

- `MONTHLY_BUDGET = 50_000` — single source of truth, change here only
- `daysElapsed = 21`, `daysInMonth = 31` (March 2026)
