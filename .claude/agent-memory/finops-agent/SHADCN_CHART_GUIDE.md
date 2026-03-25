# shadcn Line Chart Implementation

## Overview

The dashboard now uses **shadcn/ui's chart components** for a more cohesive design system integration. shadcn's chart wrapper provides automatic theming, proper dark mode support, and styled components that match the dashboard design perfectly.

---

## What is shadcn Chart?

shadcn's chart component is a **wrapper around recharts** that provides:

1. **ChartContainer** - Theme-aware container with CSS variable configuration
2. **ChartTooltip** - Enhanced tooltip with theme support
3. **ChartTooltipContent** - Styled tooltip content component
4. **ChartLegend** - Enhanced legend
5. **ChartLegendContent** - Styled legend component
6. **ChartStyle** - Automatic theme style injection

---

## Chart Configuration

```typescript
const chartConfig = {
  expenses: {
    label: "Actual Expenses",
    color: "hsl(var(--primary))",
  },
  budget: {
    label: "Budget",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig
```

### Configuration Properties

| Property | Type | Purpose |
|----------|------|---------|
| `label` | `React.ReactNode` | Display name in legend |
| `color` | `string` | CSS color (supports hsl variables) |
| `icon` | `React.ComponentType` | Optional icon for legend |

### Using CSS Variables

Colors should use `hsl(var(--variable-name))` for automatic dark mode support:

```typescript
// ✅ CORRECT - Uses CSS variable
color: "hsl(var(--primary))"

// ✅ CORRECT - Uses named color
color: "hsl(var(--muted-foreground))"

// ❌ AVOID - Hardcoded color
color: "#3b82f6"
```

---

## Component Implementation

### ChartSection Component

```typescript
export function ChartSection() {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Expense Trend
          </h3>
          <p className="text-sm text-muted-foreground">Last 12 months</p>
        </div>
      </div>

      {/* Chart Container (shadcn wrapper) */}
      <ChartContainer config={chartConfig} className="h-80 w-full">
        <LineChart data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />

          {/* Line configurations */}
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="var(--color-expenses)"
            strokeWidth={2}
            dot={{ fill: "var(--color-expenses)", r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="budget"
            stroke="var(--color-budget)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: "var(--color-budget)", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
```

### Key Points

1. **ChartContainer** wraps the entire LineChart
   - Provides `config` prop with chart configuration
   - Injects CSS variables automatically
   - Handles dark mode theming

2. **Color Variables** use kebab-case from config keys
   - `expenses` key → `var(--color-expenses)`
   - `budget` key → `var(--color-budget)`

3. **ChartTooltip/ChartLegend** use shadcn content components
   - `<ChartTooltipContent />` - Styled tooltip
   - `<ChartLegendContent />` - Styled legend

---

## Data Structure

```typescript
const chartData = [
  { month: "Jan", expenses: 4500, budget: 5000 },
  { month: "Feb", expenses: 5200, budget: 5000 },
  // ... 12 months total
]
```

### Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `month` | string | Month label (Jan-Dec) |
| `expenses` | number | Actual expenses amount |
| `budget` | number | Budget threshold |

---

## Styling Features

### Grid Customization

```typescript
<CartesianGrid vertical={false} />  // Hide vertical grid lines
```

Options:
- `vertical={false}` - Only show horizontal grid
- `horizontal={false}` - Only show vertical grid
- `strokeDasharray="3 3"` - Custom dashed pattern

### Axis Customization

```typescript
<XAxis
  dataKey="month"
  tickLine={false}        // Hide tick lines
  axisLine={false}        // Hide axis line
  tick={{
    fill: "hsl(var(--muted-foreground))",
    fontSize: 12
  }}
/>
```

### Line Customization

```typescript
<Line
  type="monotone"         // Smooth curve interpolation
  dataKey="expenses"      // Data field to visualize
  stroke="var(--color-expenses)"  // Line color (CSS variable)
  strokeWidth={2}         // Line thickness
  strokeDasharray="5 5"   // Dashed pattern: 5px dash, 5px gap
  dot={{
    fill: "var(--color-expenses)",
    r: 4                  // Dot radius
  }}
  activeDot={{
    r: 6                  // Hover dot radius
  }}
  isAnimationActive       // Enable animations
/>
```

---

## Dark Mode Support

### Automatic Theme Switching

The shadcn chart automatically adapts to dark mode through CSS variables:

```css
/* Light mode (defined in CSS variables) */
--primary: hsl(200 100% 50%)        /* Blue */
--muted-foreground: hsl(0 0% 45%)   /* Gray */

/* Dark mode (automatically inverted) */
--primary: hsl(200 100% 60%)        /* Lighter blue */
--muted-foreground: hsl(0 0% 65%)   /* Lighter gray */
```

**How it works:**
1. shadcn's ChartContainer injects CSS variables
2. Dark mode class (`.dark`) on `<html>` element
3. CSS variables automatically switch values
4. Chart colors adapt instantly

**Testing:**
```bash
npm run dev
# Press 'd' to toggle dark mode
# Chart colors change automatically
```

---

## Customization Examples

### Adding a Third Line

```typescript
const chartConfig = {
  expenses: { label: "Actual", color: "hsl(var(--primary))" },
  budget: { label: "Budget", color: "hsl(var(--muted-foreground))" },
  savings: { label: "Savings", color: "hsl(var(--success))" },  // NEW
} satisfies ChartConfig

// In LineChart:
<Line
  type="monotone"
  dataKey="savings"
  stroke="var(--color-savings)"
  strokeWidth={2}
  dot={{ fill: "var(--color-savings)", r: 4 }}
/>
```

