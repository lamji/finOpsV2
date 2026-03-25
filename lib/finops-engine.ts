// lib/finops-engine.ts
// Server-only — never import this in client components

import Anthropic from "@anthropic-ai/sdk"
import { env } from "@/lib/env"
import type {
  Alert,
  AggregatedDashboard,
  BillingRow,
  ChartDataPoint,
  CostDriver,
  FinancialMetric,
  FinancialSummary,
} from "@/lib/types"

export type {
  Alert,
  AggregatedDashboard,
  BillingRow,
  ChartDataPoint,
  CostDriver,
  FinancialMetric,
  FinancialSummary,
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVICE_CATEGORY_MAP: Record<string, string> = {
  "Compute Engine": "Compute",
  "Google Kubernetes Engine": "Compute",
  "Cloud Run": "Compute",
  "App Engine": "Compute",
  "Cloud Functions": "Compute",
  "Cloud Storage": "Storage",
  "Cloud SQL": "Storage",
  "Cloud Bigtable": "Storage",
  "Cloud Spanner": "Storage",
  "Filestore": "Storage",
  "Networking": "Network & Data Transfer",
  "Cloud CDN": "Network & Data Transfer",
  "Cloud DNS": "Network & Data Transfer",
  "Cloud Interconnect": "Network & Data Transfer",
  "Cloud VPN": "Network & Data Transfer",
  "Cloud Key Management Service (KMS)": "Third-party Services",
  "Cloud Pub/Sub": "Third-party Services",
  "BigQuery": "Third-party Services",
  "Cloud Monitoring": "Third-party Services",
  "Cloud Logging": "Third-party Services",
  "Cloud Identity": "Third-party Services",
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function categorise(serviceDescription: string): string {
  return SERVICE_CATEGORY_MAP[serviceDescription] ?? "Other"
}

function shortMonth(yyyymm: string): string {
  return MONTH_NAMES[yyyymm.slice(4, 6)] ?? yyyymm.slice(4, 6)
}

function longPeriod(yyyymm: string): string {
  const year = yyyymm.slice(0, 4)
  const month = MONTH_NAMES[yyyymm.slice(4, 6)] ?? yyyymm.slice(4, 6)
  return `${month} ${year}`
}

function calcDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function pctChange(
  current: number,
  previous: number,
): { pct: string; trend: "up" | "down" | "neutral" } {
  if (previous === 0) return { pct: "N/A", trend: "neutral" }
  const delta = ((current - previous) / previous) * 100
  const trend: "up" | "down" | "neutral" =
    Math.abs(delta) < 1 ? "neutral" : delta > 0 ? "up" : "down"
  return { pct: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`, trend }
}

// ── aggregate() — pure, sync ──────────────────────────────────────────────────
// Accepts BillingRow[] — full raw rows from BigQuery SELECT *
// NOTE: BigQuery REST API returns numeric fields as strings — always use toNum()

function toNum(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function effectiveCost(row: BillingRow): number {
  const base = toNum(row.cost)
  const credits = (row.credits ?? []).reduce((sum, c) => sum + toNum(c.amount), 0)
  return base + credits
}

function buildDrilldown(
  currentMap: Map<string, number>,
  prevMap: Map<string, number>,
  totalSpend: number,
  topN?: number,
): CostDriver[] {
  let entries = Array.from(currentMap.entries()).sort((a, b) => b[1] - a[1])
  if (topN) entries = entries.slice(0, topN)
  return entries.map(([name, amount]) => {
    const prev = prevMap.get(name) ?? 0
    const { pct, trend } = pctChange(amount, prev)
    return {
      name,
      amount: Math.round(amount),
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
      trend,
      change: pct,
    }
  })
}

export function aggregate(rows: BillingRow[]): AggregatedDashboard {
  const fmt = (n: number) => {
    // Guard: collapse tiny negative values (-0.001 etc.) to 0 to avoid "-$0"
    // Do NOT apply to positive sub-$1 values — those need decimals
    const safe = n < 0 && Math.round(n) === 0 ? 0 : n
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Math.abs(safe) < 1 ? 2 : 0,
    }).format(safe)
  }

  // ── Derive period from actual data ─────────────────────────────────────────
  const allMonths = [...new Set(rows.map((r) => r.invoice?.month).filter(Boolean))].sort() as string[]

  if (allMonths.length === 0) {
    return {
      statistics: [],
      charts: [],
      drilldown: [],
      byService: [],
      byProject: [],
      bySku: [],
      summary: { period: "—", daysElapsed: 0, daysInMonth: 0, daysRemaining: 0 },
    }
  }

  const currentYYYYMM = allMonths[allMonths.length - 1]
  const prevYYYYMM = allMonths.length >= 2 ? allMonths[allMonths.length - 2] : null

  const year = parseInt(currentYYYYMM.slice(0, 4), 10)
  const month = parseInt(currentYYYYMM.slice(4, 6), 10)
  const totalDays = calcDaysInMonth(year, month)

  const now = new Date()
  const todayYYYYMM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
  const elapsed = currentYYYYMM === todayYYYYMM ? now.getDate() : totalDays
  const remaining = totalDays - elapsed

  // ── Split rows by period ───────────────────────────────────────────────────
  const currentRows = rows.filter((r) => r.invoice?.month === currentYYYYMM)
  const prevRows = prevYYYYMM ? rows.filter((r) => r.invoice?.month === prevYYYYMM) : []

  // ── Totals ─────────────────────────────────────────────────────────────────
  const mtdSpend = currentRows.reduce((sum, r) => sum + effectiveCost(r), 0)
  const prevSpend = prevRows.reduce((sum, r) => sum + effectiveCost(r), 0)
  const dailyBurnRate = elapsed > 0 ? mtdSpend / elapsed : 0
  const projectedMonthly = dailyBurnRate * totalDays
  const { pct: momPct, trend: momTrend } = pctChange(mtdSpend, prevSpend)

  // ── statistics ─────────────────────────────────────────────────────────────
  const statistics: FinancialMetric[] = [
    {
      label: "MTD Spend",
      value: fmt(mtdSpend),
      change: prevSpend > 0 ? `${momPct} vs. last month` : "No prior month data",
      trend: momTrend,
      description: `${longPeriod(currentYYYYMM)} — ${elapsed} of ${totalDays} days`,
    },
    {
      label: "Daily Burn Rate",
      value: `${fmt(dailyBurnRate)}/day`,
      change: `${fmt(dailyBurnRate * 30)} projected 30-day`,
      trend: "neutral",
      description: `Avg over ${elapsed} days`,
    },
    {
      label: "Projected Monthly",
      value: fmt(projectedMonthly),
      change: prevSpend > 0
        ? `${momPct} vs. ${prevYYYYMM ? longPeriod(prevYYYYMM) : "last month"}`
        : "No comparison",
      trend: momTrend,
      description: `Based on ${elapsed}-day avg burn rate`,
    },
    {
      label: prevYYYYMM ? `${longPeriod(prevYYYYMM)} Spend` : "Previous Month",
      value: prevSpend > 0 ? fmt(prevSpend) : "—",
      change: prevSpend > 0 ? longPeriod(prevYYYYMM!) : "No data",
      trend: "neutral",
      description: prevSpend > 0 ? "Prior period actual spend" : "No prior month data available",
    },
  ]

  // ── summary ────────────────────────────────────────────────────────────────
  const summary: FinancialSummary = {
    period: longPeriod(currentYYYYMM),
    daysElapsed: elapsed,
    daysInMonth: totalDays,
    daysRemaining: remaining,
  }

  // ── Dimension maps (current + prev) ───────────────────────────────────────
  const categoryMap = new Map<string, number>()
  const prevCategoryMap = new Map<string, number>()
  const serviceMap = new Map<string, number>()
  const prevServiceMap = new Map<string, number>()
  const projectMap = new Map<string, number>()
  const prevProjectMap = new Map<string, number>()
  const skuMap = new Map<string, number>()
  const prevSkuMap = new Map<string, number>()

  for (const row of currentRows) {
    const cost = effectiveCost(row)
    const cat = categorise(row.service?.description ?? "Other")
    const svc = row.service?.description ?? "Unknown"
    const proj = row.project?.name ?? row.project?.id ?? "Unknown"
    const sku = row.sku?.description ?? "Unknown"
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + cost)
    serviceMap.set(svc, (serviceMap.get(svc) ?? 0) + cost)
    projectMap.set(proj, (projectMap.get(proj) ?? 0) + cost)
    skuMap.set(sku, (skuMap.get(sku) ?? 0) + cost)
  }

  for (const row of prevRows) {
    const cost = effectiveCost(row)
    const cat = categorise(row.service?.description ?? "Other")
    const svc = row.service?.description ?? "Unknown"
    const proj = row.project?.name ?? row.project?.id ?? "Unknown"
    const sku = row.sku?.description ?? "Unknown"
    prevCategoryMap.set(cat, (prevCategoryMap.get(cat) ?? 0) + cost)
    prevServiceMap.set(svc, (prevServiceMap.get(svc) ?? 0) + cost)
    prevProjectMap.set(proj, (prevProjectMap.get(proj) ?? 0) + cost)
    prevSkuMap.set(sku, (prevSkuMap.get(sku) ?? 0) + cost)
  }

  const drilldown = buildDrilldown(categoryMap, prevCategoryMap, mtdSpend)
  const byService = buildDrilldown(serviceMap, prevServiceMap, mtdSpend)
  const byProject = buildDrilldown(projectMap, prevProjectMap, mtdSpend)
  const bySku = buildDrilldown(skuMap, prevSkuMap, mtdSpend, 20)

  // ── charts (all available months) ─────────────────────────────────────────
  const monthlyMap = new Map<string, number>()
  for (const row of rows) {
    const m = row.invoice?.month
    if (m) monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + effectiveCost(row))
  }

  const charts: ChartDataPoint[] = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([yyyymm, expenses]) => ({
      month: shortMonth(yyyymm),
      expenses: Math.round(expenses),
    }))

  return { statistics, charts, drilldown, byService, byProject, bySku, summary }
}

// ── generateInsights() — async, calls Anthropic ───────────────────────────────

export async function generateInsights(
  aggregated: AggregatedDashboard,
): Promise<Alert[]> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const { statistics, drilldown, byService, byProject, bySku, summary } = aggregated

  const mtd = statistics.find((s) => s.label === "MTD Spend")
  const burnRate = statistics.find((s) => s.label === "Daily Burn Rate")
  const projected = statistics.find((s) => s.label === "Projected Monthly")
  const prevMonth = statistics.find((s) => s.label.includes("Spend") && s.label !== "MTD Spend")

  const fmt = (arr: typeof drilldown) =>
    arr.map((d) => `  ${d.name}: $${d.amount} (${d.percentage}%, ${d.change} MoM)`).join("\n")

  const prompt = `You are a FinOps analyst reviewing cloud spend data. Analyze this data and return actionable insights.

SPEND DATA (${summary.period}):
- MTD Spend: ${mtd?.value ?? "N/A"} (${mtd?.change ?? ""})
- Daily Burn Rate: ${burnRate?.value ?? "N/A"}
- Projected Monthly: ${projected?.value ?? "N/A"}
- Previous Month: ${prevMonth?.value ?? "N/A"}
- Days Elapsed: ${summary.daysElapsed} of ${summary.daysInMonth}

BY CATEGORY:
${fmt(drilldown)}

BY SERVICE:
${fmt(byService)}

BY PROJECT:
${fmt(byProject)}

TOP SKUs:
${fmt(bySku.slice(0, 10))}

Return a JSON array of 3 to 5 insights. Each insight must follow this exact shape:
[
  {
    "id": "unique-kebab-case-id",
    "type": "warning" | "info" | "success",
    "title": "Short title (max 5 words)",
    "message": "One sentence actionable insight."
  }
]

Rules:
- "warning" for budget risks or cost spikes
- "info" for anomalies or trends worth watching
- "success" for cost reductions or positive patterns
- Be specific with numbers from the data
- Return ONLY the JSON array, no markdown, no explanation`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const raw =
      response.content[0].type === "text" ? response.content[0].text : ""

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

    const parsed = JSON.parse(text) as Alert[]

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    // Non-fatal — return empty if AI call fails
    console.error("generateInsights failed:", error)
    return []
  }
}
