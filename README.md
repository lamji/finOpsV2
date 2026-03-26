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

Three environment files are supported — one per tier. Use [`.env.example`](.env.example) as the template for required and optional values.

| File | Tier | `NODE_ENV` | `DEPLOY_ENV` |
|------|------|-----------|-------------|
| `.env.development` | Local dev | `development` | `development` |
| `.env.staging` | Staging | `test` | `staging` |
| `.env.production` | Production | `production` | `production` |

All three are git-ignored. Never commit them.

Required values (all tiers):

- `ANTHROPIC_API_KEY`
- `GCP_PROJECT_ID`
- `GCP_CLIENT_EMAIL`
- `GCP_PRIVATE_KEY`
- `BQ_DATASET`
- `BQ_TABLE`

Optional values:

- `REDIS_URL` — caching disabled if not set
- `LOG_LEVEL` — defaults to `info`

Environment variables are validated at module load by Zod in [`lib/env.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/env.ts#L10). Invalid configuration fails fast before request handling starts.

### Run Locally

**Development** — auto-loads `.env.development`:
```bash
npm run dev
```

**Staging** — loads `.env.staging` via dotenv-cli:
```bash
npx dotenv-cli -e .env.staging -- npm run dev
```

**Production build** — auto-loads `.env.production`:
```bash
npm run build
npm run start
```

Open:

```text
http://localhost:3000
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

### Data Responsibilities

- `useApiDashboard()` owns remote fetching and cache freshness timing with a 5-minute client stale window in [`Presentation/Dashboard/useApiDashboard.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/Presentation/Dashboard/useApiDashboard.ts#L20).
- `useDashboard()` reshapes the API payload into view-friendly properties consumed by multiple widgets in [`Presentation/Dashboard/useDashboard.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/Presentation/Dashboard/useDashboard.ts#L5).
- `aggregate()` is the main domain transformation layer. It converts raw billing rows into summary metrics, comparative drilldowns, and monthly trend data in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L99).
- `DashboardDataSync` handles the main side effect on dashboard fetch failure by showing a toast in [`components/DashboardDataSync/index.tsx`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/components/DashboardDataSync/index.tsx#L12).

### External Dependencies Touched At Runtime

- Google OAuth token acquisition
- BigQuery query API
- Anthropic messages API
- Redis cache service

## 5. SDLC Overview

### How Environments Work

Each tier is a separate Vercel project linked to the same GitHub repository. Secrets are never committed — they are entered directly in each Vercel project's environment variables UI.

| Tier | Vercel project | Branch | Credentials |
|------|---------------|--------|-------------|
| Development | `finops-dev` | `develop` | sandbox service account + sandbox BigQuery dataset |
| Staging | `finops-staging` | `staging` | staging service account + staging BigQuery dataset |
| Production | `finops-prod` | `production` | production service account + production BigQuery dataset |

### Deploying Development

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repo → set branch to `develop`
3. Add all variables from [`.env.example`](.env.example) under **Environment Variables**, using sandbox credentials
4. Click **Deploy**

### Promoting to Staging

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repo → set branch to `develop` (or a dedicated `staging` branch)
3. Add all variables from [`.env.example`](.env.example) under **Environment Variables**, using staging credentials (different service account, different BigQuery dataset)
4. Click **Deploy**

Each push to that branch redeploys staging automatically.

### Promoting to Production

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repo → set branch to `main`
3. Add all variables from [`.env.example`](.env.example) under **Environment Variables**, using production credentials
4. Click **Deploy**

Evrytime there is new changes and need to deploy in staging, just do a PR from develop to staging

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

The main route already uses a `GROUP BY` pre-aggregated query instead of `SELECT *`, Redis caches the full dashboard payload for 5 minutes, and long-running jobs are polled until complete in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L135). Those are the right starting points. The next steps at scale:

- Move aggregation offline — `aggregate()` runs synchronously in-process on every cache miss in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L99); a scheduled cron job writing to Redis with `TTL.HEAVY` would make the API route a cache-read-only path with no BigQuery call on user request
- Materialise pre-grouped summary tables in BigQuery by month, service, project, and SKU so queries scan a small serving table rather than the full billing export

### If Compliance Requirements Tighten

- Add authentication to all three API routes — `GET /api/bigquery` and `POST /api/chatbot` are currently unauthenticated; a `middleware.ts` verifying a session token or API key covers all routes without touching individual handlers
- Gate the `DELETE` endpoints on an `ADMIN_SECRET` env check or remove them from production builds via `DEPLOY_ENV` — both `DELETE /api/bigquery` and `DELETE /api/test` call `redisFlushAll()` with no auth check in [`app/api/bigquery/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/bigquery/route.ts#L351) and [`app/api/test/route.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/app/api/test/route.ts#L319)
- Replace env-var secrets with a managed store such as GCP Secret Manager or HashiCorp Vault — the Pino `redact` list in [`lib/logger.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/logger.ts#L13) covers known field names but does not prevent secrets from appearing in memory under unexpected keys
- Add an audit trail for AI calls — neither the prompt nor the response from `generateInsights()` or `generateChatbotReply()` is stored; regulated environments require a log of what data was sent to the model and what it returned in [`lib/finops-engine.ts`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/lib/finops-engine.ts#L243)
- Add tenant isolation if the dashboard grows to serve multiple billing scopes — the current architecture is single-account, with credentials and dataset fixed at deploy time via `GCP_PROJECT_ID` and `BQ_TABLE`

### Likely Target Architecture

For higher scale and stronger governance, the architecture should move toward:

- BigQuery export tables → scheduled transformation layer → pre-aggregated serving tables
- API layer with auth middleware, rate limiting, and byte-cost guards
- Cache layer written by cron, read by request — no live BigQuery calls on user traffic
- AI layer behind audit logging, retention policy, and model version pinning


