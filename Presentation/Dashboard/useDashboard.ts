"use client"

import { useApiDashboard } from "./useApiDashboard"

export function useDashboard() {
  const { data, isLoading, isError, error } = useApiDashboard()

  return {
    financialOverview: data?.statistics ?? [],
    summary: data?.summary,
    costDrivers: data?.drilldown ?? [],
    charts: data?.charts ?? [],
    alerts: data?.aiInsights ?? [],
    isLoading,
    isError,
    error,
  }
}
