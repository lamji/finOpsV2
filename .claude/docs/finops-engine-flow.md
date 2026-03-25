# FinOps Engine — Function-by-Function Trace

## Golden rule: MANDATORY
- Do not change the format
- Only adds steps
- Only re-arrange the steps if needed

**File:** `lib/finops-engine.ts`
**Server-only** — never import in client components.

Two exported functions:
| Function | Type | Purpose |
|----------|------|---------|
| `aggregate(rows)` | pure, sync | Transform raw `BillingRow[]` → full dashboard payload |
| `generateInsights(aggregated)` | async | Call Anthropic → `Alert[]` AI insights |

---

## aggregate(rows) — Full Flow

```
aggregate(rows: BillingRow[])                           [lib/finops-engine.ts:125]
    │
    ├─ [Step 1] Derive available periods from real data (Lines 137–153)
    │   allMonths = unique rows.map(r => r.invoice?.month).filter(Boolean).sort()
    │   ├─ if allMonths.length === 0
    │   │    → return empty dashboard shape
    │   └─ else
    │        currentYYYYMM = latest month in data
    │        prevYYYYMM    = previous available month or null
    │
    ├─ [Step 1.5] Period day math (Lines 155–162)
    │   year = parseInt(currentYYYYMM.slice(0, 4), 10)
    │   month = parseInt(currentYYYYMM.slice(4, 6), 10)
    │   totalDays = calcDaysInMonth(year, month)
    │   now = new Date()
    │   todayYYYYMM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    │   elapsed = currentYYYYMM === todayYYYYMM ? now.getDate() : totalDays
    │   remaining = totalDays - elapsed
    │
    │   calcDaysInMonth(year, month)         [Line 74]
    │   └─ new Date(year, month, 0).getDate()
    │        └─ [END — native Date API]
    │
    ├─ [Step 2] Split rows by month (Lines 164–166)
    │   currentRows = rows.filter(r => r.invoice.month === currentYYYYMM)
    │   prevRows    = prevYYYYMM ? rows.filter(r => r.invoice.month === prevYYYYMM) : []
    │   └─ two separate arrays for current vs previous period
    │
    ├─ [Step 3] Compute financial totals (Lines 168–173)
    │   mtdSpend          = Σ effectiveCost(r) for currentRows
    │   prevSpend         = Σ effectiveCost(r) for prevRows
    │   dailyBurnRate     = mtdSpend / elapsed
    │   projectedMonthly  = dailyBurnRate * totalDays
    │   { momPct, momTrend } = pctChange(mtdSpend, prevSpend)
    │
    │   effectiveCost(row)                   [Line 98]
    │   ├─ base = toNum(row.cost)
    │   ├─ creditTotal = Σ toNum(c.amount) for row.credits
    │   └─ return base + creditTotal
    │        └─ credits are negative → this SUBTRACTS them from cost
    │
    ├─ [Step 4] Build statistics[] — 4 stat cards (Lines 175–207)
    │
    │   ┌─ Card 1: MTD Spend
    │   │   value:  fmt(mtdSpend)
    │   │   change: momPct vs. last month or "No prior month data"
    │   │   trend:  momTrend
    │   │   description: longPeriod(currentYYYYMM) — elapsed of totalDays days
    │   │
    │   ├─ Card 2: Daily Burn Rate
    │   │   value:  fmt(dailyBurnRate)/day
    │   │   change: fmt(dailyBurnRate * 30) projected 30-day
    │   │   trend:  "neutral"
    │   │   description: avg over elapsed days
    │   │
    │   ├─ Card 3: Projected Monthly
    │   │   value:  fmt(projectedMonthly)
    │   │   change: momPct vs previous available month or "No comparison"
    │   │   trend:  momTrend
    │   │   description: based on elapsed-day avg burn rate
    │   │
    │   └─ Card 4: Previous Month / Previous available period
    │       label:  longPeriod(prevYYYYMM) + " Spend" or "Previous Month"
    │       value:  fmt(prevSpend) or "—"
    │       change: longPeriod(prevYYYYMM) or "No data"
    │       trend:  "neutral"
    │       description: prior period actual spend or "No prior month data available"
    │
    │   fmt(n)       [Line 126] → Intl.NumberFormat USD, dynamic decimals under $1
    │   longPeriod() [Line 68]  → "Mar 2026"
    │
    ├─ [Step 5] Build summary (Lines 209–215)
    │   {
    │     period:       "Mar 2026"
    │     daysElapsed:  elapsed
    │     daysInMonth:  totalDays
    │     daysRemaining: remaining
    │   }
    │
    ├─ [Step 6] Build dimension maps (Lines 217–249)
    │
    │   Phase A — bucket current rows into 4 maps
    │   for row of currentRows:
    │   │   cat = categorise(row.service.description)  [Line 60]
    │   │   └─ SERVICE_CATEGORY_MAP[serviceDescription] ?? "Other"
    │   │        ├─ "Compute Engine"   → "Compute"
    │   │        ├─ "Cloud Storage"    → "Storage"
    │   │        ├─ "Networking"       → "Network & Data Transfer"
    │   │        ├─ "BigQuery"         → "Third-party Services"
    │   │        └─ anything else      → "Other"
    │   │   categoryMap[cat] += effectiveCost(row)
    │   │   serviceMap[service.description] += effectiveCost(row)
    │   │   projectMap[project.name || project.id] += effectiveCost(row)
    │   │   skuMap[sku.description] += effectiveCost(row)
    │   │
    │   Phase B — bucket previous month rows into prevCategoryMap, prevServiceMap, prevProjectMap, prevSkuMap
    │   │
    ├─ [Step 6.5] Build ranked arrays via buildDrilldown() (Lines 251–254)
    │   drilldown = buildDrilldown(categoryMap, prevCategoryMap, mtdSpend)
    │   byService = buildDrilldown(serviceMap, prevServiceMap, mtdSpend)
    │   byProject = buildDrilldown(projectMap, prevProjectMap, mtdSpend)
    │   bySku     = buildDrilldown(skuMap, prevSkuMap, mtdSpend, 20)
    │
    ├─ [Step 7] Build charts[] — last 12 months (Lines 256–269)
    │
    │   for row of ALL rows (not just current month):
    │   │   monthlyMap[row.invoice.month] += effectiveCost(row)
    │   │
    │   sort keys ASC → slice last 12 → map to:
    │   {
    │     month:    shortMonth(yyyymm)  → "Jan" / "Feb" / etc.
    │     expenses: Math.round(total)
    │   }
    │
    └─ [Step 8] Return AggregatedDashboard (Line 271)
        return { statistics, charts, drilldown, byService, byProject, bySku, summary }
             └─ [END — pure return, no side effects]
```

