---
name: Architecture Decisions
description: Key technical decisions and why they were made
type: project
---

## Data Flow
All data flows through `useGetData()` hook. Single source of truth. No prop drilling — components import the hook directly.

**Why:** Keeps data consistent and makes future API swap easy (just change the hook internals).

**How to apply:** New features should consume useGetData() or extend it. Don't create parallel data sources.

## Styling Rules
- TailwindCSS only — no inline styles, no CSS modules
- Semantic color tokens: bg-background, text-foreground, bg-card, border-border, text-muted-foreground
- Dark mode mandatory on every component with `dark:` prefix
- Trend colors: green (up/positive), red (down/negative), gray (neutral)

## Component Rules
- shadcn/ui for all UI primitives
- CVA for variants
- cn() for class merging
- Absolute imports only: @/components/..., @/hooks/..., @/lib/...
- "use client" only when truly needed (hooks, events, state)

## Icons
- Use **Lucide React** exclusively — no emojis, no unicode symbols
- Trend icons: `TrendingUp` (up), `TrendingDown` (down), `Minus` (neutral)
- QuickAction icons: `BarChart2` (export), `Bell` (alert), `Search` (review), `Lightbulb` (recommend)
- `QuickAction.icon` is typed as `LucideIcon` (imported from `lucide-react`)
- Standard icon size in buttons/inline: `h-4 w-4`, trend indicators: `h-3.5 w-3.5`
- Always add `shrink-0` on icons inside flex containers

## TanStack Query
- Installed: `@tanstack/react-query` v5
- Singleton client: `lib/query-client.ts` — 5min staleTime, 1 retry
- Provider: `components/providers/query-provider.tsx` — `"use client"` wrapper around `QueryClientProvider`
- Wired in: `app/layout.tsx` — `QueryProvider` wraps entire app (outside `ThemeProvider`)
- Use `useQuery` / `useMutation` in any client component — no extra setup needed

## Key Constants (in useGetData.ts)
- MONTHLY_BUDGET = 50_000
- daysElapsed = 21
- daysInMonth = 31 (March 2026)
