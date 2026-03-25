"use client"

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

const chartPalette = [
  "#1f2937",
  "#334155",
  "#475569",
  "#64748b",
  "#7b8798",
  "#94a3b8",
  "#b0bac8",
  "#cbd5e1",
]

const legendDotClasses = [
  "bg-slate-800",
  "bg-slate-700",
  "bg-slate-600",
  "bg-slate-500",
  "bg-slate-400",
  "bg-slate-300",
  "bg-slate-300",
  "bg-slate-200",
]

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatSpendAmount(amount: number) {
  const safeAmount = Math.max(0, amount)

  if (safeAmount >= 1000) {
    return `$${(safeAmount / 1000).toFixed(1)}k`
  }

  return currencyFormatter.format(safeAmount)
}

const breakdownChartConfig = {
  amount: {
    label: "Spend",
    color: "#43526b",
  },
} satisfies ChartConfig

const trendChartConfig = {
  expenses: {
    label: "Actual Expenses",
    color: "#43526b",
  },
} satisfies ChartConfig

type BreakdownSectionProps = {
  title: string
  description: string
  items: ReturnType<typeof useDashboard>["byService"]
}

function CostDriverSkeleton() {
  return (
    <Card className="border-border/50 bg-background/70 shadow-sm">
      <CardContent className="p-5">
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}

function BreakdownSection({
  title,
  description,
  items,
}: BreakdownSectionProps) {
  const topItems = items.slice(0, 8)
  const chartData = topItems.map((item, index) => ({
    name: item.name.length > 24 ? `${item.name.slice(0, 24)}...` : item.name,
    fullName: item.name,
    amount: item.amount,
    percentage: item.percentage,
    fill: chartPalette[index % chartPalette.length],
    legendDotClass: legendDotClasses[index % legendDotClasses.length],
  }))
  const barChartData = chartData.slice().reverse()
  const total = items.reduce((sum, item) => sum + item.amount, 0)

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-background/40">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="pt-2 text-sm text-muted-foreground">
            No breakdown data available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Total
            </p>
            <p className="text-lg font-semibold text-foreground">
              {formatSpendAmount(total)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <ChartContainer config={breakdownChartConfig} className="h-[320px] w-full">
          <BarChart
            accessibilityLayer
            data={barChartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 12, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatSpendAmount(Number(value))}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <div className="flex min-w-[180px] items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {String(item?.payload?.fullName ?? "Unknown")}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatSpendAmount(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="amount" radius={10}>
              {barChartData.map((item) => (
                <Cell key={item.fullName} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function TimePeriodSection({
  charts,
  period,
}: {
  charts: ReturnType<typeof useDashboard>["charts"]
  period?: string
}) {
  if (charts.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-background/40">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Time Period Trend</CardTitle>
          <CardDescription>Monthly spend trend for the current reporting window.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="pt-2 text-sm text-muted-foreground">No chart data available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Time Period Trend</CardTitle>
            <CardDescription>
              {period ?? "Current period"} in a full-year monthly view.
            </CardDescription>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              View
            </p>
            <p className="text-sm font-medium text-foreground">Monthly spend</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <ChartContainer config={trendChartConfig} className="h-[320px] w-full">
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
    </Card>
  )
}

export function MainContent() {
  const { byService, byProject, bySku, charts, summary, isLoading, isError } = useDashboard()

  return (
    <Card className="space-y-0 border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-lg">Cost Drivers Breakdown</CardTitle>
        <CardDescription>
          Spend distribution across the highest-impact services and SKUs
        </CardDescription>
      </CardHeader>

      {isLoading && (
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CostDriverSkeleton key={i} />
          ))}
        </CardContent>
      )}

      {!isLoading && isError && (
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No cost data available.
          </p>
        </CardContent>
      )}

      {!isLoading && !isError && (
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <BreakdownSection
            title="By Service"
            description="Top cloud services contributing to current spend."
            items={byService}
          />
          <BreakdownSection
            title="By Project"
            description="Projects ranked by spend for the current reporting window."
            items={byProject}
          />
          <BreakdownSection
            title="By SKU"
            description="Most expensive billable SKUs in the current period."
            items={bySku}
          />
          <TimePeriodSection charts={charts} period={summary?.period} />
        </CardContent>
      )}
    </Card>
  )
}
