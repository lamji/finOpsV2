import * as React from "react"
import { cn } from "@/lib/utils"

export function DashboardContent({
  children,
  className,
}: Readonly<{
  children: React.ReactNode
  className?: string
}>) {
  return (
    <main className={cn("flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {children}
      </div>
    </main>
  )
}
