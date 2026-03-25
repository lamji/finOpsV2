"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

const chartConfig = {
  expenses: {
    label: "Actual Expenses",
    color: "#3b82f6",
  },
} satisfies ChartConfig

export function ChartSection() {
  const { charts, isLoading } = useDashboard()

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", "space-y-4")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Expense Trend</h3>
          <p className="text-sm text-muted-foreground">
            {charts.length > 0 ? `Last ${charts.length} months` : "Loading…"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-80 w-full animate-pulse rounded-md bg-muted" />
      ) : charts.length === 0 ? (
        <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          No chart data available.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <LineChart data={charts}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}
