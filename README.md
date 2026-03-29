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

**Frontend (Next.js UI)**
- Framework: Next.js 16 App Router
- UI: React 19, Tailwind CSS 4, shadcn/ui, Recharts
- Data fetching: TanStack Query
- BigQuery fallback route: `app/api/bigquery/route.ts` via `google-auth-library` (used when `NEXT_PUBLIC_API_URL` is not set)
- Cache: Redis via `ioredis`
- Logging: Pino
- Validation: Zod
- AI: Anthropic SDK (`@anthropic-ai/sdk`)

**Backend API (Python FastAPI — primary in Docker)**
- Runtime: Python 3.12
- Framework: FastAPI + uvicorn
- BigQuery: `google-cloud-bigquery` Python SDK
- AI: `anthropic` Python SDK
- Cache: `redis` Python client
- Config: `pydantic-settings` (reads from `.env.local` via `env_file` in docker-compose)

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

### Run with Docker

`docker compose` starts three services:

| Service | Image / Build | Port | Purpose |
|---------|--------------|------|---------|
| `redis` | `redis:7-alpine` | 6379 | Cache layer — starts first, api waits for healthcheck |
| `api` | `api/Dockerfile` (Python 3.12 + FastAPI) | 8000 | Primary API — `GET /dashboard`, `DELETE /dashboard` |
| `ui` | `Dockerfile` (Node 22, 3-stage build) | 3000 | Next.js dashboard |

**Important — two things must be true before you run:**

1. The API service reads all secrets from `ENV_FILE` (defaults to `.env.local`). Create that file from `.env.example` before running.
2. `NEXT_PUBLIC_API_URL` is **baked into the UI at build time** — not a runtime variable. When running locally it defaults to `http://localhost:8000` (correct). For a remote server you must pass the public server address at build time.

**Local run (same machine):**
```bash
# copy and fill in .env.local from the template
cp .env.example .env.local

# build and start all three services
docker compose up --build
```

**Remote server (AWS EC2, VPS, etc.):**
```bash
# NEXT_PUBLIC_API_URL must be the public address — baked into the UI image at build
NEXT_PUBLIC_API_URL=http://<server-ip>:8000 docker compose up --build
```

**Staging / Production env files:**
```bash
# staging
ENV_FILE=.env.staging docker compose up --build

# production
ENV_FILE=.env.production docker compose up --build
```

On PowerShell:
```powershell
$env:ENV_FILE = ".env.staging"
$env:NEXT_PUBLIC_API_URL = "http://<server-ip>:8000"
docker compose up --build
```

After switching env files or changing `docker-compose.yml`, rebuild cleanly:
```bash
docker compose down
docker compose up --build --remove-orphans
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

```
app/              Next.js App Router — page shells and API fallback routes
Presentation/     Client-side presentation hooks — data shaping for UI
components/       UI composition and feature components
lib/              Environment, aggregation engine (TS), logging, Redis helpers, shared types
api/              Python FastAPI service — primary API in Docker
  app/
    main.py       FastAPI app + CORS config
    config.py     pydantic-settings env loading
    routes/
      dashboard.py  GET /dashboard, DELETE /dashboard
    services/
      bigquery.py   BigQuery client + row fetching
      engine.py     aggregate() — Python port of lib/finops-engine.ts
      ai.py         generate_insights() — Anthropic claude-haiku-4-5
      cache.py      Redis get/set helpers
    models.py     Pydantic response models
```

### API Routing — Dual Path

`useApiDashboard()` in `Presentation/Dashboard/useApiDashboard.ts` routes to one of two API implementations depending on whether `NEXT_PUBLIC_API_URL` is set at build time:

```
NEXT_PUBLIC_API_URL is set (Docker)
  └─ calls: ${NEXT_PUBLIC_API_URL}/dashboard  →  Python FastAPI  (port 8000)

NEXT_PUBLIC_API_URL is not set (plain npm run dev)
  └─ calls: /api/bigquery                     →  Next.js route   (app/api/bigquery/route.ts)
