import { cn } from "@/lib/utils"
import type { StatCardProps } from "@/lib/types"

export function StatCard({
  label,
  value,
  change,
  description,
}: StatCardProps) {
  const changeColor = change.startsWith("-")
    ? "text-red-600 dark:text-red-400"
    : change.startsWith("+")
      ? "text-green-600 dark:text-green-400"
      : "text-muted-foreground"

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6",
        "transition-colors hover:bg-accent"
      )}
    >
      <div className="space-y-3">
        {/* Label */}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>

        {/* Value */}
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>

        {/* Change indicator */}
        <p className={cn("text-xs font-medium", changeColor)}>
          {change}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}