### Changing Chart Height

```typescript
// Default: h-80 (320px)
<ChartContainer config={chartConfig} className="h-96 w-full">
  {/* ... */}
</ChartContainer>

// Options: h-64, h-72, h-80, h-96, h-screen, etc.
```

### Custom Tooltip Formatter

```typescript
<ChartTooltip
  content={
    <ChartTooltipContent
      formatter={(value) => `$${value.toLocaleString()}`}
    />
  }
/>
```

### Hide Legend

```typescript
// Option 1: Remove the component
{/* <ChartLegend content={<ChartLegendContent />} /> */}

// Option 2: Hide with CSS
<ChartLegend content={<ChartLegendContent />} className="hidden" />
```

---

## API Integration

### Fetch Data from API

```typescript
"use client"

import { useEffect, useState } from "react"

export function ChartSection() {
  const [chartData, setChartData] = useState(chartData)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/expenses")
      .then(res => res.json())
      .then(data => {
        setChartData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="h-80 bg-muted animate-pulse rounded" />
  }

  return (
    // ... chart code
  )
}
```

### With React Query

```typescript
import { useQuery } from "@tanstack/react-query"

export function ChartSection() {
  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => fetch("/api/expenses").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="h-80 bg-muted animate-pulse rounded" />
  }

  // ... chart rendering
}
```

---

## Responsive Behavior

### Automatic Responsiveness

The `ChartContainer` with `ResponsiveContainer` from recharts ensures the chart:
- Adapts to container width automatically
- Maintains aspect ratio
- Works on all screen sizes

```typescript
<ChartContainer config={chartConfig} className="h-80 w-full">
  {/* ResponsiveContainer is built into ChartContainer */}
  <LineChart data={chartData}>
    {/* ... */}
  </LineChart>
</ChartContainer>
```

### Custom Responsive Classes

```typescript
// Adjust height based on screen size
<ChartContainer
  config={chartConfig}
  className="h-64 sm:h-80 lg:h-96 w-full"
>
  {/* ... */}
</ChartContainer>
```

---

## Performance Considerations

### 1. Memoization

```typescript
import { memo } from "react"

export const ChartSection = memo(function ChartSection() {
  // Component code
})
```

### 2. Lazy Loading

```typescript
import { lazy, Suspense } from "react"

const ChartSection = lazy(() =>
  import("@/components/dashboard/chart-section").then(mod => ({
    default: mod.ChartSection
  }))
)

// In parent:
<Suspense fallback={<ChartSkeleton />}>
  <ChartSection />
</Suspense>
```

### 3. Data Caching

```typescript
const { data } = useQuery({
  queryKey: ["expenses"],
  queryFn: () => fetch("/api/expenses").then(r => r.json()),
  staleTime: 10 * 60 * 1000,  // Cache for 10 minutes
  gcTime: 60 * 60 * 1000,     // Keep in memory for 1 hour
})
```

---

## Accessibility

### Color Blindness

Use multiple visual indicators beyond color:
```typescript
// Dashed line helps distinguish in addition to color
<Line strokeDasharray="5 5" />

// Dots also help identify lines
<Line dot={{ r: 4 }} />
```

### Labels

```typescript
// Always provide labels for accessibility
const chartConfig = {
  expenses: {
    label: "Actual Expenses",  // ← Accessible label
    color: "hsl(var(--primary))",
  },
}
```

### Keyboard Navigation

- ChartLegend items are clickable
- Tooltip appears on hover (mouse) or focus (keyboard)
- Uses semantic HTML

---

## Files and Structure

```
components/
├── dashboard/
│   └── chart-section.tsx       ← Your chart component
└── ui/
    └── chart.tsx               ← shadcn chart wrapper

app/
└── page.tsx                    ← Uses ChartSection
```

---

## Troubleshooting

### Colors Not Showing

**Issue:** Lines appear invisible
**Solution:** Ensure colors use `var(--color-keyname)` where keyname matches config keys

```typescript
// ✅ Correct
color: "var(--color-expenses)"

// ❌ Wrong
color: "var(--color-actual-expenses)"
```

### Dark Mode Not Working

**Issue:** Chart colors don't change in dark mode
**Solution:** Use CSS variables, not hardcoded colors

```typescript
// ✅ Use CSS variable
color: "hsl(var(--primary))"

// ❌ Don't hardcode
color: "#3b82f6"
```

### Tooltip Not Showing

**Issue:** Tooltips don't appear on hover
**Solution:** Ensure ChartTooltip content is correct

```typescript
<ChartTooltip content={<ChartTooltipContent />} />
```

---

## Summary

✅ **shadcn chart components provide:**
- Automatic theming with CSS variables
- Dark mode support out of the box
- Styled tooltips and legends
- Better design system integration
- Consistent with dashboard styling
- Type-safe configuration

✅ **Your chart features:**
- Dual-line visualization (Expenses vs Budget)
- Interactive tooltips
- Clickable legend
- Smooth animations
- Fully responsive
- Dark mode compatible

✅ **Ready to:**
- Connect to real API data
- Add more lines
- Customize styling
- Export reports

The chart is now fully integrated with shadcn's design system and your finOps dashboard!