---

## generateInsights(aggregated) — Full Flow

```
generateInsights(aggregated: AggregatedDashboard)       [lib/finops-engine.ts:276]
    │                                                     [async]
    │
    ├─ [Step 1] Init Anthropic client (Line 279)
    │   client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    │   └─ reads env via lib/env.ts (validated at startup)
    │
    ├─ [Step 2] Extract dashboard sections (Line 281)
    │   { statistics, drilldown, byService, byProject, bySku, summary } = aggregated
    │
    ├─ [Step 3] Extract key metrics (Lines 283–286)
    │   mtd         = statistics.find(s => s.label === "MTD Spend")
    │   burnRate    = statistics.find(s => s.label === "Daily Burn Rate")
    │   projected   = statistics.find(s => s.label === "Projected Monthly")
    │   prevMonth   = statistics.find(s => s.label.includes("Spend") && s.label !== "MTD Spend")
    │
    ├─ [Step 4] Build reusable formatter (Lines 288–289)
    │   fmt(arr) = arr.map(d =>
    │     "${d.name}: $${d.amount} (${d.percentage}%, ${d.change} MoM)"
    │   ).join("\n")
    │   └─ e.g. "Compute: 11644 USD (35%, +12% vs last month)"
    │
    ├─ [Step 5] Build prompt (Lines 291–327)
    │   Injects:
    │   ├─ summary.period          → "Mar 2026"
    │   ├─ mtd.value + change      → "$33,270 (+3% vs. last month)"
    │   ├─ burnRate.value          → "$1,584/day"
    │   ├─ projected.value+change  → "$51,375"
    │   ├─ prevMonth.value         → previous available spend
    │   ├─ summary.daysElapsed     → 21
    │   ├─ summary.daysInMonth     → 31
    │   ├─ fmt(drilldown)          → category breakdown
    │   ├─ fmt(byService)          → service breakdown
    │   ├─ fmt(byProject)          → project breakdown
    │   └─ fmt(bySku.slice(0, 10)) → top SKU breakdown
    │
    │   Output format requested:
    │   [{ id, type: "warning"|"info"|"success", title, message }]
    │   Rules injected:
    │   ├─ "warning" → budget risks / cost spikes
    │   ├─ "info"    → anomalies / trends worth watching
    │   └─ "success" → cost reductions / positive patterns
    │
    ├─ [Step 6] Call Anthropic API (Lines 329–334)  [async]  [external]
    │   client.messages.create({
    │     model:      "claude-haiku-4-5",
    │     max_tokens: 1024,
    │     messages:   [{ role: "user", content: prompt }]
    │   })
    │   └─ returns: Message { content: [{ type: "text", text: "..." }] }
    │
    ├─ [Step 7] Extract text (Lines 336–337)
    │   raw = response.content[0].type === "text" ? response.content[0].text : ""
    │
    ├─ [Step 8] Strip markdown fences if present (Line 340) ← NEW
    │   text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    │
    ├─ [Step 9] Parse JSON (Line 342)
    │   parsed = JSON.parse(text) as Alert[]
    │   └─ expects a raw JSON array — no markdown fences
    │
    ├─ [Step 10] Validate and return (Line 344)
    │   return Array.isArray(parsed) ? parsed : []
    │
    └─ [CATCH] (Lines 345–348) — Non-fatal error path
        console.error("generateInsights failed:", error)
        return []
             └─ [END — caller gets empty array, dashboard still renders]
```

