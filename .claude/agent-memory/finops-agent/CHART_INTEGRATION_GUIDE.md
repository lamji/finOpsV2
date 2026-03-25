# Line Chart - API Integration Guide

## Quick Start: Connecting Real Data

The chart is ready to be connected to your backend API. Here's how:

---

## Option 1: Simple Data Fetch (One-time Load)

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  // ... other imports
} from "recharts"
import { cn } from "@/lib/utils"

export function ChartSection() {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/expenses")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then(data => {
        setChartData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
        <div className="h-80 w-full bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
      {/* ... Header code ... */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            {/* ... Chart components ... */}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

## Option 2: With React Query (Recommended)

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { // ... imports

export function ChartSection() {
  const { data: chartData = [], isLoading, error } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch("/api/expenses")
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return <SkeletonChart />
  }

  if (error) {
    return <ErrorChart />
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
      {/* Chart rendering */}
    </div>
  )
}
```

---

## Option 3: With SWR (Next.js Preferred)

```tsx
"use client"

import useSWR from "swr"
import { // ... imports

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function ChartSection() {
  const { data: chartData = [], error, isLoading } = useSWR(
    "/api/expenses",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  )

  if (isLoading) return <SkeletonChart />
  if (error) return <ErrorChart />

  return (
    <div>
      {/* Chart rendering */}
    </div>
  )
}
```

---

## Expected API Response Format

Your backend should return data in this format:

```json
[
  {
    "month": "Jan",
    "expenses": 4500,
    "budget": 5000
  },
  {
    "month": "Feb",
    "expenses": 5200,
    "budget": 5000
  },
  ...
]
```

### Alternative Format (If using different field names)

```json
[
  {
    "date": "2024-01-01",
    "actual": 4500,
    "budgeted": 5000,
    "label": "January"
  },
  ...
]
```

**Then update the Line dataKey:**
```tsx
<Line dataKey="actual" name="Actual Expenses" />
<Line dataKey="budgeted" name="Budget" />
```

---

## Backend API Example (Node.js/Express)

```typescript
// api/expenses
import { Router, Request, Response } from "express"

const router = Router()

router.get("/expenses", async (req: Request, res: Response) => {
  try {
    // Query database for monthly expenses
    const expenses = await db.query(`
      SELECT
        DATE_TRUNC('month', date) as month,
        SUM(amount) as expenses,
        $5000 as budget
      FROM transactions
      WHERE date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month
    `)

    // Format for chart
    const formatted = expenses.map(row => ({
      month: row.month.toLocaleDateString('en-US', { month: 'short' }),
      expenses: Math.round(row.expenses),
      budget: row.budget
    }))

    res.json(formatted)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" })
  }
})

export default router
```

---

## Backend API Example (Python/FastAPI)

```python
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from sqlalchemy import func
from database import get_db

router = APIRouter()

@router.get("/expenses")
async def get_expenses(db=Depends(get_db)):
    try:
        # Query database
        expenses = db.query(
            func.date_trunc('month', Transaction.date).label('month'),
            func.sum(Transaction.amount).label('expenses')
        ).filter(
            Transaction.date >= datetime.now() - timedelta(days=365)
        ).group_by(
            func.date_trunc('month', Transaction.date)
        ).order_by('month').all()

        # Format for chart
        formatted = [
            {
                "month": row.month.strftime('%b'),
                "expenses": int(row.expenses),
                "budget": 5000
            }
            for row in expenses
        ]

        return formatted
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Frontend Hook (Reusable)

Create a custom hook to share the data fetch logic:

```tsx
// hooks/useExpensesChart.ts
import { useQuery } from "@tanstack/react-query"

export function useExpensesChart() {
  return useQuery({
    queryKey: ["expenses", "chart"],
    queryFn: async () => {
      const res = await fetch("/api/expenses")
      if (!res.ok) throw new Error("Failed to fetch expenses")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000, // Cache for 30 minutes
  })
}
```

**Then use it:**
```tsx
import { useExpensesChart } from "@/hooks/useExpensesChart"

export function ChartSection() {
  const { data: chartData = [], isLoading, error } = useExpensesChart()

  // ... render chart
}
```

---

## Adding Dynamic Time Period

Allow users to select different time ranges:

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

export function ChartSection() {
  const [period, setPeriod] = useState<"3m" | "6m" | "12m" | "all">("12m")

  const { data: chartData = [] } = useQuery({
    queryKey: ["expenses", period],
    queryFn: async () => {
      const res = await fetch(`/api/expenses?period=${period}`)
      return res.json()
    },
  })

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
      {/* Period selector */}
      <div className="flex gap-2">
        {["3m", "6m", "12m", "all"].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p as any)}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium",
              period === p ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {p === "3m" ? "3 Months" : p === "6m" ? "6 Months" : p === "12m" ? "12 Months" : "All Time"}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            {/* ... */}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

## Error Handling Pattern

```tsx
type QueryState = "loading" | "error" | "success"

interface ChartState {
  state: QueryState
  data: ExpenseData[]
  error?: string
}

function ChartSection() {
  const [chartState, setChartState] = useState<ChartState>({
    state: "loading",
    data: [],
  })

  useEffect(() => {
    setChartState({ state: "loading", data: [] })

    fetch("/api/expenses")
      .then(res => res.json())
      .then(data => {
        setChartState({ state: "success", data })
      })
      .catch(err => {
        setChartState({
          state: "error",
          data: [],
          error: err.message
        })
      })
  }, [])

  if (chartState.state === "loading") {
    return <ChartSkeleton />
  }

  if (chartState.state === "error") {
    return (
      <div className="p-6 text-center text-destructive">
        <p>Failed to load chart: {chartState.error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Chart with chartState.data */}
    </div>
  )
}
```

---

## Testing

### Mock Data for Development

```tsx
// Uncomment this to test with mock data instead of API
// const chartData = [
//   { month: "Jan", expenses: 4500, budget: 5000 },
//   { month: "Feb", expenses: 5200, budget: 5000 },
//   // ... etc
// ]

// Or use MSW (Mock Service Worker) for realistic mocking
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

const server = setupServer(
  http.get("/api/expenses", () => {
    return HttpResponse.json([
      { month: "Jan", expenses: 4500, budget: 5000 },
      // ... more data
    ])
  })
)
```

---

## Performance Optimization

### 1. Memoize the Chart Component

```tsx
import { memo } from "react"

export const ChartSection = memo(function ChartSection() {
  // ... component code
})
```

### 2. Lazy Load the Chart

```tsx
import { lazy, Suspense } from "react"

const ChartSection = lazy(() =>
  import("@/components/dashboard/chart-section").then(mod => ({
    default: mod.ChartSection
  }))
)

// In parent component:
<Suspense fallback={<ChartSkeleton />}>
  <ChartSection />
</Suspense>
```

### 3. Enable Data Caching

```tsx
const { data } = useQuery({
  queryKey: ["expenses"],
  queryFn: () => fetch("/api/expenses").then(r => r.json()),
  staleTime: 10 * 60 * 1000, // 10 minutes
  gcTime: 60 * 60 * 1000,    // Cache for 1 hour
})
```

---

## Summary

**To connect real data:**

1. ✅ Identify your backend API endpoint
2. ✅ Confirm response format matches expected structure
3. ✅ Choose a data fetching approach (fetch, React Query, SWR)
4. ✅ Update the `chartData` source
5. ✅ Add error and loading states
6. ✅ Test with real data
7. ✅ Optimize performance with caching

The chart component is already type-safe and ready to accept any data matching the expected format!
