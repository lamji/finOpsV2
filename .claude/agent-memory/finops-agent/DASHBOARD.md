# Dashboard Layout Architecture

This document describes the finOps dashboard skeleton structure and component organization.

## Layout Overview

```
┌─────────────────────────────────────────────┐
│         DashboardHeader (sticky)            │
│  "Dashboard" + User Menu                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         DashboardContent (main)             │
│                                             │
│  ┌─────────┬─────────┬─────────┐           │
│  │StatCard │StatCard │StatCard │           │
│  │  (KPI)  │  (KPI)  │  (KPI)  │           │
│  └─────────┴─────────┴─────────┘           │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │      ChartSection               │       │
│  │   (Line Chart Placeholder)      │       │
│  └─────────────────────────────────┘       │
│                                             │
│  ┌────────────────────────┐ ┌──────────┐  │
│  │                        │ │ Sidebar: │  │
│  │   MainContent          │ │          │  │
│  │   (Transactions Table) │ │ • Actions│  │
│  │                        │ │ • Alerts │  │
│  │                        │ │ • Stats  │  │
│  └────────────────────────┘ └──────────┘  │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         DashboardFooter (sticky)            │
│  Copyright + Quick Links                    │
└─────────────────────────────────────────────┘
```

## Component Structure

### File Organization

```
components/dashboard/
├── dashboard-header.tsx        # Top navigation (sticky)
├── dashboard-content.tsx       # Main container wrapper
├── dashboard-footer.tsx        # Bottom footer (sticky)
├── stats-section.tsx           # 3-column KPI cards
├── stat-card.tsx               # Individual stat card
├── chart-section.tsx           # Line chart area
├── main-content.tsx            # Left column (transactions)
└── dashboard-sidebar.tsx       # Right sidebar (actions/alerts)

app/
└── page.tsx                    # Page component (orchestrates layout)
```

## Component Descriptions

### DashboardHeader
- **Purpose**: Top navigation bar
- **Features**:
  - Sticky positioning
  - Title and description
  - User menu placeholder
  - Dark mode support
- **Responsive**: Yes (responsive text sizing)

### StatsSection
- **Purpose**: Display 3 KPI cards in a row
- **Features**:
  - Responsive grid (1 col on mobile, 2 on tablet, 3 on desktop)
  - Each card shows: label, value, trend
- **Children**: StatCard components

### StatCard
- **Purpose**: Individual KPI metric
- **Features**:
  - Label (e.g., "Total Expenses")
  - Value with skeleton loader
  - Trend indicator with color coding
  - Hover state
  - Animated skeleton during loading
- **Props**:
  - `label: string` - Card title
  - `value: string` - Metric value
  - `change: string` - Change percentage
  - `trend: "up" | "down" | "neutral"` - Trend direction

### ChartSection
- **Purpose**: Display expense trends
- **Features**:
  - Header with title and period info
  - 12 placeholder bars (animated)
  - Responsive height based on random data
  - Legend
  - Hover effects on bars
  - Dark mode gradient support

### MainContent
- **Purpose**: Display recent transactions table
- **Features**:
  - Table header with 4 columns
  - 5 placeholder rows
  - Skeleton animations
  - Responsive grid layout
  - Borders and spacing

### DashboardSidebar
- **Purpose**: Quick actions, alerts, and monthly stats
- **Features**:
  - Quick Actions card (4 buttons)
  - Alerts section (3 alert placeholders)
  - This Month stats (3 metrics)
  - Responsive stacking on mobile
  - Consistent styling with main content

### DashboardFooter
- **Purpose**: Footer with copyright and links
- **Features**:
  - Sticky positioning
  - Copyright text
  - Quick links (Documentation, Support, Settings)
  - Responsive alignment

## Responsive Behavior

### Breakpoints
- **Mobile** (< 640px): Single column layout
  - Stats: 1 column
  - Main content area: Full width (sidebar below)

- **Tablet** (640px - 1024px): 2-column stats
  - Stats: 2 columns
  - Main content area: Full width (sidebar below)

- **Desktop** (> 1024px): Full 3-column layout
  - Stats: 3 columns
  - Main content area: 2 columns (main + sidebar side-by-side)

### CSS Classes Used
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` - Responsive stats grid
- `grid-cols-1 gap-6 lg:grid-cols-3` - Responsive main/sidebar layout
- `lg:col-span-2` - Main content spans 2 cols on desktop
- `sticky top-0 z-50` - Sticky header
- `flex-1` - Main content takes remaining space

## Styling Approach

### Color System
- Uses TailwindCSS color tokens from configured design system
- `bg-background` - Base background
- `bg-card` - Card backgrounds
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `border-border` - Border color
- `bg-muted` - Muted backgrounds (skeleton placeholders)

### Interactive States
- `hover:bg-accent` - Hover state for cards
- `hover:from-primary/70` - Hover state for chart bars
- `transition-colors` - Smooth transitions
- `animate-pulse` - Skeleton loading animation

### Dark Mode
- Automatically supported via `next-themes`
- All colors use CSS variables
- No hardcoded dark mode specific classes needed
- Press 'd' to toggle dark mode

## Skeleton/Loading Pattern

All components use animated skeleton placeholders:
```tsx
<div className="h-4 w-24 rounded bg-muted animate-pulse" />
```

This pattern:
- Uses `bg-muted` background (light gray in light mode, dark gray in dark mode)
- Uses `animate-pulse` for animation (built into TailwindCSS)
- Matches final content dimensions
- Provides smooth loading experience

## How to Add Real Data

### StatCard
Replace skeleton with:
```tsx
<p className="text-2xl font-bold text-foreground">{value}</p>
```

### ChartSection
Replace bars with actual chart library (e.g., `recharts`, `visx`):
```tsx
import { LineChart, Line, XAxis, YAxis } from 'recharts'
```

### MainContent
Replace table skeleton with actual data rows:
```tsx
{transactions.map((tx) => (
  <div key={tx.id} className="grid grid-cols-4 gap-4 py-4">
    <p>{tx.name}</p>
    <p>{tx.date}</p>
    <p>{tx.category}</p>
    <p>{tx.amount}</p>
  </div>
))}
```

### DashboardSidebar
Add actual quick action buttons, real alerts, and calculated stats:
```tsx
{quickActions.map((action) => (
  <button key={action.id}>{action.label}</button>
))}
```

## Development Next Steps

1. **Add Real Data**: Replace skeleton loaders with actual API data
2. **Connect to API**: Fetch transactions, stats, chart data
3. **Add Interactivity**: Implement button actions, navigation
4. **Add Charts**: Use `recharts` or `visx` for proper charts
5. **Implement Filters**: Add date range, category, status filters
6. **Add Pagination**: For transactions table
7. **Error States**: Handle loading errors gracefully
8. **Empty States**: Show messages when no data available

## Code Quality

- ✅ TypeScript strict mode enforced
- ✅ All components properly typed
- ✅ Follows CLAUDE.md conventions
- ✅ Uses `@/` path aliases
- ✅ Proper component composition
- ✅ No hardcoded colors (uses theme system)
- ✅ Accessible HTML structure
- ✅ Responsive design
- ✅ Dark mode support
