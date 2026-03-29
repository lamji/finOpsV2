---
paths:
  - "app/**/*.tsx"
  - "app/**/*.ts"
  - "components/**/*.tsx"
  - "components/**/*.ts"
  - "hooks/**/*.ts"
---

# Frontend Rules — FinOps Dashboard

## Component Structure

Every component must:
- Use shadcn/ui primitives (never raw `<button>`, `<input>`, etc. where shadcn equivalents exist)
- Apply CVA (`cva()`) for any component that has style variants
- Use `cn()` from `@/lib/utils` for all className merging
- Support dark mode with `dark:` prefix on every color/background class

```tsx
// ✅ Correct pattern
const cardVariants = cva("rounded-lg border bg-card", {
  variants: {
    size: { sm: "p-3", md: "p-4", lg: "p-6" }
  },
  defaultVariants: { size: "md" }
})

export function Card({ className, size, ...props }: CardProps) {
  return <div className={cn(cardVariants({ size }), className)} {...props} />
}
```

## Data Consumption

- All dashboard data comes from `Presentation/Dashboard/useDashboard.ts` — never duplicate
- `useDashboard()` returns: `financialOverview`, `summary`, `byService`, `byProject`, `bySku`, `charts`, `alerts`, `isLoading`, `isError`, `error`
- Feature-specific API hooks live in `Presentation/[Name]/useApi[Name].ts` (TanStack `useQuery`)
- Types are defined in `lib/types/[feature].ts` — always import from there, never redefine inline

## Current Client Components

| Component | Hook used | Purpose |
|-----------|-----------|---------|
| `StatsSection` | `useDashboard()` | 4 stat cards grid |
| `MainContent` | `useDashboard()` | Cost breakdown by service/project/SKU |
| `ChartSection` | `useDashboard()` | Recharts LineChart — expense trend |
| `DashboardSidebar` | `useDashboard()` | Period summary |
| `DashboardInsights` | `useDashboard()` | AI alerts grid (warning/info/success) |
| `DashboardDataSync` | `useDashboard()` | Side-effect only — `toast.error()` on failure |
| `FloatingChatbotButton` | `useDashboard()` | Chat widget → `POST /api/chatbot` |

## Icons

- **Lucide React only** — `import { TrendingUp, Bell } from "lucide-react"`
- No emojis, no unicode symbols, no other icon libraries
- Standard sizes: `h-4 w-4` (inline/buttons), `h-3.5 w-3.5` (trend indicators)
- Always add `shrink-0` on icons inside flex containers
- Trend icons: `TrendingUp` (up), `TrendingDown` (down), `Minus` (neutral)

## Styling

```tsx
// ✅ Correct
className="bg-card text-foreground dark:bg-card/90 hover:bg-accent"

// ❌ Never
style={{ backgroundColor: "white" }}
className="bg-white"  // hardcoded color breaks dark mode
```

Semantic tokens to use:
| Token | Use for |
|-------|---------|
| `bg-background` | Page background |
| `bg-card` | Card surfaces |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/helper text |
| `border-border` | Borders and dividers |
| `bg-accent` | Hover states |

## Client vs Server Components

Default to **server components** (no directive needed). Add `"use client"` only for:
- `useState`, `useEffect`, `useCallback`, `useRef`
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `document`, etc.)
- `useTheme()`, `useDashboard()`, or any custom hook
- TanStack Query (`useQuery`, `useMutation`)

## Responsive Design

Always implement mobile-first breakpoints:
```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
```

## Imports (mandatory order)

```tsx
// 1. React
import { useState } from "react"

// 2. Third-party
import { TrendingUp } from "lucide-react"

// 3. Internal @/
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FinancialMetric } from "@/lib/types/dashboard"

// 4. Local (same directory, if any)
```
