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
    <main className={cn("flex-1 space-y-6 overflow-auto p-6", className)}>
      {children}
    </main>
  )
}
