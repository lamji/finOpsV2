---
paths:
  - "app/api/**"
---

# API Rules — FinOps Dashboard

## Route Handler Pattern

All API routes use Next.js App Router Route Handlers (not Pages API routes):

```ts
// app/api/[resource]/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    )
  }
}
```

## Response Shape

Always return consistent JSON shapes:

```ts
// ✅ Success
{ data: T, status: "ok" }

// ✅ Error
{ error: string, status: "error" }
```

## Data Integration

API routes feed `Presentation/[Name]/useApi[Name].ts` hooks via TanStack Query:
1. TypeScript interface shapes are defined in `lib/types/[feature].ts`
2. Use TanStack Query in the client — `useQuery({ queryKey: [...], queryFn: fetchFn })`
3. The QueryClient is configured in `lib/query-client.ts` (5min staleTime)
4. Mock data fallback lives in `Presentation/[Name]/use[Name].ts`

## Active Endpoints

### Next.js Route Handlers (`app/api/`)
- `GET /api/bigquery` — fetch BigQuery, aggregate, cache, generate AI insights
  - Response: `{ status, source, statistics, charts, drilldown, byService, byProject, bySku, summary, aiInsights, rawPayload }`
  - `?noCache=true` — bypass Redis read/write
  - `DELETE /api/bigquery` — flush entire Redis cache
- `POST /api/chatbot` — FinOps-only chatbot; guards prompt injection, code questions, off-topic
  - Body: `{ message: string, context: ChatbotContext }`
  - Response: `{ message: string, blocked: boolean }`

### FastAPI Backend (Docker mode only — `api/` container)
- `GET {NEXT_PUBLIC_API_URL}/dashboard` — same aggregated payload as above (Python port)
  - `?noCache=true` — bypass Redis
  - `DELETE {NEXT_PUBLIC_API_URL}/dashboard` — flush Redis cache

> **Routing rule:** `useApiDashboard()` hits FastAPI if `NEXT_PUBLIC_API_URL` is set (Docker), otherwise falls back to `/api/bigquery` (Vercel/local).

## Environment Variables

- Access via `lib/env.ts` (validated env vars)
- Never access `process.env` directly in components — always through `lib/env.ts`
- Server-only vars (no `NEXT_PUBLIC_` prefix) are safe in route handlers

## Error Handling

- Always wrap handler body in try/catch
- Return typed error responses with appropriate HTTP status codes
- Log errors server-side (use `lib/logger.ts` if available)
- Never leak stack traces or internal details to the client
