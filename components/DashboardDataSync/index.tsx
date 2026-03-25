"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { useDashboard } from "@/Presentation/Dashboard/useDashboard"

/**
 * Mounts inside Dashboard layout (server component).
 * Handles side effects only — fires a toast on API error.
 * Renders nothing.
 */
export function DashboardDataSync() {
  const { isError, error } = useDashboard()

  useEffect(() => {
    if (isError && error) {
      toast.error("Failed to load dashboard data", {
        description: error.message,
      })
    }
  }, [isError, error])

  return null
}
