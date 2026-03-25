---
description: Scans the project to build a complete knowledge snapshot — features, pages, API routes, system design, tools, and dependencies. Writes results to .claude/CLAUDE.md and syncs agent memory. Run this after any significant structural change so future tasks skip file scanning entirely.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Skill: Scan Knowledge

You are a **project knowledge builder**. Your job is to scan the FinOps codebase, extract everything an AI needs to work on it confidently, and persist that knowledge so no future task needs to re-scan files from scratch.

**Goal:** After this skill runs, any agent can answer "what exists, where it lives, what it does, and how it connects" without opening a single source file.

---

## Why this matters

Every time an agent reads files to understand structure, it burns tokens and time. This skill front-loads that cost once — then all future sessions start with full context already loaded. The payoff compounds with every task.

---

## Workflow

```
STEP 1 — Scan project structure
STEP 2 — Extract features & pages
STEP 3 — Extract API routes & system design
STEP 4 — Extract components & hooks inventory
STEP 5 — Extract lib utilities
STEP 6 — Extract tools & dependencies
STEP 7 — Write .claude/CLAUDE.md
STEP 8 — Sync agent memory
STEP 9 — Report
```

---

## STEP 1 — Scan Project Structure

Get the full layout of the project. Run these in parallel:

```
Glob pattern="app/**/*.{ts,tsx}"
Glob pattern="components/**/*.{ts,tsx}"
Glob pattern="Presentation/**/*.{ts,tsx}"
Glob pattern="lib/**/*.{ts,tsx}"
Glob pattern="hooks/**/*.{ts,tsx}"
Glob pattern="app/api/**/route.ts"
```

Build a mental tree of what exists. Note:
- Every `app/**/page.tsx` → a page/route
- Every `app/api/**/route.ts` → an API endpoint
- Every `components/[Name]/index.tsx` → a feature component
- Every `Presentation/[Name]/index.tsx` → a page presentation layer
- Every `lib/*.ts` → a utility/service

---

## STEP 2 — Extract Features & Pages

**For each `app/**/page.tsx`:**
1. Read the file
2. Identify: what Presentation component it renders
3. Read that Presentation component (`Presentation/[Name]/index.tsx`)
4. Summarise: what the page shows, what data it needs, what components it assembles

**For each `Presentation/[Name]/`:**
- Read `index.tsx` → what it renders
- Read `use[Name].ts` (if exists) → what state/logic it owns
- Read `useApi[Name].ts` (if exists) → what API it calls, what data it returns

**Output format per feature:**
```
### [Feature Name]
- Route: /path
- Presentation: Presentation/[Name]/index.tsx
- Components used: [list]
- Data source: useApi[Name] → GET /api/[endpoint]
- State: use[Name] — [what it manages]
- Purpose: [one sentence]
```

---

## STEP 3 — Extract API Routes & System Design

**For each `app/api/**/route.ts`:**
1. Read the file
2. Identify: HTTP methods exported (`GET`, `POST`, etc.)
3. Identify: what it fetches/calls (external APIs, DB, Anthropic, BigQuery, Redis)
4. Identify: request params, response shape
5. Note error handling strategy

**Output format per route:**
```
### GET /api/[path]
- File: app/api/[path]/route.ts
- Purpose: [what it does]
- External calls: [BigQuery / Anthropic / Redis / none]
- Request: [params or body shape]
- Response: [shape]
- Caching: [Redis TTL or none]
```

**Also document the full data flow:**
```
Browser → useApi[Name] → GET /api/[path] → [external service] → response → component
```

---

## STEP 4 — Extract Components & Hooks Inventory

**For each `components/[Name]/index.tsx`:**
1. Read the file
2. Note: what props it accepts, what hook it uses, what it renders
3. Note if it has `use[Name].ts` or `useApi[Name].ts` siblings

**For each `Presentation/[Name]/use[Name].ts`:**
- What state it manages
- What it returns

**For each `Presentation/[Name]/useApi[Name].ts`:**
- Which endpoint it calls
- Query key used
- Return shape

**Output format:**
```
### [ComponentName]
- File: components/[Name]/index.tsx
- Hook: use[Name].ts — [what it manages]
- API hook: useApi[Name].ts — [endpoint]
- Renders: [brief description]
```

---

## STEP 5 — Extract Lib Utilities

**For each file in `lib/`:**
1. Read the file
2. List every exported function/constant and its purpose in one line

**Key files to always document:**
- `lib/types/` → all type definitions, grouped by feature file
- `lib/utils.ts` → utility functions
- `lib/env.ts` → environment variable schema
- `lib/finops-engine.ts` → aggregation logic
- `lib/redis.ts` → cache layer
- `lib/logger.ts` → logging setup
- `lib/query-client.ts` → TanStack Query config

---

## STEP 6 — Extract Tools & Dependencies

**Read `package.json`:**
```
Read package.json
```

Categorise every dependency under `dependencies` and `devDependencies`:

**Output format:**
```
### [Category]
| Package | Version | Purpose |
|---------|---------|---------|
| next    | 16.x    | React framework with App Router and SSR |
| ...     | ...     | ... |
```

**Categories to use:**
- Core Framework
- UI & Components
- Styling
- Data Fetching
- Charts & Visualisation
- External Services / SDKs
- Utilities
- Dev Tools

---

## STEP 7 — Write `.claude/docs/` files + update `.claude/CLAUDE.md`

Knowledge is split across focused files in `.claude/docs/`. Each file is **fully replaced** on every scan — never appended. `.claude/CLAUDE.md` stays as a lightweight index pointing to the docs.

### 7a — Write `.claude/docs/architecture.md`

