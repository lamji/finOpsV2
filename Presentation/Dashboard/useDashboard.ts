"use client"

import { useApiDashboard } from "./useApiDashboard"

export function useDashboard() {
  const { data, isLoading, isError, error } = useApiDashboard()

  return {
    financialOverview: data?.statistics ?? [],
    summary: data?.summary,
    byService: data?.byService ?? [],
    byProject: data?.byProject ?? [],
    bySku: data?.bySku ?? [],
    charts: data?.charts ?? [],
    alerts: data?.aiInsights ?? [],
    isLoading,
    isError,
    error,
  }
}
