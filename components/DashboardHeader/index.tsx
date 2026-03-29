import { cn } from "@/lib/utils"

export function DashboardHeader() {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8"
      )}
    >
      <div className="flex flex-col gap-2">
      
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Cloud Spend Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Allocation, cost drivers, and trend visibility in one view.
          </p>
        </div>
      </div>
    </header>
  )
}
