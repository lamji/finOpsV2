"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

const trendIcon = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
}

function CostDriverSkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-lg border border-border/50 p-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-4 w-12 rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="h-2 flex-1 rounded-full bg-muted" />
      </div>
    </div>
  )
}

export function MainContent() {
  const { costDrivers, isLoading, isError } = useDashboard()

  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-6", "space-y-6")}
    >
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Cost Drivers Breakdown
        </h3>
        <p className="text-sm text-muted-foreground">
          Granular view of where your budget is being spent
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CostDriverSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error / Empty */}
      {!isLoading && (isError || costDrivers.length === 0) && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No cost data available.
        </p>
      )}

      {/* Cost Drivers Table */}
      {!isLoading && !isError && costDrivers.length > 0 && (
        <>
          <div className="space-y-3">
            {costDrivers.map((driver) => (
              <div
                key={driver.name}
                className="space-y-2 rounded-lg border border-border/50 p-4 transition-colors hover:bg-accent/50"
              >
                {/* Row 1: Name and Trend */}
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{driver.name}</p>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-sm font-semibold",
                      driver.trend === "up"
                        ? "text-green-600 dark:text-green-400"
                        : driver.trend === "down"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {(() => {
                      const Icon = trendIcon[driver.trend]
                      return <Icon className="h-3.5 w-3.5" />
                    })()}
                    {driver.change}
                  </span>
                </div>

                {/* Row 2: Amount and Progress Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      ${(Math.max(0, driver.amount) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {driver.percentage}% of total
                    </p>
                  </div>

                  {/* Progress Bar — inline style approved: dynamic % width cannot be
                      expressed as a static Tailwind class (no arbitrary runtime values) */}
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all dark:from-blue-400 dark:to-blue-500"
                        style={{ width: `${driver.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Total MTD Spend</p>
              <p className="text-2xl font-bold text-foreground">
                ${(Math.max(0, costDrivers.reduce((sum, d) => sum + d.amount, 0)) / 1000).toFixed(1)}k
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
