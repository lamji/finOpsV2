# Statistics — Stat Cards Reference

Complete reference for the 4 financial stat cards rendered by `StatsSection`.

---

## Overview

| Concern | Detail |
|---------|--------|
| **Source** | `aggregate()` in `lib/finops-engine.ts` → `AggregatedDashboard.statistics` |
| **Consumer** | `Presentation/Dashboard/useDashboard.ts` → `StatsSection/index.tsx` → `StatsSection/StatCard.tsx` |
| **Count** | 4 cards (dynamically built from real data — no hardcoded values) |
| **Period** | Derived from actual BigQuery rows (`invoice.month`) — not from `new Date()` |
| **Budget constant** | `MONTHLY_BUDGET = 50_000` (single source of truth in `finops-engine.ts`) |

---

## How the Period Is Derived

```ts
const allMonths = [...new Set(rows.map(r => r.invoice?.month).filter(Boolean))].sort()

const currentYYYYMM = allMonths[allMonths.length - 1]   // most recent month in data
const prevYYYYMM    = allMonths.length >= 2
  ? allMonths[allMonths.length - 2]
  : null                                                  // second most recent, or null
```

- `elapsed` = `now.getDate()` if `currentYYYYMM === todayYYYYMM`, else `totalDays` (full month)
- This means: if the most recent data month is the current calendar month → partial burn; if it's a past month → treated as complete

---

## Card 1 — MTD Spend

```ts
{
  label:       "MTD Spend",
  value:       fmt(mtdSpend),                           // e.g. "$13"
  change:      prevSpend > 0
                 ? `${momPct} vs. last month`           // e.g. "+40% vs. last month"
                 : "No prior month data",
  trend:       momTrend,                                // "up" | "down" | "neutral"
  description: `${longPeriod(currentYYYYMM)} — ${elapsed} of ${totalDays} days`
}
```

- `mtdSpend` = `Σ effectiveCost(row)` for all rows where `invoice.month === currentYYYYMM`
- `momPct` / `momTrend` = month-over-month % change vs `prevSpend` via `pctChange()`
- `trend: "up"` = spend increased vs prior month (bad for costs, but rendered green by convention — see StatCard note below)

---

## Card 2 — Daily Burn Rate

```ts
{
  label:       "Daily Burn Rate",
  value:       `${fmt(dailyBurnRate)}/day`,             // e.g. "$0/day"
  change:      `${fmt(dailyBurnRate * 30)} projected 30-day`,
  trend:       "neutral",                               // always neutral
  description: `Avg over ${elapsed} days`
}
```

- `dailyBurnRate` = `mtdSpend / elapsed` (protected: returns 0 if `elapsed === 0`)
- Projected 30-day is a simple linear extrapolation — not tied to `MONTHLY_BUDGET`

---

## Card 3 — Projected Monthly

```ts
{
  label:       "Projected Monthly",
  value:       fmt(projectedMonthly),                   // dailyBurnRate × totalDays
  change:      prevSpend > 0
                 ? `${momPct} vs. ${longPeriod(prevYYYYMM)}`
                 : "No comparison",
  trend:       momTrend,
  description: `Based on ${elapsed}-day avg burn rate`
}
```

- `projectedMonthly` = `dailyBurnRate × totalDays`
- Uses the same `momTrend` as Card 1 — both reflect month-over-month direction

---

## Card 4 — Previous Month Spend

```ts
{
  label:       prevYYYYMM
                 ? `${longPeriod(prevYYYYMM)} Spend`    // e.g. "Feb 2026 Spend"
                 : "Previous Month",
  value:       prevSpend > 0 ? fmt(prevSpend) : "—",
  change:      prevSpend > 0 ? longPeriod(prevYYYYMM!) : "No data",
  trend:       "neutral",                               // always neutral
  description: prevSpend > 0
                 ? "Prior period actual spend"
                 : "No prior month data available"
}
```

- Shows the **complete actual spend** for the second-most-recent month in BigQuery
- Value is `"—"` when only one month of data exists (no `prevYYYYMM`)
- This card confirmed $13 for Feb 2026 — accurate for this sandbox project (no `maxResults` cap → all rows fetched)

---

## StatCard Rendering

**File:** `components/StatsSection/StatCard.tsx`

```ts
// Color is derived from the change STRING prefix — not from the trend prop
change.startsWith("+") → text-green-600 dark:text-green-400
change.startsWith("-") → text-red-600 dark:text-red-400
otherwise              → text-muted-foreground
```

⚠️ **Known quirk:** `trend` prop is accepted but not used for color. Color comes from the `+`/`-` prefix of the `change` string. Cards 2 and 4 always use `trend: "neutral"` but can still show green/red if their `change` string starts with +/−.

---

## Helper Functions

| Function | Signature | Output example |
|----------|-----------|----------------|
| `fmt(n)` | `(n: number) → string` | `"$13"`, `"$1,584"` |
| `longPeriod(yyyymm)` | `("202602") → string` | `"Feb 2026"` |
| `shortMonth(yyyymm)` | `("202602") → string` | `"Feb"` |
| `pctChange(cur, prev)` | `→ { pct, trend }` | `{ pct: "+40%", trend: "up" }` |
| `effectiveCost(row)` | `→ number` | cost + credits (credits are negative) |

`fmt()` uses `maximumFractionDigits: 2` for values under $1, otherwise 0 decimal places.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| No rows at all | Returns empty `statistics: []` — `StatsSection` shows empty state |
| Only one month in data | Card 4 shows `"—"` / `"No prior month data available"` |
| `elapsed === 0` | `dailyBurnRate = 0`, projected = $0 |
| Current month = past month | `elapsed = totalDays` (full month treated as complete) |
| `prevSpend === 0` | MoM % shows `"No prior month data"` instead of a percentage |
| BigQuery lag (1–2 days) | MTD and projected slightly understated — GCP export delay, not a code bug |

---

## Data Accuracy Note

The route query (`WHERE invoice.month LIKE '2026%'`, no `maxResults`) fetches **all rows for the current year**. No pagination is implemented — if row count exceeds one BigQuery response page, only partial data is returned. For the current sandbox project (`DF-SANDBOX`) this is not an issue, but would need pagination support at scale.
