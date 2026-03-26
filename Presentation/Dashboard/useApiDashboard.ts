"use client"

import { useQuery } from "@tanstack/react-query"

import type { BigQueryDashboardResponse } from "@/lib/types"

// ── Fetch function ─────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<BigQueryDashboardResponse> {
  const res = await fetch("/api/bigquery")
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<BigQueryDashboardResponse>
}

// ── API hook ───────────────────────────────────────────────────────────────

export function useApiDashboard() {
  return useQuery<BigQueryDashboardResponse, Error>({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000, // 5 min — matches Redis TTL
    refetchInterval: 5 * 60 * 1000, // poll every 5 min (aligns with Redis TTL)
    refetchIntervalInBackground: false, // pause when tab is not active
    retry: 1,
  })
}
