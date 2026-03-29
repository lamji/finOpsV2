"use client"

import { useDashboard } from "@/Presentation/Dashboard/useDashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardInsights() {
  const { alerts, isLoading } = useDashboard()

  return (
    <Card className="border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base">Insights</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-3 pt-5 lg:grid-cols-3">
        {isLoading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-4"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </>
        )}

        {!isLoading && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">No insights yet.</p>
        )}

        {!isLoading &&
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-4"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {alert.type}
              </p>
              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {alert.message}
              </p>
            </div>
          ))}
      </CardContent>
    </Card>
  )
}
