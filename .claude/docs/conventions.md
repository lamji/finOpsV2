# Conventions — FinOps Dashboard

## Icons
- **Lucide React exclusively** — no emojis, no unicode, no other icon libs
- `import { TrendingUp, Bell } from "lucide-react"`
- Standard sizes: `h-4 w-4` (inline/buttons), `h-3.5 w-3.5` (trend indicators)
- Always add `shrink-0` on icons inside flex containers
- Trend icons: `TrendingUp` (up), `TrendingDown` (down), `Minus` (neutral)

## Imports
- Absolute only — `@/components/`, `@/Presentation/`, `@/lib/`
- Never `../../` relative paths
- Order: React → third-party → `@/` → local (`./`)

## Types
- All shared types in `lib/types/[feature].ts` — never inline in components
- Always `import type { ... } from "@/lib/types/[feature]"`
- One file per domain: `dashboard.ts`, `billing.ts`, etc.
- Shared across features → `lib/types/shared.ts`

## Styling
- TailwindCSS only — no inline styles, no CSS modules
- `cn()` from `@/lib/utils` for all className merging
- CVA (`cva()`) required for any component with style variants

## Dark Mode
- Mandatory `dark:` prefix on every color/background class
- Semantic color tokens only — no hardcoded colors

| Token | Use for |
|-------|---------|
| `bg-background` | Page background |
| `bg-card` | Card surfaces |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/helper text |
| `border-border` | Borders and dividers |
| `bg-accent` | Hover states |

- Trend colors: `text-green-600 dark:text-green-400` (up), `text-red-600 dark:text-red-400` (down)

## Client vs Server Components
- Default: server component (no directive)
- Add `"use client"` only for: `useState`, `useEffect`, `useCallback`, `useRef`, event handlers, browser APIs, `useTheme()`, `useDashboard()`, `useQuery`, `useMutation`

## Naming
- Components: PascalCase folder + `index.tsx` (`DashboardHeader/index.tsx`)
- Hooks: camelCase (`useDashboard.ts`, `useApiDashboard.ts`)
- Constants: UPPER_SNAKE_CASE
- Types file: match feature name (`dashboard.ts`, `billing.ts`)
