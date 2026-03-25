import { cn } from "@/lib/utils"
import type { StatCardProps } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3 } from "lucide-react"

export function StatCard({
  label,
  value,
  change,
  trend,
  description,
}: StatCardProps) {
  const changeColor = change.startsWith("-")
    ? "text-foreground"
    : change.startsWith("+")
      ? "text-foreground"
      : "text-muted-foreground"

  const trendStyles =
    trend === "up"
      ? "bg-primary/10 text-primary"
      : trend === "down"
        ? "bg-muted text-foreground"
        : "bg-muted text-muted-foreground"

  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight

  return (
    <Card
      className={cn(
        "group h-full overflow-hidden border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
      )}
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
              {label}
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </CardTitle>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/60 text-primary transition-colors group-hover:border-primary/20 group-hover:bg-primary/8">
            <BarChart3 className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/35 px-3 py-2">
          <div className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", changeColor)}>
            <TrendIcon className="size-4" />
            <span>{change}</span>
          </div>
          <div className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]", trendStyles)}>
            {trend}
          </div>
        </div>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground/90">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
