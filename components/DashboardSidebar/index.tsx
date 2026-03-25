"use client"

import { useDashboard } from "@/Presentation/Dashboard/useDashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DashboardSidebar() {
  const { summary } = useDashboard()

  return (
    <aside>
      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">This Month</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="text-sm font-medium text-foreground">
              {summary?.period ?? "-"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Days Elapsed</p>
            <p className="text-sm font-medium text-foreground">
              {summary ? `${summary.daysElapsed} of ${summary.daysInMonth} days` : "-"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Days Remaining</p>
            <p className="text-sm font-medium text-foreground">
              {summary ? `${summary.daysRemaining} days left` : "-"}
            </p>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
