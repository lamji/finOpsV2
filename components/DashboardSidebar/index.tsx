"use client"

import { cn } from "@/lib/utils"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

const alertBorderColor = {
  warning: "border-yellow-500",
  info: "border-blue-500",
  success: "border-green-500",
}

const alertBgColor = {
  warning: "bg-yellow-500/10",
  info: "bg-blue-500/10",
  success: "bg-green-500/10",
}

export function DashboardSidebar() {
  const { alerts, summary, isLoading } = useDashboard()

  return (
    <aside className="space-y-6">
      {/* Insights Card */}
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-6",
          "space-y-4"
        )}
      >
        <h3 className="text-sm font-semibold text-foreground">Insights</h3>

        <div className="space-y-3">
          {isLoading && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse space-y-2 rounded-lg border-l-2 border-muted bg-muted/30 p-3"
                >
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              ))}
            </>
          )}

          {!isLoading && alerts.length === 0 && (
            <p className="text-xs text-muted-foreground">No insights yet.</p>
          )}

          {!isLoading &&
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg p-3 space-y-2",
                  `border-l-2 ${alertBorderColor[alert.type]}`,
                  alertBgColor[alert.type]
                )}
              >
                <p className="text-xs font-semibold text-foreground">
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {alert.message}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* This Month Summary Card */}
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-6",
          "space-y-4"
        )}
      >
        <h3 className="text-sm font-semibold text-foreground">This Month</h3>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="text-sm font-medium text-foreground">
              {summary?.period ?? "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Days Elapsed</p>
            <p className="text-sm font-medium text-foreground">
              {summary ? `${summary.daysElapsed} of ${summary.daysInMonth} days` : "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Days Remaining</p>
            <p className="text-sm font-medium text-foreground">
              {summary ? `${summary.daysRemaining} days left` : "—"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
