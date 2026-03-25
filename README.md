# finOps

Technical brief for the FinOps dashboard application.

## 1. Product Summary

`finOps` is a Next.js 16 dashboard for cloud cost visibility. It pulls Google Cloud billing export data through a server route, aggregates it into dashboard-ready metrics, optionally caches the result in Redis, and generates AI-powered insights plus a constrained FinOps chatbot.

Core capabilities:

- Monthly cloud spend summary cards
- Spend breakdowns by service, project, and SKU
- Monthly trend chart for the current billing year
- AI-generated dashboard insights
- FinOps-only chatbot grounded in the current dashboard dataset

## 2. Stack

- Framework: Next.js 16 App Router
- UI: React 19, Tailwind CSS 4, shadcn/ui, Recharts
- Data fetching: TanStack Query
- Server integrations: Google BigQuery REST API via `google-auth-library`
- Cache: Redis via `ioredis`
- Logging: Pino
- Validation: Zod
- AI: Anthropic SDK

## 3. Detailed Setup And Local Execution

### Prerequisites

- Node.js and npm
- A Google Cloud service account with BigQuery access to the billing export table
- An Anthropic API key
- Redis only if you want response caching enabled

### Install

```bash
npm install
```

The project already uses npm and ships a `package-lock.json`, and the main local scripts are defined in [`package.json`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/package.json#L1).

### Configure Environment

Create `.env.development` from the template values in [`.env.example`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/.env.example#L1).

Required values:

- `ANTHROPIC_API_KEY`
- `GCP_PROJECT_ID`
- `GCP_CLIENT_EMAIL`
- `GCP_PRIVATE_KEY`
- `BQ_DATASET`
- `BQ_TABLE`

Optional values:

- `REDIS_URL`
- `LOG_LEVEL`
- `NODE_ENV`

Environment variables are validated at module load by Zod in [`lib/env.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/env.ts#L10). Invalid configuration fails fast before request handling starts.

### Run Locally

```bash
npm run dev
```

The development server uses Turbopack via [`package.json`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/package.json#L6).

Open:

```text
http://localhost:3000
```

### Production-Like Local Run

```bash
npm run build
npm run start
```

### Quality Checks

```bash
npm run lint
npm run typecheck
```

### Runtime Notes

- If `REDIS_URL` is missing, caching is disabled without breaking the app, as implemented in [`lib/redis.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/redis.ts#L26).
- If Anthropic is unavailable, the dashboard can still render, but AI insight generation falls back to an empty list because `generateInsights()` catches failures in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L243).
- The chatbot depends on dashboard context. If the dashboard has not finished loading, the UI blocks the interaction in [`components/FloatingChatbotButton/index.tsx`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/components/FloatingChatbotButton/index.tsx#L85).

## 4. Architecture Overview

### High-Level Structure

- `app/`: App Router entry points and API routes
- `Presentation/`: client-side presentation hooks for dashboard data shaping
- `components/`: UI composition and feature components
- `lib/`: environment, aggregation engine, logging, Redis helpers, shared types

### Confirmed Runtime Flow

```text
[Entry]
  app/page.tsx:3
    renders Dashboard() -> Presentation/Dashboard/index.tsx:10
      mounts DashboardDataSync() -> components/DashboardDataSync/index.tsx:12
        calls useDashboard() -> Presentation/Dashboard/useDashboard.ts:5
          calls useApiDashboard() -> Presentation/Dashboard/useApiDashboard.ts:20
            [async] fetch("/api/bigquery") -> Presentation/Dashboard/useApiDashboard.ts:9
              GET /api/bigquery -> app/api/bigquery/route.ts:131
                reads validated env -> lib/env.ts:10
                checks Redis cache -> lib/redis.ts:46 [external: service]
                if miss, authenticates Google service account -> app/api/bigquery/route.ts:203
                POSTs query to BigQuery API -> app/api/bigquery/route.ts:230 [external: API]
                normalizes rows -> app/api/bigquery/route.ts:306
                aggregates metrics -> lib/finops-engine.ts:99
                generates AI insights -> lib/finops-engine.ts:243 [external: service]
                stores cache -> lib/redis.ts:83 [external: service]
                returns unified dashboard payload -> app/api/bigquery/route.ts:336 [END]
      renders StatsSection -> components/StatsSection/index.tsx:25
      renders MainContent -> components/MainContent/index.tsx:243
      renders DashboardInsights -> components/DashboardInsights/index.tsx:7
      renders FloatingChatbotButton -> components/FloatingChatbotButton/index.tsx:13
        builds dashboard context -> components/FloatingChatbotButton/index.tsx:73
        [async] POST /api/chatbot -> components/FloatingChatbotButton/index.tsx:119
          validates scope and input -> app/api/chatbot/route.ts:75
          calls generateChatbotReply() -> lib/finops-engine.ts:361 [external: service]
          returns chatbot message -> app/api/chatbot/route.ts:120 [END]
```

### Data Responsibilities

- `useApiDashboard()` owns remote fetching and cache freshness timing with a 5-minute client stale window in [`Presentation/Dashboard/useApiDashboard.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/Presentation/Dashboard/useApiDashboard.ts#L20).
- `useDashboard()` reshapes the API payload into view-friendly properties consumed by multiple widgets in [`Presentation/Dashboard/useDashboard.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/Presentation/Dashboard/useDashboard.ts#L5).
- `aggregate()` is the main domain transformation layer. It converts raw billing rows into summary metrics, comparative drilldowns, and monthly trend data in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L99).
- `DashboardDataSync` handles the main side effect on dashboard fetch failure by showing a toast in [`components/DashboardDataSync/index.tsx`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/components/DashboardDataSync/index.tsx#L12).

### Key Decision Points

- Cache hit vs. live BigQuery query in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L153)
- Credential failure vs. BigQuery execution in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L209)
- BigQuery polling path for incomplete jobs in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L266)
- FinOps-only chatbot guardrails in [`app/api/chatbot/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/chatbot/route.ts#L95)

### External Dependencies Touched At Runtime

- Google OAuth token acquisition
- BigQuery query API
- Anthropic messages API
- Redis cache service

### Likely Failure Points

- Missing or malformed environment variables
- Invalid Google service account permissions
- BigQuery network or job timeout failures
- Redis connectivity issues
- Anthropic response parsing failures when AI output is not valid JSON

## 5. SDLC Overview

### What Is Implemented In This Repository

The repository currently implements application-level runtime separation, not a full deployment pipeline:

- `NODE_ENV` is explicitly modeled as `development | test | production` in [`lib/env.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/env.ts#L12).
- Logging behavior changes by environment in [`lib/logger.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/logger.ts#L10): pretty output in development, structured JSON in production.
- Redis is designed to degrade gracefully across environments in [`lib/redis.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/redis.ts#L26).
- Local developer workflow is script-driven through `dev`, `build`, `start`, `lint`, and `typecheck` in [`package.json`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/package.json#L6).

### What Is Not Present In This Repository

No first-party evidence was found for:

- CI workflows under a project-owned `.github/workflows`
- Container build definitions
- Infrastructure-as-code
- Deployment manifests for dev, staging, or production
- Secret management beyond environment variables

Because of that, the current SDLC should be described as:

1. Developer runs locally with environment variables.
2. Developer validates with lint/typecheck and manual browser testing.
3. Production promotion is expected to happen through an external platform or process that is not checked into this repository.

### Recommended Dev / Staging / Prod Lifecycle

For a production-grade lifecycle, the current architecture fits this promotion model:

1. `dev`: local feature work against sandbox BigQuery data and optional local Redis.
2. `staging`: deployed with staging service-account credentials, staging Anthropic key, and Redis enabled for realistic cache behavior.
3. `prod`: deployed with production secrets, read-only billing access, structured logs, and monitoring on route latency and BigQuery failures.

Minimum pipeline gates should be:

1. Install dependencies
2. Run `npm run lint`
3. Run `npm run typecheck`
4. Run `npm run build`
5. Smoke-test `/api/bigquery` and `/api/chatbot`

## 6. AI Disclosure

### AI Tool Used During Development

This project used `Claude CLI` during development.

That is evidenced by the repository’s checked-in Claude workspace under [`.claude`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/.claude), including [`.claude/settings.json`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/.claude/settings.json#L1), [`.claude/agents/finops-agent.md`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/.claude/agents/finops-agent.md#L1), [`.claude/CLAUDE.md`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/.claude/CLAUDE.md#L1), and [`CLAUDE.md`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/CLAUDE.md#L1).

### Role Of Claude CLI In Development

Claude CLI was used as an AI development assistant for:

- code investigation and flow tracing
- implementation guidance and code generation
- project documentation support
- rule- and memory-guided development through the project-specific `finops-agent`

In short, Claude CLI supported the engineering workflow used to build and refine this application.

### AI Within The Shipped Application

AI is also part of the application runtime.

The application directly uses Anthropic through the SDK declared in [`package.json`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/package.json#L15).

Confirmed runtime usage:

- `generateInsights()` sends aggregated spend data to Anthropic model `claude-haiku-4-5` and returns dashboard insight cards in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L243)
- `generateChatbotReply()` sends dashboard context plus the user question to the same model and returns a FinOps chatbot response in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L361)
- the chatbot route applies scope restrictions before the model call in [`app/api/chatbot/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/chatbot/route.ts#L75)

### Disclosure Statement

AI was used in two ways in this project:

1. As a development tool: `Claude CLI` assisted with implementation, investigation, and documentation during development.
2. As an application feature: Anthropic powers the shipped dashboard insights and FinOps chatbot responses.

## 7. Security And Compliance Notes

- Secrets are environment-based and must not be committed.
- The BigQuery route runs on the Node.js runtime, which is necessary for the Google auth and Redis libraries in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L20).
- Chatbot scope restriction is implemented server-side, not only in the UI, which is the correct trust boundary for prompt control in [`app/api/chatbot/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/chatbot/route.ts#L75).
- Redis cache flush is exposed via `DELETE /api/bigquery`; that endpoint should be protected before production rollout because the current implementation has no auth layer in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L351).

## 8. Engineering Roadmap

### If Data Volume Grows Massively

The current design is appropriate for a small-to-medium dashboard, but it will not scale cleanly if the billing export becomes very large because the API route defaults to `SELECT *` for the current year in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L134).

Recommended evolution:

1. Replace raw-row fetches with pre-aggregated SQL by month, service, project, and SKU.
2. Materialize daily or hourly summary tables in BigQuery instead of scanning export rows on request.
3. Move expensive aggregation out of request time into scheduled ETL or dbt-style transforms.
4. Store canonical dashboard snapshots in Redis or a serving database for low-latency reads.
5. Add query cost monitoring and hard limits for BigQuery bytes billed.

### If Compliance Requirements Tighten

Recommended evolution:

1. Add authentication and authorization to both API routes.
2. Restrict `DELETE /api/bigquery` to privileged operators only.
3. Move secrets to a managed secret store.
4. Redact sensitive fields from logs and add audit trails for chatbot access.
5. Add tenant or workspace isolation if the dashboard will serve multiple billing scopes.
6. Introduce prompt and response retention policies for AI features.
7. Add human review or deterministic fallback for AI-generated insight cards if compliance requires fully explainable outputs.

### Likely Target Architecture

For higher scale and stronger governance, the architecture should move toward:

- BigQuery export tables -> scheduled transformation layer -> pre-aggregated serving tables
- API layer with auth, rate limiting, and observability
- Cache or read model for dashboard payloads
- AI layer behind policy enforcement, logging, and redaction controls

## 9. Repository Reality Check

This README is based on confirmed code paths in the current repository. Where deployment lifecycle or compliance operations are discussed, those sections are recommendations unless explicitly backed by checked-in code.
