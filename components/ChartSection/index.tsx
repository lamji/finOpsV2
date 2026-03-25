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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

const chartConfig = {
  expenses: {
    label: "Actual Expenses",
    color: "#43526b",
  },
} satisfies ChartConfig

export function ChartSection() {
  const { charts, summary, isLoading } = useDashboard()

  return (
    <Card className="border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Time Period Trend</CardTitle>
            <CardDescription>
              {charts.length > 0
                ? `${summary?.period ?? "Current period"} in a full-year monthly view`
                : "Loading..."}
            </CardDescription>
          </div>
          <div className="hidden rounded-2xl border border-border/70 bg-muted/35 px-3 py-2 text-right sm:block">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              View
            </p>
            <p className="text-sm font-medium text-foreground">Monthly spend</p>
          </div>
        </div>
      </CardHeader>

      {isLoading ? (
        <CardContent>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </CardContent>
      ) : charts.length === 0 ? (
        <CardContent>
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No chart data available.
          </div>
        </CardContent>
      ) : (
        <CardContent className="pt-5">
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <LineChart data={charts}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
                stroke="#43526b"
                strokeWidth={2.5}
                dot={{ fill: "#43526b", r: 3 }}
                activeDot={{ r: 5, fill: "#43526b" }}
                isAnimationActive
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      )}
    </Card>
  )
}