```

Both implementations perform the same work: fetch BigQuery rows → `aggregate()` → `generate_insights()` (Anthropic) → Redis cache. They are parallel implementations in TypeScript and Python respectively.

### Data Responsibilities

- `useApiDashboard()` owns remote fetching and cache freshness timing with a 5-minute stale window. It calls the FastAPI service when `NEXT_PUBLIC_API_URL` is set, otherwise falls back to the Next.js route — see [`Presentation/Dashboard/useApiDashboard.ts`](Presentation/Dashboard/useApiDashboard.ts).
- `useDashboard()` reshapes the API payload into view-friendly properties consumed by multiple widgets in [`Presentation/Dashboard/useDashboard.ts`](Presentation/Dashboard/useDashboard.ts).
- `aggregate()` is the main domain transformation layer. It converts raw billing rows into summary metrics, comparative drilldowns, and monthly trend data. Exists in both [`lib/finops-engine.ts`](lib/finops-engine.ts) (TypeScript) and [`api/app/services/engine.py`](api/app/services/engine.py) (Python).
- `DashboardDataSync` handles the main side effect on dashboard fetch failure by showing a toast in [`components/DashboardDataSync/index.tsx`](components/DashboardDataSync/index.tsx).

### External Dependencies Touched At Runtime

- Google OAuth token acquisition (both TS and Python paths)
- BigQuery query API
- Anthropic messages API (`claude-haiku-4-5`)
- Redis cache service (300s TTL default)

## 5. SDLC Overview

### How Environments Work

The project uses Docker Compose deployed on a server (e.g. AWS EC2). Each tier maps to a Git branch and a dedicated env file. Secrets are never committed — they live in the env file on the server only.

| Tier | Branch | Env file | `DEPLOY_ENV` |
|------|--------|----------|-------------|
| Development | `develop` | `.env.local` | `development` |
| Staging | `staging` | `.env.staging` | `staging` |
| Production | `production` | `.env.production` | `production` |

### Deploying for the First Time

On the server (SSH in first):

```bash
git clone <repo-url>
cd finOps
git checkout develop   # or staging / production

# create env file with real credentials
cp .env.example .env.local
nano .env.local        # fill in GCP_*, ANTHROPIC_API_KEY, REDIS_URL, etc.

# build and run (local — NEXT_PUBLIC_API_URL defaults to http://localhost:8000)
docker compose up --build -d

# remote server — pass the public address so the UI can reach the API
NEXT_PUBLIC_API_URL=http://<server-ip>:8000 docker compose up --build -d
```

### Promoting from Development to Staging

```bash
# open a PR from develop → staging and merge
# then on the staging server:
git pull origin staging
ENV_FILE=.env.staging docker compose up --build -d --remove-orphans
```

### Promoting from Staging to Production

```bash
# open a PR from staging → production and merge
# then on the production server:
git pull origin production
ENV_FILE=.env.production \
  NEXT_PUBLIC_API_URL=http://<prod-server-ip>:8000 \
  docker compose up --build -d --remove-orphans
```

### Updating a Running Deployment

```bash
git pull origin <branch>
docker compose up --build -d --remove-orphans
```

## 5.1 SDLC Without Docker — Vercel Deployment

When deploying without Docker, the Python FastAPI service (`api/`) is **not used**. Vercel runs the Next.js app only. The UI falls back to the built-in Next.js route (`app/api/bigquery/route.ts`) which handles BigQuery, aggregation, and Anthropic directly — because `NEXT_PUBLIC_API_URL` is not set.

> **Do not set `NEXT_PUBLIC_API_URL` in Vercel.** Leaving it unset is what activates the Next.js fallback route. Setting it would point the UI to a FastAPI service that does not exist on Vercel.

### How Environments Work

Each tier is a separate Vercel project linked to the same GitHub repository. Secrets are entered directly in each Vercel project's environment variables UI — never committed.

| Tier | Vercel project | Branch | `DEPLOY_ENV` |
|------|---------------|--------|-------------|
| Development | `finops-dev` | `develop` | `development` |
| Staging | `finops-staging` | `staging` | `staging` |
| Production | `finops-prod` | `production` | `production` |

### Required Environment Variables (set in Vercel UI for each project)

```
ANTHROPIC_API_KEY=sk-ant-...
GCP_PROJECT_ID=your-gcp-project-id
GCP_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
BQ_DATASET=your_dataset
BQ_TABLE=your_billing_export_table
DEPLOY_ENV=development   # or staging / production per tier
LOG_LEVEL=info
```

`REDIS_URL` is optional. If set, Redis caching is enabled. If not set, every request hits BigQuery directly — the app still works.

Do **not** set `NEXT_PUBLIC_API_URL` — leave it unset so the fallback Next.js route is used.

### Deploying Development (first time)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repository
3. Set the **Production Branch** to `develop`
4. Under **Environment Variables**, add all required variables above using sandbox credentials
5. Click **Deploy**

Every push to `develop` redeploys automatically.

### Promoting to Staging

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repository
3. Set the **Production Branch** to `staging`
4. Under **Environment Variables**, add all required variables using staging credentials (separate GCP service account, separate BigQuery dataset)
5. Click **Deploy**

To deploy new changes to staging: open a PR from `develop` → `staging` and merge. Vercel redeploys automatically on merge.

### Promoting to Production

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the same GitHub repository
3. Set the **Production Branch** to `production`
4. Under **Environment Variables**, add all required variables using production credentials
5. Click **Deploy**

To deploy new changes to production: open a PR from `staging` → `production` and merge.

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


