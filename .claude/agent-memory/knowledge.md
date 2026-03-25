# FinOps Dashboard - Project Knowledge Base

This document is the **single source of truth** for project context. The finops-agent uses this to understand the full project scope.

**Last Updated:** March 21, 2026
**Project Status:** In Development (Dashboard MVP)

---

## 🎯 Project Overview

**FinOps Dashboard** is a real-time financial operations dashboard for tracking cloud spending, budget utilization, and cost optimization opportunities.

**Stack:**
- Next.js 16 + React 19 (TypeScript)
- TailwindCSS + shadcn/ui
- Recharts for data visualization
- Dark mode via next-themes
- Lucide React for icons

**Monthly Budget:** $50,000 (March 2026)

---

## 📁 Project Structure

```
finOps/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (fonts, ThemeProvider)
│   ├── page.tsx                 # Home page (dashboard entry point)
│   └── globals.css              # Global TailwindCSS styles
│
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx           # Button component with CVA variants
│   │   └── chart.tsx            # Recharts wrapper
│   │
│   ├── dashboard/               # Dashboard-specific components
│   │   ├── dashboard-header.tsx     # Top navigation/header
│   │   ├── dashboard-content.tsx    # Main content wrapper
│   │   ├── dashboard-footer.tsx     # Footer section
│   │   ├── dashboard-sidebar.tsx    # Right sidebar
│   │   ├── main-content.tsx         # Cost Drivers breakdown
│   │   ├── stats-section.tsx        # Financial metrics cards
│   │   ├── chart-section.tsx        # Chart/graph section
│   │   └── stat-card.tsx            # Individual stat card component
│   │
│   └── theme-provider.tsx       # Dark/light mode provider
│
├── hooks/                        # Custom React hooks
│   └── useGetData.ts            # Central data source hook
│
├── lib/                          # Utilities
│   └── utils.ts                 # cn() class merge utility
│
├── public/                       # Static assets
│
├── .claude/                      # Claude Code configuration
│   ├── agents/
│   │   └── finops-agent.md      # Agent definition
│   ├── settings.json            # Project settings
│   ├── rules.md                 # Project conventions
│   └── knowledge.md             # This file (project inventory)
│
└── Configuration files
    ├── package.json             # Dependencies (read-only to agent)
    ├── tsconfig.json            # TypeScript config (read-only)
    ├── tailwind.config.ts       # TailwindCSS config (read-only)
    ├── next.config.js           # Next.js config (read-only)
    ├── .mcp.json                # MCP servers config
    └── components.json          # shadcn/ui config
```

---

## 🧩 Components Inventory

### Dashboard Layout Components

#### `DashboardHeader` (dashboard-header.tsx)
- **Purpose:** Top navigation bar
- **Usage:** Displayed at top of every page
- **Props:** Likely none (global header)
- **Status:** ✅ Implemented

#### `DashboardContent` (dashboard-content.tsx)
- **Purpose:** Main content wrapper
- **Usage:** Wraps all dashboard sections
- **Props:** `children: React.ReactNode`
- **Status:** ✅ Implemented

#### `DashboardFooter` (dashboard-footer.tsx)
- **Purpose:** Footer section
- **Usage:** Bottom of page
- **Props:** None likely
- **Status:** ✅ Implemented

#### `DashboardSidebar` (dashboard-sidebar.tsx)
- **Purpose:** Right sidebar (for filters, quick actions, etc.)
- **Usage:** Right column of 2-col layout
- **Props:** None likely
- **Status:** ✅ Implemented

### Dashboard Content Components

#### `StatsSection` (stats-section.tsx)
- **Purpose:** Display financial metrics cards (MTD Spend, Daily Burn Rate, Projected Monthly, etc.)
- **Data Source:** `useGetData().financialOverview`
- **Child Component:** `StatCard` (repeated for each metric)
- **Status:** ✅ Implemented

