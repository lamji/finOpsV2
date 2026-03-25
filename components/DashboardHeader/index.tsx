import { cn } from "@/lib/utils"

export function DashboardHeader() {
  return (
    <header
      className={cn(
        "border-b border-border bg-background px-6 py-4",
        "sticky top-0 z-50 flex items-center justify-between"
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome to finOps control center
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Placeholder for user menu/notifications */}
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    </header>
  )
}
