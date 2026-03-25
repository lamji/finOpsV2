"use client"

import { StatCard } from "./StatCard"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-6 space-y-3">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-32 rounded bg-muted" />
      <div className="h-3 w-40 rounded bg-muted" />
    </div>
  )
}

export function StatsSection() {
  const { financialOverview, isLoading, isError } = useDashboard()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError || financialOverview.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No financial data available.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {financialOverview.map((metric) => (
        <StatCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          trend={metric.trend}
          description={metric.description}
        />
      ))}
    </div>
  )
}
