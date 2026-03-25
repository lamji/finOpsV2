# Stack — FinOps Dashboard

## shadcn/ui Installed
`button`, `chart` (Recharts wrapper), `sonner` (toast)

Add new components: `npx shadcn@latest add [name]`

## TanStack Query
- Client: `lib/query-client.ts` — 5min staleTime, 1 retry
- Provider: `components/QueryProvider/index.tsx` — `"use client"` wrapper
- Wired in `app/layout.tsx` — use `useQuery`/`useMutation` in any client component

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` 16 | App Router + React 19 |
| `tailwindcss` v4 | Utility-first CSS |
| `shadcn` / `radix-ui` | Headless accessible components |
| `class-variance-authority` | CVA variants |
| `lucide-react` | Icons (exclusively) |
| `next-themes` | Dark/light mode |
| `recharts` | Charts via shadcn chart wrapper |
| `@tanstack/react-query` v5 | Data fetching |
| `@anthropic-ai/sdk` | AI insights via claude-haiku-4-5 |
| `google-auth-library` | BigQuery OAuth |
| `ioredis` | Redis cache layer |
| `zod` | Env var validation in `lib/env.ts` |
| `pino` | Server-side logging in `lib/logger.ts` |

## Important Rules
- Never modify `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `package.json`
- Never define types outside `lib/types/[feature].ts`
- Never create parallel data sources — extend `useDashboard` / `useApiDashboard` instead
- Always run `npm run typecheck` before finalizing any implementation
- Dark mode toggle: press `d` key (implemented in `components/ThemeProvider/index.tsx`)
- Agent memory lives in `.claude/agent-memory/finops-agent/` — read before project files