```markdown
# Architecture — FinOps Dashboard
> Auto-generated by /scan-knowledge on [DATE].

[1–3 sentence summary of what the app does and its tech stack]

## Structure
[full directory tree from STEP 1 — app/, Presentation/, components/, lib/, app/api/]

## Features & Pages
[output from STEP 2 — one section per page/feature]

## API Routes
[output from STEP 3 — one section per endpoint]

## Data Flow
[end-to-end flow diagram from browser to external service]

## Key Constants
[constants found in Presentation/*/use*.ts — budget, dates, etc.]
```

### 7b — Write `.claude/docs/components.md`

```markdown
# Component & Hook Inventory — FinOps Dashboard
> Auto-generated by /scan-knowledge on [DATE].

## Components
[output from STEP 4 — all components/[Name]/index.tsx with props and hook refs]

## Presentation Hooks
[all Presentation/[Name]/use[Name].ts and useApi[Name].ts — what they manage/fetch]

## Lib Utilities
[output from STEP 5 — every lib file and its exports, one line each]

## Types
[lib/types/ files and the interfaces each contains]
```

### 7c — Write `.claude/docs/stack.md`

```markdown
# Stack — FinOps Dashboard
> Auto-generated by /scan-knowledge on [DATE].

## shadcn/ui Installed
[list installed components from components.json or components/ui/]

## TanStack Query
[client config, provider location, how to use]

## Dependencies
[output from STEP 6 — categorised dependency table]

## Important Rules
[hard rules the agent must never violate — from CLAUDE.md conventions]
```

### 7d — Update `.claude/CLAUDE.md` (index only)

`.claude/CLAUDE.md` is auto-loaded by Claude Code. Keep it as a **lightweight index** — commands + table of contents pointing to `docs/`. Do not put detailed content here.

```markdown
# FinOps Dashboard

## Commands
[dev, build, typecheck, lint, format, shadcn add]

## Project Docs (auto-loaded at session start via `.claude/docs/`)

| File | Content |
|------|---------|
| `docs/architecture.md` | Directory structure, features, API routes, data flow, key constants |
| `docs/components.md` | Component inventory, hooks, lib utilities, types |
| `docs/stack.md` | Dependencies, shadcn installed, TanStack Query, hard rules |
| `docs/flow.md` | BigQuery API quick-reference flowchart |
| `docs/bigquery-api-flow.md` | Full step-by-step trace of `/api/bigquery` |

> To add new project knowledge: drop a `.md` file in `.claude/docs/` — it gets auto-loaded next session.
```

> **Note:** `flow.md` and `bigquery-api-flow.md` are hand-maintained system design docs — do NOT overwrite them during scan.

---

## STEP 8 — Sync Agent Memory

After writing all `docs/` files, update two agent memory files:

### Update `project_status.md`

Read the current file first, then update:
- **Done ✅** — list every feature/page/component/API that was found during scan
- **Next Up 🟡** — anything that looks incomplete (empty hooks, TODO comments, stub components)
- **Not Started ❌** — features referenced in comments or types but with no implementation

Write back to `.claude/agent-memory/finops-agent/project_status.md`

### Update `project_architecture.md`

Read the current file first, then update:
- Data flow section — reflect actual current flow (not what it used to be)
- Component rules — confirm current folder structure pattern
- Key constants — update if changed
- Any new architectural decisions discovered during scan

Write back to `.claude/agent-memory/finops-agent/project_architecture.md`

### Update `MEMORY.md` index

Read `.claude/agent-memory/finops-agent/MEMORY.md`, ensure both updated files are listed with accurate one-line descriptions. Update entries if stale.

---

## STEP 9 — Report

Print a concise summary:

```
## Knowledge Scan Complete — [DATE]

### Scanned
- Pages:      N  (list routes)
- API routes: N  (list endpoints)
- Components: N  (list names)
- Lib files:  N  (list files)
- Hooks:      N  (list hooks)

### Written
- .claude/CLAUDE.md           ✅ index (commands + doc table only)
- .claude/docs/architecture.md ✅ [new / updated]
- .claude/docs/components.md   ✅ [new / updated]
- .claude/docs/stack.md        ✅ [new / updated]
- project_status.md            ✅ updated
- project_architecture.md      ✅ updated
- MEMORY.md                    ✅ index synced

### Highlights
- New since last scan: [anything not in old docs/]
- Stale/removed:       [anything in old docs/ no longer in codebase]
- TODOs found:         [any stub/empty implementations spotted]
```

---

## Rules for the Scanner

1. **Read actual files** — never summarise from memory alone; always verify current state
2. **Scan order matters** — do STEP 1 fully before 2, 2 before 3, etc. Each step builds on the previous
3. **Be exhaustive on pages and APIs** — these are the highest-value knowledge items
4. **One-line purpose per export** — in lib utilities, every export gets exactly one line of explanation
5. **Replace, don't append** — each `docs/` file is fully regenerated, never appended to; `CLAUDE.md` index is also replaced but stays minimal
6. **Dependency explanations must be honest** — if you don't know what a package does, read its entry in `package.json` scripts or grep for its usage before writing a description
7. **Flag stubs** — if a hook or component exists but has no real implementation (empty return, TODO), flag it in the report under "TODOs found"
8. **Sync memory last** — memory is updated after all `docs/` files are written, so it can reference them
9. **Never overwrite `flow.md` or `bigquery-api-flow.md`** — these are hand-maintained system design docs

---

## Usage

```
/scan-knowledge
```

No arguments. Always scans the full project.

**When to run:**
- After adding a new page or feature
- After a major refactor (e.g. restructuring components)
- After adding a new API route or external integration
- When starting a new conversation and memory feels stale
- Before handing the project to another developer or agent
