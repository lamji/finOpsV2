# MTD Spend — How It's Computed

**Sources:** `app/api/bigquery/route.ts`, `lib/finops-engine.ts`

---

## Overview

BigQuery runs a `GROUP BY` query → engine sums `effective_cost` for the current month → that's MTD.

Credits are **not** subtracted (`inCludeCredits = false`).

---

## The SQL (what BigQuery receives)

**Code — `route.ts:137`**
```ts
const query =
  request.nextUrl.searchParams.get("query") ??
  `SELECT
     invoice.month       AS invoice_month,
     service.description AS service_description,
     project.name        AS project_name,
     project.id          AS project_id,
     sku.description     AS sku_description,
     SUM(cost)           AS effective_cost
   FROM \`${env.GCP_PROJECT_ID}.${env.BQ_DATASET}.${env.BQ_TABLE}\`
   WHERE invoice.month LIKE '${new Date().getFullYear()}%'
   GROUP BY 1, 2, 3, 4, 5`
```

`GROUP BY` collapses ~1,659 raw March rows → one row per unique service + project + sku + month.

---

## What the engine receives (`ServiceCostRow[]`)

**Code — `route.ts:309, 312–314`**
```ts
const rows = normalizeRows(schemaFields, payload.rows ?? [])
// rows is cast to ServiceCostRow[] and passed to aggregate()
const aggregated: AggregatedDashboard = aggregate(rows as unknown as ServiceCostRow[])
```

Each row after normalization:
```json
{
  "invoice_month":       "202603",
  "service_description": "Kubernetes Engine",
  "project_name":        "DF-SANDBOX",
  "sku_description":     "Autopilot Pod mCPU Requests (me-central1)",
  "effective_cost":      "0.088353"
}
```

---

## MTD Computation (Step by Step)

### 1. Find current month

**Code — `finops-engine.ts:106, 119–120`**
```ts
const allMonths = [...new Set(rows.map((r) => r.invoice_month).filter(Boolean))].sort()
const currentYYYYMM = allMonths[allMonths.length - 1]         // "202603"
const prevYYYYMM    = allMonths.length >= 2
  ? allMonths[allMonths.length - 2]                           // "202602"
  : null
```

**Sample result:**
```
allMonths     = ["202602", "202603"]
currentYYYYMM = "202603"
prevYYYYMM    = "202602"
```

---

### 2. Compute elapsed days

**Code — `finops-engine.ts:122–129`**
```ts
const year      = parseInt(currentYYYYMM.slice(0, 4), 10)     // 2026
const month     = parseInt(currentYYYYMM.slice(4, 6), 10)     // 3
const totalDays = calcDaysInMonth(year, month)                 // 31

const now         = new Date()
const todayYYYYMM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
const elapsed     = currentYYYYMM === todayYYYYMM
  ? now.getDate()   // partial month → today's date
  : totalDays       // past month → full count
const remaining   = totalDays - elapsed
```

**`calcDaysInMonth` — `finops-engine.ts:48–50`**
```ts
function calcDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}
```

**Sample result:**
```
totalDays = 31   (March has 31 days)
elapsed   = 21   (today is March 21 and currentYYYYMM matches today)
remaining = 10
```

---

### 3. Filter rows to current month

**Code — `finops-engine.ts:132–133`**
```ts
const currentRows = rows.filter((r) => r.invoice_month === currentYYYYMM)
const prevRows    = prevYYYYMM
  ? rows.filter((r) => r.invoice_month === prevYYYYMM)
  : []
