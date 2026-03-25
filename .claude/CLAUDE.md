# FinOps Dashboard

## Commands
- Dev: `npm run dev` (Turbopack, http://localhost:3000)
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format: `npm run format`
- Add shadcn component: `npx shadcn@latest add [name]`

## Project Docs (auto-loaded at session start via `.claude/docs/`)

| File | Content |
|------|---------|
| `docs/architecture.md` | Directory structure, data flow, key constants |
| `docs/conventions.md` | Icons, imports, types, styling, dark mode, naming |
| `docs/stack.md` | Dependencies, shadcn installed, TanStack Query, hard rules |
| `docs/flow.md` | BigQuery API quick-reference flowchart |
| `docs/bigquery-api-flow.md` | Full step-by-step trace of `/api/bigquery` |
| `docs/finops-engine-flow.md` | Full trace of `aggregate()` + `generateInsights()` in `lib/finops-engine.ts` |
| `docs/last-month-spend.md` | Stat cards reference — all 4 cards, period derivation, edge cases, data accuracy |

> To add new project knowledge: drop a `.md` file in `.claude/docs/` — it gets auto-loaded next session.
