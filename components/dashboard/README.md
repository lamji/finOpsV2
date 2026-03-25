# Dashboard Components

This directory contains all reusable dashboard components for the finOps application.

## Component Tree

```
Dashboard (app/page.tsx)
├── DashboardHeader
│   └── Sticky navigation bar
├── DashboardContent
│   ├── StatsSection
│   │   ├── StatCard (label, value, change, trend)
│   │   ├── StatCard
│   │   └── StatCard
│   ├── ChartSection
│   │   └── Line chart visualization
│   └── MainContent + DashboardSidebar
│       ├── MainContent
│       │   └── Transactions table
│       └── DashboardSidebar
│           ├── Quick Actions
│           ├── Alerts
│           └── This Month Stats
└── DashboardFooter
    └── Copyright + links
```

## Component Files

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard-header.tsx` | ~24 | Top navigation (sticky) |
| `dashboard-content.tsx` | ~14 | Main container wrapper |
| `dashboard-footer.tsx` | ~28 | Bottom footer (sticky) |
| `stats-section.tsx` | ~24 | 3-column KPI cards |
| `stat-card.tsx` | ~39 | Individual stat card |
| `chart-section.tsx` | ~51 | Line chart placeholder |
| `main-content.tsx` | ~43 | Transactions table |
| `dashboard-sidebar.tsx` | ~76 | Right sidebar content |

## Quick Import

```tsx
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { StatsSection } from "@/components/dashboard/stats-section"
import { StatCard } from "@/components/dashboard/stat-card"
import { ChartSection } from "@/components/dashboard/chart-section"
import { MainContent } from "@/components/dashboard/main-content"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DashboardFooter } from "@/components/dashboard/dashboard-footer"
```

## Responsive Behavior

All components are fully responsive:
- **Mobile**: Single column, stacked layout
- **Tablet**: 2-column cards, full-width content
- **Desktop**: 3-column cards, 2-column main+sidebar

## Data Integration Points

### StatCard
- Accept `value`, `change`, `trend` props
- Replace skeleton with real calculated values
- Add onclick handlers for drill-down

### ChartSection
- Replace placeholder bars with recharts/visx
- Add date range picker
- Fetch data from API

### MainContent
- Replace table skeleton with real transactions
- Add pagination
- Add filters (date, category, amount)
- Add sorting

### DashboardSidebar
- Add real quick action buttons
- Fetch alerts from API
- Calculate dynamic stats
- Add click handlers

## Styling Conventions

All components use:
- TailwindCSS utility classes
- `cn()` function for class merging
- Theme system colors (no hardcoded colors)
- `animate-pulse` for skeleton loading
- Dark mode support (automatic)

## Type Safety

All components are fully typed:
```tsx
interface StatCardProps {
  label: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
}
```

Use `React.ComponentProps<"element">` for native HTML attributes.
