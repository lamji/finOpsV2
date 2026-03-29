# FinOps Full System Flow

## Server / Client Boundary Map

## Golden rule: MANDATORY
- Do not change the format
- Only adds steps
- Only re-arrange the steps if needed

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌐 CLIENT SIDE (browser bundle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  components/DashboardHeader/index.tsx      server component (pure UI)
  components/DashboardContent/index.tsx     server component (layout wrapper)
  components/DashboardFooter/index.tsx      server component (pure UI)
  components/StatsSection/index.tsx         "use client" (useDashboard)
  components/StatsSection/StatCard.tsx      server component child (pure UI card)
  components/MainContent/index.tsx          "use client" (useDashboard)
  components/ChartSection/index.tsx         "use client" (useDashboard + Recharts)
  components/DashboardSidebar/index.tsx     "use client" (useDashboard → period summary only)
  components/DashboardInsights/index.tsx    "use client" (useDashboard → AI alerts grid) ← NEW
  components/DashboardDataSync/index.tsx    "use client" (useDashboard → toast side effects)
  components/FloatingChatbotButton/index.tsx "use client" (useDashboard → POST /api/chatbot) ← NEW

  Presentation/Dashboard/
  ├─ useDashboard.ts              "use client" — maps API payload for UI consumers
  └─ useApiDashboard.ts           "use client" — useQuery() → HTTP fetch
                                               supports NEXT_PUBLIC_API_URL → FastAPI /dashboard
                                               fallback → /api/bigquery (Next.js route)

  components/
  └─ QueryProvider/index.tsx      "use client" — TanStack QueryClientProvider

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔀 HTTP BOUNDARY  (fetch over network)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         useApiDashboard()
              │
              ├── if NEXT_PUBLIC_API_URL set
              │       GET {NEXT_PUBLIC_API_URL}/dashboard   ← FastAPI service
              └── else
                      GET /api/bigquery                     ← unified payload (aggregated data + AI alerts)

         FloatingChatbotButton()
              │
              │  POST /api/chatbot   ← user message + ChatbotContext
              ▼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔒 SERVER SIDE (never in browser bundle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  app/api/bigquery/route.ts       GET — fetches, aggregates, caches, adds AI alerts
                                  DELETE — flushes entire Redis cache (redisFlushAll) ← NEW
      │
      ├─ lib/finops-engine.ts     ★ AGGREGATOR (server-only)
      │   ├─ aggregate(rows)      → { statistics, charts, byService, byProject, bySku, summary }
      │   ├─ generateInsights()   → Alert[]
      │   └─ generateChatbotReply(question, context) → string  ← NEW
      │
      ├─ Redis cache              external — cached dashboard response parts
      │
      ├─ Google BigQuery API      external — GCP billing export
      │
      └─ Anthropic SDK (direct call inside route + finops-engine)
              │  import Anthropic from "@anthropic-ai/sdk"
              ▼
          Anthropic API (claude-haiku-4-5)  external — spend summaries,
                                                        anomaly detection,
                                                        cost-optimization recommendations
                                                        → alerts: Alert[]
                                                        → chatbot replies: string  ← NEW

  app/api/chatbot/route.ts        POST — validates message, guards code/prompt injection,
                                         calls generateChatbotReply() → string reply ← NEW

  lib/env.ts                      server-only env var access
  lib/logger.ts                   server-only logging
  lib/query-client.ts             TanStack client config (shared)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Data Flow (end-to-end)

```
Browser
  ├─ useApiDashboard() [TanStack useQuery, 5min staleTime + refetchInterval]
  │       │
  │       ├── if NEXT_PUBLIC_API_URL set
  │       │       GET {NEXT_PUBLIC_API_URL}/dashboard   ← FastAPI service
  │       └── else
  │               GET /api/bigquery                     [SERVER]
  │                     │
  │                     ├─ [Step 3.5] Redis HIT
  │                     │       ├─ if cached.aggregated + cached.aiInsights exist
  │                     │       │    → return unified payload immediately → HTTP 200 ✓
  │                     │       └─ else legacy cache entry
  │                     │            aggregate(cached.rows)
  │                     │            → call Anthropic SDK → alerts: Alert[]
  │                     │            → upgrade Redis cache entry
  │                     │            → return unified payload → HTTP 200 ✓
  │                     │
  │                     ├─ [Steps 4–10] Redis MISS → fetch from BigQuery
  │                     │
  │                     ├─ [Step 11.5] aggregate(rows) via lib/finops-engine.ts
  │                     │       → { statistics, charts, byService, byProject, bySku, summary }
  │                     │
  │                     ├─ [Step 11.6] call Anthropic SDK directly (claude-haiku-4-5)
  │                     │       prompt = aggregated snapshot (MTD, burn rate, cost drivers)
  │                     │       → alerts: Alert[]  ← AI-generated only, no rule-based alerts
  │                     │
  │                     ├─ [Step 11.7] write full dashboard cache parts to Redis
  │                     │       rows + aggregated + aiInsights
  │                     │
  │                     └─ [Step 12] return unified payload
  │                               {
  │                                 status:     200 | 400 | 401 | 500 | 503 | 504,
  │                                 source:     "cached" | "db",
  │                                 statistics: FinancialMetric[],   ← 4 stat cards
  │                                 charts:     ChartDataPoint[],    ← monthly spend
  │                                 byService:  CostDriver[],        ← cost breakdown by raw service
  │                                 byProject:  CostDriver[],        ← cost breakdown by project
  │                                 bySku:      CostDriver[],        ← top 20 SKUs
  │                                 summary:    FinancialSummary,    ← period, days elapsed/remaining
  │                                 aiInsights: Alert[],             ← AI-generated by claude-haiku-4-5
  │                                 rawPayload: unknown              ← normalized BigQuery rows
  │                               }
  │                                     │
  │                                     ▼
  │                           useDashboard() maps payload
  │                           → financialOverview, summary, byService, byProject, bySku,
  │                             charts, alerts, isLoading, isError, error
  │                                     │
  │                                     ▼
  │                           components render ✓
  │                           ├─ StatsSection       (financialOverview)
  │                           ├─ MainContent        (byService, byProject, bySku, charts)
  │                           ├─ DashboardInsights  (alerts → AI alerts grid)
  │                           ├─ DashboardSidebar   (summary → period summary only)
  │                           └─ DashboardDataSync  (isError → toast.error side effect)
  │
  └─ FloatingChatbotButton() [useDashboard → ChatbotContext]       ← NEW
          │
          │  POST /api/chatbot   { message, context: ChatbotContext }
          ▼
    app/api/chatbot/route.ts     [SERVER]                           ← NEW
          │
          ├─ Guard: PROMPT_PATTERNS   → blocked: true (prompt injection)
          ├─ Guard: CODE_PATTERNS     → blocked: true (code questions)
          ├─ Guard: no FINOPS signal  → blocked: true (off-topic)
          │
          └─ generateChatbotReply(message, context)  [lib/finops-engine.ts]
                  │
                  └─ Anthropic SDK (claude-haiku-4-5)
                          prompt = question + full ChatbotContext snapshot
                          → reply: string (max 120 words, FinOps-only)
                          → return { message: string, blocked: false }
```

---

# BigQuery API Flow (internal detail)

```
GET /api/bigquery?query=SELECT...
    │
    ├─ [Step 1] Extract query parameter (Lines 134-137)
    │   const query = request.nextUrl.searchParams.get('query') ?? `SELECT * FROM...`
    │   └─ query = "SELECT * FROM..."
    │
    ├─ [Step 2] Extract projectId parameter (Lines 139-141)
    │   const projectId = request.nextUrl.searchParams.get('projectId') ?? env.GCP_PROJECT_ID
    │   └─ projectId = "lithe-sonar-431106-j2"
    │
    ├─ [Step 2.5] Extract noCache flag (Line 144)
    │   const noCache = request.nextUrl.searchParams.get('noCache') === 'true'
    │   └─ true → bypass Redis read/write for this request
    │
    ├─ [Step 3] Validate query (Lines 146-152)
    │   if (!query?.trim()) { return NextResponse.json(..., 400) }
    │   ├─ INVALID → HTTP 400 ✗
    │   └─ VALID → Continue
    │
    ├─ [Step 3.5] Build cache key (Lines 154-155)
    │   cacheKey = sha256(query + projectId)
    │
    ├─ [Step 3.6] Redis cache check ← UPDATED
    │   cacheKey = sha256(query + projectId)
    │   cached = await redis.get(cacheKey)
    │   ├─ noCache=true → skip Redis read and continue to Step 4
    │   ├─ HIT with aggregated + aiInsights
    │   │         → buildDashboardResponse("cached", ...)
    │   │         → return HTTP 200 ✓ (skip Steps 4–12)
    │   ├─ HIT with legacy rows-only cache
    │   │         → aggregate(cached.rows)
    │   │         → call Anthropic SDK → aiInsights: Alert[]
    │   │         → redis.set(cacheKey, upgraded payload, TTL.DEFAULT)
    │   │         → return HTTP 200 ✓ (skip Steps 4–12)
    │   └─ MISS → Continue to Step 4
    │
    ├─ [Step 4] Build credentials object (Lines 195-202)
    │   const credentials = { type, project_id, private_key, client_email, token_uri }
    │   └─ credentials = { project_id, private_key, client_email, ... }
    │
    ├─ [Step 5] Initialize GoogleAuth (Lines 204-208)
    │   const auth = new GoogleAuth({ credentials, scopes: ["...bigquery"] })
    │   └─ auth = new GoogleAuth({ credentials, scopes })
    │
    ├─ [Step 6] Get OAuth token (Lines 210-223) — with credential validation
    │   try {
    │     const authClient = await auth.getClient()
    │     const { token } = await authClient.getAccessToken()
    │   } catch (authError) { ... }
    │   ├─ INVALID credentials → HTTP 401 ✗  (bad key, wrong email, disabled account)
    │   └─ SUCCESS → token = "ya29.a0..."
    │
    ├─ [Step 7] Log request (Lines 225-226)
    │   logger.info({ projectId, query: query.slice(0, 50) }, "BigQuery API request")
    │   └─ logger.info(...)
    │
    ├─ [Step 8] POST to BigQuery API (Lines 228-258) — with network error handling
    │   try { response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {...}) }
    │   catch (fetchError) { ... }
    │   ├─ NETWORK FAILURE → HTTP 503 ✗  (DNS, connection refused, OS timeout)
    │   ├─ URL: bigquery.googleapis.com/bigquery/v2/projects/.../queries
    │   ├─ Headers: Authorization: Bearer ${token}
    │   └─ Body: { query, timeoutMs: 10000, useLegacySql: false, useQueryCache: true, dryRun: false, location: null }
    │
    ├─ [Step 9] Parse response (Lines 260-265)
    │   let payload = (await response.json()) as BigQueryQueryResponse
    │   └─ payload = { rows, schema, totalRows, jobReference, ... }
    │
    ├─ [Step 9.5] Poll until jobComplete if BigQuery job is still running (Lines 267-291) ← NEW
    │   if payload.jobComplete === false && payload.jobReference?.jobId
    │   ├─ wait 2 seconds
    │   ├─ GET /queries/{jobId}?timeoutMs=10000&location=...
    │   ├─ repeat up to 10 times
    │   └─ if still incomplete → HTTP 504 ✗
    │
    ├─ [Step 10] Check status (Lines 293-305)
    │   if (!response.ok) { logger.error(...); return NextResponse.json({ error }, status) }
    │   ├─ ERROR (404/403/500) → HTTP error ✗ (do NOT cache)
    │   └─ SUCCESS (200) → Continue
    │
    ├─ [Step 11] Extract schema & normalize rows (Lines 307-309)
    │   const schemaFields = payload.schema?.fields ?? []
    │   const rows = normalizeRows(schemaFields, payload.rows ?? [])
    │   ├─ schemaFields = payload.schema.fields
    │   └─ rows = normalizeRows(schemaFields, payload.rows)
    │         └─ Transform { f: [{ v: ... }] } → { name: value }
    │
    ├─ [Step 11.5] Aggregate fresh data
    │   aggregated = aggregate(rows)  [lib/finops-engine.ts]
    │   └─ { statistics, charts, byService, byProject, bySku, summary }
    │
    ├─ [Step 11.6] Call Anthropic SDK (claude-haiku-4-5)
    │   aiInsights = await generateInsights(aggregated)  [lib/finops-engine.ts]
    │   └─ alerts: Alert[]  ← AI-generated spend summary, anomalies, recommendations
    │
    ├─ [Step 11.7] Redis cache write (only when noCache=false)
    │   responsePayload = { rows, totalRows, jobComplete, cacheHit, totalBytesProcessed,
    │                       totalBytesBilled, jobReference, schema, aggregated, aiInsights }
    │   await redis.set(cacheKey, responsePayload, TTL.DEFAULT)
    │   TTL strategy:
    │   ├─ default queries    → 300s  (5 min)
    │   ├─ heavy aggregations → 1800s (30 min)
    │   └─ real-time queries  → skip cache (TTL = 0 / bypass flag)
    │   Stored value includes:
    │   ├─ normalized rows
    │   ├─ aggregated dashboard data
    │   └─ aiInsights
    │
    └─ [Step 12] Build and return unified payload via buildDashboardResponse()
        return NextResponse.json({
          status:     200,
          source:     "cached" | "db",
          statistics: FinancialMetric[],   ← 4 stat cards
          charts:     ChartDataPoint[],    ← monthly spend
          byService:  CostDriver[],        ← cost breakdown by raw service
          byProject:  CostDriver[],        ← cost breakdown by project
          bySku:      CostDriver[],        ← top 20 cost SKUs
          summary:    FinancialSummary,    ← period, daysElapsed, daysInMonth, daysRemaining
          aiInsights: Alert[],             ← AI-generated by claude-haiku-4-5
          rawPayload: unknown              ← normalized BigQuery rows ← NEW
        })
        └─ HTTP 200 ✓

[CATCH] (Lines 341-347) Any error → HTTP 500 ✗
catch (error) { const message = error instanceof Error ? error.message : "Unexpected server error."; logger.error(...); return NextResponse.json({ error: message }, 500) }

DELETE /api/bigquery — flush entire Redis cache  ← NEW
  └─ redisFlushAll() → { status: 200, message: "Redis cache flushed" }
  └─ [CATCH] → HTTP 500 ✗
```

## Redis Design Notes

| Concern        | Decision                                                              |
|----------------|-----------------------------------------------------------------------|
| Cache key      | `sha256(query + projectId)` — unique per query/project combo         |
| Stored value   | Normalized `rows` plus `aggregated` dashboard data and `aiInsights` |
| Default TTL    | 300s (5 min)                                                         |
| Error caching  | Never cache — only write on HTTP 200 from BigQuery                   |
| Cache bypass   | `?noCache=true` param or real-time flag skips Step 3.5 and 11.5      |
| Redis failure  | Non-fatal — log warning, continue to BigQuery (graceful degradation) |
| Cache flush    | `DELETE /api/bigquery` → `redisFlushAll()` — clears entire cache     |
| New env vars   | `REDIS_URL` (connection string) via `lib/env.ts`                     |

---

# Chatbot API Flow (internal detail)

```
POST /api/chatbot
  body: { message: string, context: ChatbotContext }
    │
    ├─ [Step 1] Parse & validate body
    │   body = await request.json() as Partial<ChatbotRequest>
    │   message = body.message?.trim() ?? ""
    │   context = body.context
    │   ├─ empty message → HTTP 400 ✗
    │   └─ missing context → HTTP 400 ✗
    │
    ├─ [Step 2] Prompt injection guard
    │   PROMPT_PATTERNS (regex): prompt, system prompt, instruction, model, anthropic, haiku, claude
    │   ├─ MATCH → return { message: "...", blocked: true }  HTTP 200 (soft block)
    │   └─ NO MATCH → Continue
    │
    ├─ [Step 3] Code question guard
    │   CODE_PATTERNS (regex): code, typescript, javascript, react, api, component, function, bug, sql, etc.
    │   ├─ MATCH → return { message: "...", blocked: true }  HTTP 200 (soft block)
    │   └─ NO MATCH → Continue
    │
    ├─ [Step 4] FinOps relevance guard
    │   FINOPS_PATTERNS (regex): finops, spend, cost, cloud, service, project, sku, budget, burn, trend, etc.
    │   entityTokens = tokenizeEntities(context)  ← tokens from byService/byProject/bySku names
    │   hasFinopsSignal = FINOPS_PATTERNS match OR entityToken found in message
    │   ├─ NO SIGNAL → return { message: "...", blocked: true }  HTTP 200 (soft block)
    │   └─ HAS SIGNAL → Continue
    │
    ├─ [Step 5] Call generateChatbotReply(message, context)  [lib/finops-engine.ts:356]  [async]
    │   ├─ Init Anthropic client (claude-haiku-4-5)
    │   ├─ Build prompt:
    │   │   ├─ System persona: FinOps Copilot call-center agent
    │   │   ├─ Rules: max 120 words, no markdown tables, FinOps only
    │   │   ├─ QUESTION: user message
    │   │   ├─ DASHBOARD PERIOD: period, daysElapsed, daysInMonth, daysRemaining
    │   │   ├─ SUMMARY STATISTICS: formatStatistics(context.statistics)
    │   │   ├─ CURRENT INSIGHTS: formatInsights(context.aiInsights)
    │   │   ├─ SERVICE BREAKDOWN: formatCostDrivers("Services", context.byService)
    │   │   ├─ PROJECT BREAKDOWN: formatCostDrivers("Projects", context.byProject)
    │   │   └─ SKU BREAKDOWN + TREND DATA
    │   └─ anthropic.messages.create({ model: "claude-haiku-4-5", max_tokens: 512 })
    │        → reply: string
    │
    └─ [Step 6] Return reply
        return NextResponse.json({ message: reply, blocked: false })
        └─ HTTP 200 ✓

[CATCH] Any error → HTTP 500 ✗
{ message: "I'm unable to answer right now...", blocked: true }
```