---

## Helper Functions Reference

```
toNum(v: unknown): number                   [Line 93]
└─ Number(v)
     └─ returns 0 when value is not finite

effectiveCost(row: BillingRow): number      [Line 98]
└─ toNum(row.cost) + Σ toNum(credit.amount)
     └─ credits are negative values → net cost after credits

categorise(serviceDescription: string)      [Line 60]
└─ SERVICE_CATEGORY_MAP[desc] ?? "Other"
     └─ maps 20 GCP services to 5 buckets

shortMonth(yyyymm: string): string          [Line 64]
└─ "202503" → "Mar"

longPeriod(yyyymm: string): string          [Line 68]
└─ "202503" → "Mar 2026"

calcDaysInMonth(year, month): number        [Line 74]
└─ new Date(year, month, 0).getDate()
     └─ month=0 trick — day 0 of next month = last day of current

pctChange(current, previous)                [Line 78]
└─ if previous === 0 → { pct: "N/A", trend: "neutral" }
   delta = (current - previous) / previous * 100
   trend = "neutral" if |delta| < 1 | "up" if delta > 0 | "down" if delta < 0
   pct   = "+12%" / "-5%" format

buildDrilldown(currentMap, prevMap, totalSpend, topN?) [Line 104]
└─ sort current entries by amount DESC
   optionally slice topN
   map each entry to CostDriver
   uses pctChange() for `change` and `trend`
```

---

## Output Shape

```
aggregate() → AggregatedDashboard
{
  statistics: FinancialMetric[4]   ← stat cards (MTD, Burn, Projected, Previous Period)
  charts:     ChartDataPoint[]     ← last 12 months of expenses
  drilldown:  CostDriver[]         ← categories sorted by spend DESC (Compute, Storage, Network, ...)
  byService:  CostDriver[]         ← raw services sorted by spend DESC
  byProject:  CostDriver[]         ← projects sorted by spend DESC
  bySku:      CostDriver[]         ← top 20 SKUs sorted by spend DESC
  summary:    FinancialSummary     ← period string, daysElapsed, daysInMonth, daysRemaining
}

generateInsights() → Alert[]
[
  { id, type: "warning"|"info"|"success", title, message }
  ...3–5 items
]
```

---

## Key Constants

| Constant | Value | Note |
|----------|-------|------|
| `SERVICE_CATEGORY_MAP` | 20 GCP services | Maps to 5 buckets; unmapped → "Other" |
| `MONTH_NAMES` | `"01"→"Jan"` … | YYYYMM → display label |
| Anthropic model | `claude-haiku-4-5` | Used in `generateInsights()` |
| Anthropic max_tokens | `1024` | Enough for 3–5 JSON alerts |

---

## Error Behaviour

| Scenario | Where | Result |
|----------|-------|--------|
| `rows` is empty | Step 1 | Returns empty dashboard shape with empty arrays and zero-day summary |
| `row.cost` is NaN string | `toNum()` | Returns `0` — safe fallback |
| `row.credits` is empty array | `effectiveCost()` | `creditTotal = 0` — no effect |
| Previous month has no rows | `pctChange(x, 0)` | Returns `{ pct: "N/A", trend: "neutral" }` |
| Anthropic API throws | `generateInsights` CATCH | Returns `[]` — non-fatal, dashboard renders without alerts |
| `JSON.parse` fails on AI response | `generateInsights` CATCH | Returns `[]` — same safe fallback |
