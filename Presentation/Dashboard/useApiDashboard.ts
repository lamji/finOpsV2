"use client"

import { useQuery } from "@tanstack/react-query"

import type { BigQueryDashboardResponse } from "@/lib/types"

// ── Fetch function ─────────────────────────────────────────────────────────

// FastAPI service URL — set NEXT_PUBLIC_API_URL to point to the API service.
// Falls back to the Next.js route if not set (backward compatible).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

async function fetchDashboard(): Promise<BigQueryDashboardResponse> {
  const url = API_BASE ? `${API_BASE}/dashboard` : "/api/bigquery"
  const res = await fetch(url)
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
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
