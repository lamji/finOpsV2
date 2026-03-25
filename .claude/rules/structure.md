---
paths:
  - "lib/**"
  - "components/**"
  - "app/**"
  - "hooks/**"
---

# Project Structure Rules — FinOps Dashboard

## 1. Types & Interfaces

**All types and interfaces MUST live in `lib/types/` — one file per feature.**

```
lib/
└── types/
    ├── dashboard.ts     ← types used by the dashboard feature
    ├── billing.ts       ← types used by billing/BigQuery
    └── [feature].ts     ← one file per domain/feature
```

- The file name matches the feature that owns those types (e.g. `dashboard.ts`, `billing.ts`)
- Never define `interface` or `type` aliases inside component files, hooks, pages, or lib utilities
- Always import types using `import type { ... } from "@/lib/types/[feature]"`
- When adding a new type, identify its feature first, then add it to the correct `lib/types/[feature].ts`
- If a type is shared across multiple features, create `lib/types/shared.ts`

```tsx
// ✅ Correct
import type { FinancialMetric, CostDriver } from "@/lib/types/dashboard"
import type { BillingRow } from "@/lib/types/billing"

// ❌ Never define types inline
interface CostDriver { ... }  // don't do this outside lib/types/

// ❌ Never import from a flat lib/types.ts
import type { CostDriver } from "@/lib/types"  // wrong — must be lib/types/[feature]
```

---

## 2. Component Folder Structure

Each feature component lives in its own folder under `components/`:

```
components/
└── [ComponentName]/           # PascalCase folder name
    ├── index.tsx              # UI — renders markup only, imports hook
    ├── use[ComponentName].ts  # Local state, derived values, UI logic
    └── useApi[ComponentName].ts  # Data fetching (useQuery / useMutation)
```

### Rules
- `index.tsx` — presentation only; no business logic, no `fetch`, no data derivation
- `use[ComponentName].ts` — UI state and logic (e.g. `useState`, `useCallback`, computed values)
- `useApi[ComponentName].ts` — API layer only (TanStack Query `useQuery` / `useMutation`)
- If a component has no API calls, omit `useApi[ComponentName].ts`
- If a component has no local state/logic, omit `use[ComponentName].ts`

### Example
```
components/
└── CostDrivers/
    ├── index.tsx              # renders the breakdown table
    ├── useCostDrivers.ts      # selected row state, sort logic
    └── useApiCostDrivers.ts   # useQuery → /api/cost-drivers
```

```tsx
// components/CostDrivers/index.tsx
"use client"
import { useCostDrivers } from "./useCostDrivers"

export function CostDrivers() {
  const { drivers, selected, onSelect } = useCostDrivers()
  return ( /* markup only */ )
}
```

---

## 3. Page Folder Structure

Pages use a thin shell in `app/` that delegates all rendering to a `Presentation/` layer.

```
app/
└── [pageName]/
    └── page.tsx               # NO code — imports and renders presentation component only

Presentation/
└── [PageName]/
    ├── index.tsx              # Full page layout — assembles feature components
    ├── use[PageName].ts       # Page-level state / orchestration logic
    └── useApi[PageName].ts    # Page-level data fetching (if needed)
```

### Rules
- `app/[pageName]/page.tsx` — one line of logic max: import + return `<PageNamePage />`
- All real code lives in `Presentation/[PageName]/`
- `Presentation/` sits at the project root (same level as `app/`, `components/`)
- No business logic, hooks, or JSX markup directly in `app/` page files

### Example
```
app/
└── dashboard/
    └── page.tsx

Presentation/
└── Dashboard/
    ├── index.tsx
    ├── useDashboard.ts
    └── useApiDashboard.ts
```

```tsx
// app/dashboard/page.tsx
import { Dashboard } from "@/Presentation/Dashboard"

export default function DashboardPage() {
  return <Dashboard />
}
```

```tsx
// Presentation/Dashboard/index.tsx
"use client"
import { useDashboard } from "./useDashboard"
import { StatsSection } from "@/components/StatsSection"
import { CostDrivers } from "@/components/CostDrivers"

export function Dashboard() {
  const { summary } = useDashboard()
  return (
    <main>
      <StatsSection />
      <CostDrivers />
    </main>
  )
}
```

---

## Summary Table

| What | Where |
|------|-------|
| Types & interfaces | `lib/types/[feature].ts` |
| UI component | `components/[Name]/index.tsx` |
| Component state/logic | `components/[Name]/use[Name].ts` |
| Component API calls | `components/[Name]/useApi[Name].ts` |
| Page shell (route) | `app/[name]/page.tsx` (import only) |
| Page layout/logic | `Presentation/[Name]/index.tsx` |
| Page state | `Presentation/[Name]/use[Name].ts` |
| Page API calls | `Presentation/[Name]/useApi[Name].ts` |
