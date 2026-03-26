---
name: Project Status - FinOps Dashboard
description: Current build state, what's done, what's next, and what's not started (updated 2026-03-27)
type: project
---

**Why:** Building a production-grade FinOps dashboard — real GCP BigQuery billing data, AI insights via Anthropic, Redis caching, and auto-polling client.

**How to apply:** Don't re-scaffold or re-explain base structure. All core systems are live. Jump straight into the next feature layer.

## Done ✅
- Next.js 16 + React 19 + TypeScript setup
- TailwindCSS v4 + shadcn/ui (button, chart, sonner)
- Dark mode (press 'd' to toggle)
- All layout components: Header, Footer, Sidebar, Content, DataSync
- StatsSection (4 stat cards: MTD Spend, Daily Burn Rate, Projected Monthly, Previous Month)
- StatCard component (label, value, change%, trend, description)
- MainContent — Cost Drivers breakdown by category with progress bars
- ChartSection — real Recharts LineChart wired to live data via useDashboard()
- DashboardSidebar — AI insights alerts (warning/info/success) + period summary
- DashboardDataSync — toast.error() side-effect on API failure
- BigQuery API route (GET /api/bigquery) — OAuth, fetch, aggregate, cache, AI
- lib/finops-engine.ts — aggregate() + generateInsights() (Anthropic claude-haiku-4-5)
- Redis cache layer (300s TTL, graceful degradation if REDIS_URL not set)
- TanStack Query setup (lib/query-client.ts, QueryProvider)
- useApiDashboard() — TanStack useQuery → /api/bigquery
- useDashboard() — maps API payload to UI shape
- Auto-polling: refetchInterval 5min aligned with Redis TTL, paused on inactive tabs
- .claude/ config: CLAUDE.md, rules/, commands/review.md, settings.json with deny rules
- GitHub Actions CI workflow (.github/workflows/ci.yml)

## Next Up 🟡
- Drill-down views: byService, byProject, bySku (data exists in API response, not yet rendered)
- Date range filter / period selector on ChartSection
- Export report feature (QuickAction exists, not wired)
- Budget alert notifications

## Not Started ❌
- Auth / user management
- Detailed analytics sub-pages
- Pub/Sub → SSE real-time push (Option 2 live data)
- Pagination for large BigQuery datasets
- Cost optimization recommendations UI
- Docker / environment isolation (dev/staging/prod)
