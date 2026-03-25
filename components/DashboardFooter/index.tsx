import { cn } from "@/lib/utils"

export function DashboardFooter() {
  return (
    <footer
      className={cn(
        "mt-auto border-t border-border/70 bg-background/70 px-4 py-4 text-xs text-muted-foreground backdrop-blur sm:px-6 lg:px-8"
      )}
    >
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between">
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
