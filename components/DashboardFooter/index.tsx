import { cn } from "@/lib/utils"

export function DashboardFooter() {
  return (
    <footer
      className={cn(
        "border-t border-border bg-background px-6 py-4",
        "mt-auto text-xs text-muted-foreground"
      )}
    >
      <div className="flex items-center justify-between">
        <p>© 2026 finOps. All rights reserved.</p>

        <div className="flex items-center gap-6">
          <a href="#" className="transition-colors hover:text-foreground">
            Documentation
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Support
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Settings
          </a>
        </div>
      </div>
    </footer>
  )
}
