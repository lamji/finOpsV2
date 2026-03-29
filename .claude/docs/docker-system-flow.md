# Docker System Flow

## Container Topology

## Golden rule: MANDATORY
- Do not change the format
- Only adds steps
- Only re-arrange the steps if needed

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🐳 DOCKER COMPOSE CONTAINERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ui   (port 3000)  — Next.js 16 app
       ├─ Built with ARG NEXT_PUBLIC_API_URL (baked at build time)
       │    default: http://localhost:8000   (docker-compose.yml:7)
       │    override: NEXT_PUBLIC_API_URL=http://ec2-x.compute.amazonaws.com:8000
       ├─ depends_on: api
       └─ No .env.local — only NEXT_PUBLIC_API_URL + NODE_ENV + DEPLOY_ENV

  api  (port 8000)  — FastAPI (Python 3.12 + Uvicorn)
       ├─ env_file: ${ENV_FILE:-.env.local}  (root .env.local injected at runtime)
       ├─ REDIS_URL=redis://redis:6379       (hardcoded in docker-compose.yml:27)
       ├─ depends_on: redis (service_healthy)
       └─ Reads: GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY,
                 BQ_DATASET, BQ_TABLE, ANTHROPIC_API_KEY, REDIS_URL

  redis (port 6379) — Redis 7 Alpine
       ├─ healthcheck: redis-cli ping (5s interval, 3s timeout, 5 retries)
       ├─ volume: redis_data (persisted across restarts)
       └─ api waits for healthy before starting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌐 CLIENT SIDE (browser bundle — ui container)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  components/DashboardHeader/index.tsx      server component (pure UI)
  components/DashboardContent/index.tsx     server component (layout wrapper)
  components/DashboardFooter/index.tsx      server component (pure UI)
  components/StatsSection/index.tsx         "use client" (useDashboard)
  components/StatsSection/StatCard.tsx      server component child (pure UI card)
  components/MainContent/index.tsx          "use client" (useDashboard)
  components/ChartSection/index.tsx         "use client" (useDashboard + Recharts)
  components/DashboardSidebar/index.tsx     "use client" (useDashboard → period summary only)
  components/DashboardInsights/index.tsx    "use client" (useDashboard → AI alerts grid)
  components/DashboardDataSync/index.tsx    "use client" (useDashboard → toast side effects)
  components/FloatingChatbotButton/index.tsx "use client" (useDashboard → POST /api/chatbot)

  Presentation/Dashboard/
  ├─ useDashboard.ts              "use client" — maps API payload for UI consumers
  └─ useApiDashboard.ts           "use client" — useQuery() → HTTP fetch
                                               NEXT_PUBLIC_API_URL is baked at build time
                                               → GET {NEXT_PUBLIC_API_URL}/dashboard  (FastAPI)

  components/
  └─ QueryProvider/index.tsx      "use client" — TanStack QueryClientProvider

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔀 HTTP BOUNDARY  (fetch over network)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         useApiDashboard()
              │
              │  GET {NEXT_PUBLIC_API_URL}/dashboard    ← FastAPI (api container)
              ▼

         FloatingChatbotButton()
              │
              │  POST /api/chatbot                      ← Next.js route (ui container)
              ▼                                           (no FastAPI chatbot — relative URL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔒 SERVER SIDE — FastAPI  (api container, never in browser bundle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  api/app/main.py               FastAPI app — CORS + routes wired
      └─ app.include_router(dashboard.router)

  api/app/routes/dashboard.py   GET /dashboard + DELETE /dashboard
      │
      ├─ app/services/cache.py  Redis cache layer (graceful degradation)
      ├─ app/services/bigquery.py   google-cloud-bigquery SDK (not raw HTTP)
      ├─ app/services/engine.py     ★ AGGREGATOR — Python port of lib/finops-engine.ts
      └─ app/services/ai.py         generate_insights() — runs in thread pool

  api/app/config.py             Settings (pydantic-settings) — reads root .env.local
  api/app/models.py             Pydantic models — DashboardResponse, AggregatedDashboard, etc.

      └─ Anthropic SDK (anthropic Python package)
              │
              ▼
          Anthropic API (claude-haiku-4-5)  external — spend summaries,
                                                        anomaly detection,
                                                        cost-optimization recommendations
                                                        → alerts: list[Alert]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔒 SERVER SIDE — Next.js  (ui container)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app/api/chatbot/route.ts      POST — chatbot only (BigQuery route NOT used in Docker mode)
      └─ generateChatbotReply() → Anthropic SDK → string reply

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Data Flow (end-to-end Docker)

```
Browser
  ├─ useApiDashboard() [TanStack useQuery, 5min staleTime + refetchInterval]
  │       │
  │       │  GET {NEXT_PUBLIC_API_URL}/dashboard   ← FastAPI api container
  │       ▼
  │   api/app/routes/dashboard.py  GET /dashboard    [FastAPI]
  │       │
  │       ├─ [Step 1] Build cache key
  │       │   key = sha256("dashboard:{project_id}")   ← keyed by project only
  │       │   project_id = settings.GCP_PROJECT_ID     (from .env.local)
  │       │
  │       ├─ [Step 2] Redis cache check (cache.cache_get)
  │       │   ├─ noCache=True → skip Redis read, go to Step 3
  │       │   ├─ HIT  → cached["source"] = "cached"
  │       │   │          return DashboardResponse(**cached) → HTTP 200 ✓
  │       │   └─ MISS → Continue to Step 3
  │       │
  │       ├─ [Step 3] Fetch from BigQuery (bigquery.fetch_rows())
  │       │   ├─ FAILURE → raise HTTPException(503) ✗
  │       │   └─ SUCCESS → list[ServiceCostRow]
  │       │
  │       ├─ [Step 4] engine.aggregate(rows)   [api/app/services/engine.py]
  │       │   → AggregatedDashboard { statistics, charts, byService, byProject, bySku, summary }
  │       │
  │       ├─ [Step 5] await _run_insights(aggregated)
  │       │   └─ loop.run_in_executor(None, ai.generate_insights, aggregated)
  │       │         → ai.generate_insights() in thread pool [api/app/services/ai.py]
  │       │              → Anthropic SDK (claude-haiku-4-5) → list[Alert]
  │       │              → [] on any error (non-fatal)
  │       │
  │       ├─ [Step 6] Build and cache response
  │       │   payload = DashboardResponse(status=200, source="db", ...)
  │       │   cache.cache_set(key, payload.model_dump_json(), TTL_DEFAULT=300)
  │       │
  │       └─ [Step 7] Return DashboardResponse
  │                 {
  │                   status:     200,
  │                   source:     "cached" | "db",
  │                   statistics: list[FinancialMetric],  ← 4 stat cards
  │                   charts:     list[ChartDataPoint],   ← 12 months zero-filled (Jan–Dec)
  │                   byService:  list[CostDriver],       ← services ranked by spend DESC
  │                   byProject:  list[CostDriver],       ← projects ranked by spend DESC
  │                   bySku:      list[CostDriver],       ← top 20 SKUs
  │                   summary:    FinancialSummary,       ← period, days elapsed/remaining
  │                   aiInsights: list[Alert]             ← AI-generated by claude-haiku-4-5
  │                 }
  │                       │
  │                       ▼
  │             useDashboard() maps payload
  │             → financialOverview, summary, byService, byProject, bySku,
  │               charts, alerts, isLoading, isError, error
  │                       │
  │                       ▼
  │             components render ✓
  │             ├─ StatsSection       (financialOverview)
  │             ├─ MainContent        (byService, byProject, bySku, charts)
  │             ├─ DashboardInsights  (alerts → AI alerts grid)
  │             ├─ DashboardSidebar   (summary → period summary only)
  │             └─ DashboardDataSync  (isError → toast.error side effect)
  │
  └─ FloatingChatbotButton() [useDashboard → ChatbotContext]
          │
          │  POST /api/chatbot   { message, context: ChatbotContext }
          ▼
    app/api/chatbot/route.ts     [Next.js — ui container]
          │
          ├─ Guard: PROMPT_PATTERNS   → blocked: true
          ├─ Guard: CODE_PATTERNS     → blocked: true
          ├─ Guard: no FINOPS signal  → blocked: true
          │
          └─ generateChatbotReply(message, context)  [lib/finops-engine.ts]
                  └─ Anthropic SDK (claude-haiku-4-5)
                          → reply: string (max 120 words, FinOps-only)
                          → return { message: string, blocked: false }
```

---

# FastAPI Dashboard Route Flow (internal detail)

```
GET /dashboard?noCache=false
    │
    ├─ [Step 1] Build cache key  (routes/dashboard.py:15-17)
    │   raw     = f"dashboard:{project_id}"
    │   key     = hashlib.sha256(raw.encode()).hexdigest()
    │   └─ NOTE: keyed by project_id only — not query string (unlike TS sha256(query+projectId))
    │
    ├─ [Step 2] Redis cache check  (routes/dashboard.py:30-35)
    │   ├─ noCache=True → skip, continue to Step 3
    │   ├─ HIT  cached = cache.cache_get(key)
    │   │        cached["source"] = "cached"
    │   │        return DashboardResponse(**cached)  → HTTP 200 ✓ (skip Steps 3–6)
    │   └─ MISS → Continue to Step 3
    │
    ├─ [Step 3] BigQuery fetch  (routes/dashboard.py:38-42)
    │   try:
    │     rows = bigquery.fetch_rows()       [services/bigquery.py:96]
    │   except Exception as e:
    │     raise HTTPException(status_code=503, detail=...)
    │   ├─ FAILURE → HTTP 503 ✗
    │   └─ SUCCESS → list[ServiceCostRow]
    │
    │   bigquery.fetch_rows()  [services/bigquery.py:96]
    │   ├─ [BQ Step 1] Resolve table + current year  (bigquery.py:102-103)
    │   │   current_year = datetime.now().year
    │   │   table = f"`{GCP_PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`"
    │   │
    │   ├─ [BQ Step 2] Build cost expression  (bigquery.py:111-115)
    │   │   _INCLUDE_CREDITS = False  ← matches TS inCludeCredits = false
    │   │   cost_expr = "cost"        (no credit deduction)
    │   │
    │   ├─ [BQ Step 3] Build SQL  (bigquery.py:133-143)
    │   │   SELECT invoice.month, service.description, project.name,
    │   │          project.id, sku.description, SUM(cost) AS effective_cost
    │   │   FROM `{project}.{dataset}.{table}`
    │   │   WHERE invoice.month LIKE '{current_year}%'
    │   │   GROUP BY 1, 2, 3, 4, 5
    │   │
    │   ├─ [BQ Step 4] Auth + execute  (bigquery.py:152-153)
    │   │   _get_client()
    │   │   ├─ _normalize_private_key(settings.GCP_PRIVATE_KEY)
    │   │   │   handles: strip whitespace → strip quotes → unescape \\n → fix CRLF
    │   │   │            validate PEM header/footer → ensure trailing \n
    │   │   ├─ service_account.Credentials.from_service_account_info(...)
    │   │   │   scopes: ["https://www.googleapis.com/auth/bigquery"]
    │   │   └─ bigquery.Client(project=GCP_PROJECT_ID, credentials=credentials)
    │   │        └─ NOTE: Python SDK — NOT raw HTTP fetch (no manual OAuth token needed)
    │   │                 SDK handles token acquisition and auto-refresh internally
    │   │   client.query(query).result()   ← BLOCKS until BigQuery job completes
    │   │   └─ NOTE: No polling loop needed — .result() handles job completion
    │   │
    │   └─ [BQ Step 5] Map to ServiceCostRow models  (bigquery.py:164-174)
    │       [ServiceCostRow(invoice_month, service_description, project_name,
    │                       project_id, sku_description, effective_cost=float(row.effective_cost or 0))
    │        for row in results]
    │       └─ effective_cost: fallback to 0.0 if None (safe for float arithmetic in engine)
    │
    ├─ [Step 4] Aggregate  (routes/dashboard.py:45)
    │   aggregated = engine.aggregate(rows)      [services/engine.py:141]
    │   └─ AggregatedDashboard { statistics[4], charts[12], byService, byProject, bySku, summary }
    │        └─ NOTE: charts = 12 entries always (Jan–Dec zero-filled)
    │                 TS charts = last N months from data (no zero-fill for missing months)
    │
    ├─ [Step 5] AI insights in thread pool  (routes/dashboard.py:48)
    │   insights = await _run_insights(aggregated)
    │   └─ loop.run_in_executor(None, ai.generate_insights, aggregated)
    │         └─ ai.generate_insights(aggregated)   [services/ai.py:17]  [blocking, in thread]
    │               ├─ Guard: ANTHROPIC_API_KEY not set → return []
    │               ├─ client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    │               ├─ Build prompt (same structure as TS generateInsights)
    │               │   SPEND DATA: MTD, burn rate, projected, prev month, days elapsed
    │               │   BY SERVICE: fmt(aggregated.byService)
    │               │   BY PROJECT: fmt(aggregated.byProject)
    │               │   TOP SKUs:   fmt(aggregated.bySku[:10])
    │               │   Output: raw JSON array only (no markdown, no explanation)
    │               ├─ client.messages.create(model="claude-haiku-4-5", max_tokens=1024, ...)
    │               ├─ Strip ```json fences if present
    │               ├─ json.loads(text) → [Alert(**item) for item in parsed]
    │               └─ [CATCH] any error → return []  (non-fatal)
    │
    ├─ [Step 6] Build + cache response  (routes/dashboard.py:51-65)
    │   payload = DashboardResponse(status=200, source="db", ...)
    │   cache.cache_set(key, json.loads(payload.model_dump_json()), TTL_DEFAULT=300)
    │   └─ NOTE: no rawPayload field — DashboardResponse is the canonical model (no extras)
    │
    └─ [Step 7] Return DashboardResponse  → HTTP 200 ✓

[CATCH] routes/dashboard.py raises HTTPException with status_code
  BigQuery failure → 503
  Any other unhandled error → FastAPI default 500

DELETE /dashboard — flush entire Redis cache  (routes/dashboard.py:70-80)
  └─ cache._get_client().flushall()
  └─ return { "status": 200, "message": "Redis cache flushed" }
  └─ [CATCH] → HTTP 500 ✗
```

## Redis Design Notes (FastAPI)

| Concern        | Decision                                                                         |
|----------------|----------------------------------------------------------------------------------|
| Cache key      | `sha256("dashboard:{project_id}")` — project-scoped only (simpler than TS)      |
| Stored value   | Full `DashboardResponse` JSON (aggregated + aiInsights, no raw rows stored)      |
| Default TTL    | 300s (5 min) — matches TS TTL.DEFAULT                                            |
| Error caching  | Never cache — only write after successful BigQuery fetch + aggregation           |
| Cache bypass   | `?noCache=true` query param skips both read and write                            |
| Redis failure  | Non-fatal — `_get_client()` returns None, all ops are no-ops (graceful degrade)  |
| Cache flush    | `DELETE /dashboard` → `client.flushall()` — clears entire Redis keyspace         |
| Connection     | `redis.from_url(settings.REDIS_URL)` — lazy singleton, ping on first connect     |

## Key Differences vs Vercel Flow

| Concern              | Docker / FastAPI                              | Vercel / Next.js                                     |
|----------------------|-----------------------------------------------|------------------------------------------------------|
| Dashboard endpoint   | `GET {API_URL}/dashboard` (FastAPI)           | `GET /api/bigquery` (Next.js route)                  |
| Language             | Python 3.12 + FastAPI + Uvicorn               | TypeScript + Next.js Route Handler                   |
| BigQuery auth        | `google-cloud-bigquery` SDK (auto token)      | `google-auth-library` + manual Bearer token          |
| Job completion       | `.result()` blocks until done (SDK handles)   | Polling loop up to 10× with 2s waits                 |
| Private key handling | `_normalize_private_key()` (5-step sanitiser) | `.replace(/\\n/g, "\n")` (single replace)            |
| Cache key            | `sha256("dashboard:{project_id}")`            | `sha256(query + projectId)`                          |
| Cache stored value   | Full `DashboardResponse` (no raw rows)        | `CachedPayload` with raw rows + aggregated + insights |
| Chart data           | 12 months always, zero-filled (Jan–Dec)       | Last N months from data (variable length)            |
| AI insights          | Blocking call in thread pool (run_in_executor)| Async `await generateInsights()` in route handler    |
| Response extras      | No `rawPayload` field                         | Includes `rawPayload` (normalized rows)              |
| Chatbot              | Not in FastAPI — handled by Next.js `/api/chatbot` | Same Next.js `/api/chatbot` route                |
| CORS                 | Explicit CORS middleware in FastAPI           | Next.js handles same-origin by default               |