#### `StatCard` (stat-card.tsx)
- **Purpose:** Individual metric card with value, change%, and trend
- **Props:**
  ```tsx
  {
    label: string           // "MTD Spend"
    value: string           // "$33,270"
    change: string          // "+2.5%"
    trend: "up"|"down"|"neutral"
    description: string     // "21 of 31 days elapsed"
  }
  ```
- **Status:** ✅ Implemented

#### `ChartSection` (chart-section.tsx)
- **Purpose:** Visualize spending trends over time
- **Data Source:** `useGetData()` (chart data TBD)
- **Chart Library:** Recharts
- **Status:** ✅ Implemented (structure in place)

#### `MainContent` (main-content.tsx)
- **Purpose:** Cost Drivers breakdown (granular spending by category)
- **Data Source:** `useGetData().costDrivers`
- **Features:**
  - Displays breakdown items: Compute, Storage, Network, Services, Other
  - Shows amount, percentage, trend, change
  - Progress bars for visual representation
  - Hover effects
- **Status:** ✅ Implemented & functional

### UI Components (shadcn/ui)

#### `Button` (ui/button.tsx)
- **Purpose:** Reusable button component with variants
- **Variants:**
  - `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  - `size`: "default" | "sm" | "lg" | "icon"
  - `asChild`: boolean (render as different element)
- **Status:** ✅ Implemented (from shadcn CLI)

#### `Chart` (ui/chart.tsx)
- **Purpose:** Recharts wrapper with styling
- **Usage:** For data visualization
- **Status:** ✅ Implemented

### Provider Component

#### `ThemeProvider` (theme-provider.tsx)
- **Purpose:** Dark/light mode management
- **Library:** next-themes
- **Features:**
  - Keyboard shortcut: Press 'd' to toggle (doesn't trigger on inputs)
  - Default: light mode with system detection
  - Theme attribute: `class`
- **Usage:** Wraps entire app in Root Layout
- **Status:** ✅ Implemented

---

## 🪝 Hooks Inventory

### `useGetData` (hooks/useGetData.ts)

**Purpose:** Central data source hook - returns all dashboard data

**Returns:**
```tsx
{
  financialOverview: FinancialMetric[]     // 6 metrics cards
  summary: FinancialSummary                // Period info
  costDrivers: CostDriver[]                // Cost breakdown
  alerts: Alert[]                          // Warning/info alerts
  quickActions: QuickAction[]              // Quick action buttons
}
```

**Key Data:**

1. **FinancialMetric** (6 items):
   - MTD Spend: $33,270 (3% overspend trend)
   - Daily Burn Rate: $1,584/day (avg over 21 days)
   - Projected Monthly: $51,375 (vs $50k budget)
   - Budget Remaining: $16,730 (46 days left)
   - Budget Utilization: 66.5%
   - Monthly Budget: $50,000 (fixed)

2. **CostDriver** (5 items - breakdown of MTD Spend):
   - Compute (EC2, VMs): 35% ($11,644)
   - Storage (S3, DB): 28% ($9,315)
   - Network & Data Transfer: 18% ($5,989)
   - Third-party Services: 12% ($3,992)
   - Other: 7% ($2,330)

3. **Alerts** (3 items):
   - Budget Alert: "Current trajectory exceeds budget by ~$1,375"
   - Compute Spike: "Compute costs up 12% this week"
   - Opportunity: "Network costs down 5%"

4. **QuickActions** (4 items):
   - Export Report (📊)
   - Set Budget Alert (⚠️)
   - Review Costs (🔍)
   - Get Recommendations (💡)

**Configuration:**
```js
const MONTHLY_BUDGET = 50_000  // Single source of truth
const daysElapsed = 21         // Current day in month
const daysInMonth = 31         // March 2026
```

**Status:** ✅ Implemented (mock data, real data endpoint TBD)

---

## 🎨 Styling & Design System

### TailwindCSS
- **Framework:** Tailwind CSS v4.2.1 (PostCSS plugin)
- **Dark Mode:** `class` strategy
- **Responsive:** Mobile-first breakpoints (sm, md, lg, xl, 2xl)
- **Animation:** `tw-animate-css` library included

### Color Palette (Semantic)
- Background: `bg-background`
- Foreground (text): `text-foreground`
- Card: `bg-card`
- Borders: `border-border`
- Muted text: `text-muted-foreground`
- Accents: `bg-accent/50`, `hover:bg-accent`

### Trend Indicators
- **Up** (positive): 📈 Green (`text-green-600 dark:text-green-400`)
- **Down** (negative): 📉 Red (`text-red-600 dark:text-red-400`)
- **Neutral:** → Gray (`text-muted-foreground`)

### Fonts
- **Sans serif:** Geist (default)
- **Monospace:** Geist Mono (code, data)
- **CSS Variables:** `--font-sans`, `--font-mono`

---

## 📊 Data Architecture

### Current State (Mock Data)
- All data comes from `useGetData()` hook
- Mock values simulate realistic spending patterns
- Calculations are deterministic (same values every page load)

### Data Flow
```
useGetData() [hook]
    ↓
    ├─→ financialOverview → StatsSection → StatCard (x6)
    ├─→ summary → Dashboard header
    ├─→ costDrivers → MainContent (breakdown table)
    ├─→ alerts → (Display location TBD)
    └─→ quickActions → DashboardSidebar or MainContent