```

**Sample result:**
```
currentRows = all rows where invoice_month === "202603"
prevRows    = all rows where invoice_month === "202602"
```

---

### 4. Sum effective_cost → mtdSpend

**Code — `finops-engine.ts:67–70, 136`**
```ts
function toNum(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

const mtdSpend = currentRows.reduce((sum, r) => sum + toNum(r.effective_cost), 0)
```

**What `toNum` does and why every part exists:**

`v: unknown` — the parameter type is `unknown` because BigQuery rows arrive as `Record<string, unknown>` after `normalizeRows()`. TypeScript has no guarantee `effective_cost` is a string or number at compile time, so `unknown` forces safe handling.

`Number(v)` — JavaScript's built-in coercion. Converts any value to a number:

| Input `v` | `Number(v)` |
|---|---|
| `"0.088353"` | `0.088353` |
| `"5.28E-4"` | `0.000528` — scientific notation handled |
| `"9.0E-6"` | `0.000009` — scientific notation handled |
| `"0.0"` | `0` |
| `null` | `0` |
| `undefined` | `NaN` |
| `"abc"` | `NaN` |

`isFinite(n) ? n : 0` — guards against `NaN`, `Infinity`, and `-Infinity`. If `Number(v)` could not parse the value, `isFinite` returns `false` and the function returns `0` instead.

**Why this guard matters:** `effective_cost` is a string coming from BigQuery. If a row has a missing or malformed value, `Number(v)` produces `NaN`. Without `isFinite`, that `NaN` would infect the entire `.reduce()` — once `NaN` enters a sum, every addition after it also becomes `NaN`, and `mtdSpend` ends up as `NaN` instead of a dollar amount. The guard collapses bad values to `0` so one bad row cannot corrupt the total.

**Actual March 2026 rows fed into the reduce:**

| Service | SKU | effective_cost (string) | toNum() result |
|---|---|---|---|
| Kubernetes Engine | Autopilot Pod mCPU Requests (me-central1) | `"0.088353"` | 0.088353 |
| Kubernetes Engine | Autopilot SSD Ephemeral Storage (europe-central2) | `"0.000126"` | 0.000126 |
| Kubernetes Engine | Autopilot SSD Ephemeral Storage (me-central1) | `"9.0E-6"` | 0.000009 |
| Compute Engine | E2 Instance Core running in Doha | `"0.001034"` | 0.001034 |
| Compute Engine | Storage PD Capacity in me-central1 | `"0.000412"` | 0.000412 |
| Cloud SQL | PostgreSQL Regional - Low cost storage Americas | `"0.002422"` | 0.002422 |
| Cloud SQL | MySQL Zonal - Low cost storage Americas | `"0.001339"` | 0.001339 |
| Cloud Storage | Standard Storage Warsaw | `"0.0"` | 0.000000 |
| Cloud Storage | Standard Storage Warsaw (Class A ops) | `"0.000031"` | 0.000031 |
| Cloud KMS | Active software symmetric key versions | `"5.28E-4"` | 0.000528 |
| Cloud Run | CPU Allocation Time me-central1 | `"0.004210"` | 0.004210 |
| Cloud Run | Memory Allocation Time me-central1 | `"0.001105"` | 0.001105 |
| Cloud Monitoring | Monitoring Data me-central1 | `"0.000087"` | 0.000087 |
| *(remaining sub-cent rows)* | | | ... |
| | | **mtdSpend** | **11.88** |

**Running accumulation:**
```
sum = 0
    + 0.088353 → 0.088353
    + 0.000126 → 0.088479
    + 0.000009 → 0.088488   ← "9.0E-6" parsed by Number()
    + 0.001034 → 0.089522
    + 0.000412 → 0.089934
    + 0.002422 → 0.092356
    + 0.001339 → 0.093695
    + 0.000000 → 0.093695   ← "0.0" zero-cost row, no change
    + 0.000031 → 0.093726
    + 0.000528 → 0.094254   ← "5.28E-4" parsed by Number()
    + 0.004210 → 0.098464
    + 0.001105 → 0.099569
    + 0.000087 → 0.099656
    + ...rest  → 11.88      ← mtdSpend final
```

---

### 5. Compute burn rate, projection, MoM

**Code — `finops-engine.ts:137–140`**
```ts
const prevSpend        = prevRows.reduce((sum, r) => sum + toNum(r.effective_cost), 0)
const dailyBurnRate    = elapsed > 0 ? mtdSpend / elapsed : 0
const projectedMonthly = dailyBurnRate * totalDays
const { pct: momPct, trend: momTrend } = pctChange(mtdSpend, prevSpend)
```

**`pctChange` — `finops-engine.ts:52–61`**
```ts
function pctChange(current: number, previous: number) {
  if (previous === 0) return { pct: "N/A", trend: "neutral" }
  const delta = ((current - previous) / previous) * 100
  const trend = Math.abs(delta) < 1 ? "neutral" : delta > 0 ? "up" : "down"
  return { pct: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`, trend }
}
```

**Sample computation with real values:**
```
prevSpend        = 12.83             (Feb 2026 rows summed)
dailyBurnRate    = 11.88 / 21        = 0.5657/day
projectedMonthly = 0.5657 × 31      = 17.54

momPct:
  delta = (11.88 - 12.83) / 12.83 × 100
        = -0.95 / 12.83 × 100
        = -7.4  → toFixed(0) = "-7"
  trend = "down"   (delta < 0 and |delta| > 1)
  pct   = "-7%"
```

---

### 6. Build stat cards

**Code — `finops-engine.ts:143–174`**
```ts
const statistics: FinancialMetric[] = [
  {
    label:       "MTD Spend",
    value:       fmt(mtdSpend),                                          // "$12"
    change:      prevSpend > 0 ? `${momPct} vs. last month` : "...",    // "-7% vs. last month"
    trend:       momTrend,                                               // "down"
    description: `${longPeriod(currentYYYYMM)} — ${elapsed} of ${totalDays} days`,
  },
  {
    label:       "Daily Burn Rate",
    value:       `${fmt(dailyBurnRate)}/day`,                           // "$1/day"
    change:      `${fmt(dailyBurnRate * 30)} projected 30-day`,         // "$17 projected 30-day"
    trend:       "neutral",
    description: `Avg over ${elapsed} days`,
  },
  {
    label:       "Projected Monthly",
    value:       fmt(projectedMonthly),                                  // "$18"
    change:      `${momPct} vs. ${longPeriod(prevYYYYMM)}`,             // "-7% vs. Feb 2026"
    trend:       momTrend,
    description: `Based on ${elapsed}-day avg burn rate`,
  },
  {
    label:       `${longPeriod(prevYYYYMM)} Spend`,                     // "Feb 2026 Spend"
    value:       fmt(prevSpend),                                         // "$13"
    change:      longPeriod(prevYYYYMM),                                 // "Feb 2026"
    trend:       "neutral",
    description: "Prior period actual spend",
  },
]
```

**`fmt` — `finops-engine.ts:94–103`**
● Formats a number into a USD currency string.
  safe — if the number is a tiny negative like -0.001, treat it as 0 to avoid showing-$0.           maximumFractionDigits — if the amount is under $1, show 2 decimals
  ($0.57). If $1 or more, show no decimals ($12).

```ts
const fmt = (n: number) => {
  const safe = n < 0 && Math.round(n) === 0 ? 0 : n
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(safe) < 1 ? 2 : 0,
  }).format(safe)
}
```

```
fmt(11.88)  → Math.abs(11.88) >= 1  → maximumFractionDigits: 0  → "$12"
fmt(0.5657) → Math.abs(0.57)  <  1  → maximumFractionDigits: 2  → "$0.57"
fmt(17.54)  → Math.abs(17.54) >= 1  → maximumFractionDigits: 0  → "$18"
fmt(12.83)  → Math.abs(12.83) >= 1  → maximumFractionDigits: 0  → "$13"
```

---

## Final Stat Cards

| Card | value | change | trend |
|---|---|---|---|
| MTD Spend | `$12` | `-7% vs. last month` | `down` |
| Daily Burn Rate | `$0.57/day` | `$17 projected 30-day` | `neutral` |
| Projected Monthly | `$18` | `-7% vs. Feb 2026` | `down` |
| Feb 2026 Spend | `$13` | `Feb 2026` | `neutral` |