```

### Types Defined (in useGetData.ts)
```tsx
interface FinancialMetric {
  label: string          // "MTD Spend"
  value: string          // "$33,270"
  change: string         // "+2.5%"
  trend: "up" | "down" | "neutral"
  description: string    // "21 of 31 days elapsed"
}

interface FinancialSummary {
  period: string         // "March 2026"
  daysElapsed: number    // 21
  daysInMonth: number    // 31
  daysRemaining: number  // 10
}

interface CostDriver {
  name: string           // "Compute (EC2, VMs)"
  amount: number         // 11644
  percentage: number     // 35
  trend: "up" | "down" | "neutral"
  change: string         // "+12%"
}

interface Alert {
  id: string
  type: "warning" | "info" | "success"
  title: string
  message: string
}

interface QuickAction {
  id: string
  label: string
  icon: string           // Unicode emoji
}
```

---

## 🚀 Current Implementation Status

### ✅ Completed
- [x] Next.js 16 + React 19 setup
- [x] TailwindCSS + dark mode configuration
- [x] shadcn/ui integration (Button, Chart)
- [x] Root layout with ThemeProvider
- [x] Home page dashboard layout (flexbox)
- [x] All dashboard structural components
- [x] Stats cards with real metrics
- [x] Cost Drivers breakdown section
- [x] Dark mode toggle (press 'd')
- [x] Type-safe data structures
- [x] Mock data generation hook

### 🟡 In Progress / Next Steps
- [ ] Chart visualization (Recharts implementation)
- [ ] Display alerts section
- [ ] Quick actions functionality
- [ ] Real data integration (API endpoints)
- [ ] Budget forecasting improvements
- [ ] Trend analysis and alerts

### ❌ Not Started
- [ ] Authentication / User management
- [ ] API endpoints for real data
- [ ] Database integration
- [ ] Detailed analytics pages
- [ ] Export/reporting features
- [ ] Budget alert notifications
- [ ] Cost optimization recommendations

---

## 🔌 Dependencies & Libraries

### Core
- `next`: 16.1.7 (App Router)
- `react`: 19.2.4
- `react-dom`: 19.2.4
- `typescript`: 5.9.3

### Styling
- `tailwindcss`: 4.2.1 (Utility CSS)
- `@tailwindcss/postcss`: 4.2.1
- `postcss`: 8.x
- `tw-animate-css`: 1.4.0 (Animations)

### UI & Components
- `shadcn`: 4.1.0 (Component CLI)
- `radix-ui`: 1.4.3 (Headless components)
- `class-variance-authority`: 0.7.1 (CVA variants)
- `lucide-react`: 0.577.0 (Icons)

### Utilities
- `clsx`: 2.1.1 (Class composition)
- `tailwind-merge`: 3.5.0 (Merge TailwindCSS classes)

### Features
- `next-themes`: 0.4.6 (Dark mode)
- `recharts`: 2.15.4 (Charts/graphs)

### Dev Tools
- `prettier`: 3.8.1 + `prettier-plugin-tailwindcss`: 0.7.2
- `eslint`: 9.39.4 + `eslint-config-next`
- `@types/*`: Node, React, ReactDOM

---

## 📝 Key Conventions

### Imports
```tsx
// ✅ Correct (absolute imports)
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import useGetData from "@/hooks/useGetData"

// ❌ Avoid (relative imports)
import { Button } from "../../components/ui/button"
```

### Component Files
- PascalCase filenames: `StatCard.tsx`
- Match export name: `export function StatCard {}`
- Use `"use client"` only when needed (hooks, events)

### Styling
```tsx
// ✅ TailwindCSS classes
className={cn("px-4 py-2", isActive && "bg-blue-500", customClass)}

// ❌ Never inline styles or CSS modules
style={{ color: "blue" }}  // Don't do this
import styles from "./file.module.css"  // Don't do this
```

### Dark Mode
```tsx
// ✅ Use dark: prefix
className="bg-white dark:bg-slate-900"

// ❌ Don't hardcode colors
className="bg-white"  // Breaks dark mode
```

---

## 🛠️ Common Tasks

### Add a New Metric Card
1. Update `useGetData()` to add metric to `financialOverview` array
2. Import `StatCard` in `StatsSection`
3. Add new item to the map loop
4. The card will render automatically with styling

### Add New Cost Driver
1. Update `useGetData()` costDrivers array
2. `MainContent` component maps over it automatically
3. Progress bar and styling handled by component

### Add a New Component
```bash
# Create from shadcn/ui
npx shadcn@latest add [component]

# Or create custom component
# Place in components/dashboard/ or components/ui/
# Use CVA for variants
# Use TailwindCSS for styling
```

### Update Budget
1. Edit `MONTHLY_BUDGET` constant in `useGetData.ts`
2. All metrics recalculate automatically
3. Run `npm run dev` to see changes

---

## 🚨 Important Notes for the Agent

### Project Boundaries
- **Do modify:** Components, hooks, lib utilities, styles
- **Don't modify:** Configuration files, package.json, build setup
- **Check first:** Any changes affecting data structure should update types

### Quality Gates
Before implementing changes:
1. Run `npm run typecheck` (type safety)
2. Run `npm run lint` (code style)
3. Run `npm run dev` to test locally
4. Follow CLAUDE.md conventions

### Data Consistency
- All data sources flow through `useGetData()`
- Update types in one place
- Keep calculations deterministic until real API is added
- MONTHLY_BUDGET is the single source of truth

### Styling
- Dark mode support is mandatory
- Use semantic color names (background, foreground, card, etc.)
- Test with `d` key to toggle dark mode
- Responsive breakpoints for mobile/tablet/desktop

---

## 📞 Questions for Implementation

When adding features, consider:
1. Should data come from `useGetData()` or a new hook?
2. Is this a new component or extends existing one?
3. Does it need new types/interfaces?
4. Does it need API integration (future)?
5. Does it need dark mode consideration?
6. Is it responsive for all screen sizes?

---

## 🎓 References

- **CLAUDE.md:** Architecture patterns and conventions
- **rules.md:** Project-specific development rules
- **existing components:** Reference patterns used in StatCard, MainContent, etc.

---

**This knowledge base is the agent's context. Update it when architecture changes.**
