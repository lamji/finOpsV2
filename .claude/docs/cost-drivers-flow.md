# Cost Drivers Breakdown — How It's Computed

**Sources:** `lib/finops-engine.ts`, `Presentation/Dashboard/useDashboard.ts`, `components/MainContent/index.tsx`

---

## Overview

After MTD spend is computed, the engine groups the same rows by service, project, and SKU — then sorts each group by spend and calculates what percentage of the total each one represents.

The result is three ranked lists: `byService`, `byProject`, `bySku`.

---

## Sample Source Data

These are the actual `ServiceCostRow[]` records the engine receives for **March 2026** — already grouped by BigQuery before arriving here.

| invoice_month | service_description | project_name | sku_description | effective_cost |
|---|---|---|---|---|
| `202603` | Kubernetes Engine | DF-SANDBOX | Autopilot Pod mCPU Requests (me-central1) | `"0.088353"` |
| `202603` | Kubernetes Engine | DF-SANDBOX | Autopilot SSD Ephemeral Storage (europe-central2) | `"0.000126"` |
| `202603` | Kubernetes Engine | DF-SANDBOX | Autopilot SSD Ephemeral Storage (me-central1) | `"9.0E-6"` |
| `202603` | Compute Engine | DF-SANDBOX | E2 Instance Core running in Doha | `"0.001034"` |
| `202603` | Compute Engine | DF-SANDBOX | Storage PD Capacity in me-central1 | `"0.000412"` |
| `202603` | Cloud SQL | DF-SANDBOX | Cloud SQL for PostgreSQL: Regional - Low cost storage Americas | `"0.002422"` |
| `202603` | Cloud SQL | DF-SANDBOX | Cloud SQL for MySQL: Zonal - Low cost storage Americas | `"0.001339"` |
| `202603` | Cloud Run | DF-SANDBOX | CPU Allocation Time me-central1 | `"0.004210"` |
| `202603` | Cloud Run | DF-SANDBOX | Memory Allocation Time me-central1 | `"0.001105"` |
| `202603` | Cloud KMS | DF-SANDBOX | Active software symmetric key versions | `"5.28E-4"` |
| `202603` | Cloud Storage | DF-SANDBOX | Standard Storage Warsaw | `"0.0"` |
| `202603` | Cloud Storage | DF-SANDBOX | Standard Storage Warsaw (Class A ops) | `"0.000031"` |
| `202603` | Cloud Monitoring | DF-SANDBOX | Monitoring Data me-central1 | `"0.000087"` |
| `202602` | Kubernetes Engine | DF-SANDBOX | Autopilot Pod mCPU Requests (me-central1) | `"0.062000"` |
| `202602` | Compute Engine | DF-SANDBOX | E2 Instance Core running in Doha | `"0.053002"` |
| `202602` | Cloud SQL | DF-SANDBOX | Cloud SQL for MySQL: Zonal - Low cost storage Americas | `"0.001339"` |
| `202602` | Cloud Run | DF-SANDBOX | CPU Allocation Time me-central1 | `"0.004000"` |
| `202602` | Cloud KMS | DF-SANDBOX | Active software symmetric key versions | `"0.001000"` |
| *(remaining Feb rows)* | | | | |

> `202603` rows = **currentRows** (March, used for MTD)
> `202602` rows = **prevRows** (February, used only for MoM comparison)

---

## Step 1 — Build dimension maps from current rows

**Code — `finops-engine.ts:192–209`**
```ts
const serviceMap = new Map<string, number>()
const projectMap = new Map<string, number>()
const skuMap     = new Map<string, number>()

for (const row of currentRows) {
  const cost = toNum(row.effective_cost)
  const svc  = row.service_description ?? "Unknown"
  const proj = row.project_name ?? row.project_id ?? "Unknown"
  const sku  = row.sku_description ?? "Unknown"

  serviceMap.set(svc,  (serviceMap.get(svc)  ?? 0) + cost)
  projectMap.set(proj, (projectMap.get(proj) ?? 0) + cost)
  skuMap.set(sku,      (skuMap.get(sku)      ?? 0) + cost)
}
```

Each map accumulates spend per key. Same row contributes to all three maps simultaneously.

**Sample — what gets added to `serviceMap` row by row:**

| row | service_description | effective_cost | serviceMap after |
|---|---|---|---|
| 1 | `"Kubernetes Engine"` | `"0.088353"` | `{ "Kubernetes Engine": 0.088353 }` |
| 2 | `"Kubernetes Engine"` | `"0.000126"` | `{ "Kubernetes Engine": 0.088479 }` |
| 3 | `"Kubernetes Engine"` | `"9.0E-6"` | `{ "Kubernetes Engine": 0.088488 }` |
| 4 | `"Compute Engine"` | `"0.001034"` | `{ "Kubernetes Engine": 0.088488, "Compute Engine": 0.001034 }` |
| 5 | `"Compute Engine"` | `"0.000412"` | `{ "Kubernetes Engine": 0.088488, "Compute Engine": 0.001446 }` |
| 6 | `"Cloud SQL"` | `"0.002422"` | `{ ..., "Cloud SQL": 0.002422 }` |
| 7 | `"Cloud SQL"` | `"0.001339"` | `{ ..., "Cloud SQL": 0.003761 }` |
| 8 | `"Cloud Run"` | `"0.004210"` | `{ ..., "Cloud Run": 0.004210 }` |
| 9 | `"Cloud Run"` | `"0.001105"` | `{ ..., "Cloud Run": 0.005315 }` |
| ... | *(remaining rows)* | | |

**Final `serviceMap` after all currentRows:**
```
"Kubernetes Engine"  → 0.088488   (all KE rows summed)
"Compute Engine"     → 0.001446   (all CE rows summed)
"Cloud SQL"          → 0.003761
"Cloud Run"          → 0.005315
"Cloud KMS"          → 0.000528
"Cloud Storage"      → 0.000031
"Cloud Monitoring"   → 0.000087
...                  → ...
```

The same process runs in parallel for `prevRows` into `prevServiceMap`, `prevProjectMap`, `prevSkuMap` — used later for MoM comparison.

---

## Step 2 — Build ranked drilldown lists

**Code — `finops-engine.ts:212–214`**
```ts
const byService = buildDrilldown(serviceMap, prevServiceMap, mtdSpend)
const byProject = buildDrilldown(projectMap, prevProjectMap, mtdSpend)
const bySku     = buildDrilldown(skuMap,     prevSkuMap,     mtdSpend, 20)
```

`bySku` passes `20` as `topN` — only the top 20 SKUs by spend are kept. `byService` and `byProject` have no limit.

**`buildDrilldown` — `finops-engine.ts:72–91`**
```ts
function buildDrilldown(
  currentMap: Map<string, number>,
  prevMap:    Map<string, number>,
  totalSpend: number,
  topN?:      number,
): CostDriver[] {
  let entries = Array.from(currentMap.entries()).sort((a, b) => b[1] - a[1])
  if (topN) entries = entries.slice(0, topN)

  return entries.map(([name, amount]) => {
    const prev = prevMap.get(name) ?? 0
    const { pct, trend } = pctChange(amount, prev)
    return {
      name,
      amount,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
      trend,
      change: pct,
    }
  })
}
```

What each field means:
- `name` — the service, project, or SKU label
- `amount` — total spend for that name in the current month
- `percentage` — `amount / mtdSpend × 100`, rounded to a whole number
- `trend` — `"up"`, `"down"`, or `"neutral"` vs previous month
- `change` — MoM % string like `"-7%"` or `"N/A"`

**Sample — `buildDrilldown` applied to `serviceMap` (mtdSpend = 11.88):**

| name | amount | prev (Feb) | percentage | trend | change |
|---|---|---|---|---|---|
| Kubernetes Engine | 0.088488 | 0.062 | `Math.round(0.088488 / 11.88 × 100)` = 1% | `up` | `+43%` |
| Cloud Run | 0.005315 | 0.004 | `Math.round(0.005315 / 11.88 × 100)` = 0% | `up` | `+33%` |
| Cloud SQL | 0.003761 | 0.004 | `Math.round(0.003761 / 11.88 × 100)` = 0% | `down` | `-6%` |
| Compute Engine | 0.001446 | 0.054 | `Math.round(0.001446 / 11.88 × 100)` = 0% | `down` | `-97%` |
| Cloud KMS | 0.000528 | 0.001 | 0% | `down` | `-47%` |
| Cloud Storage | 0.000031 | 0.000 | 0% | `up` | `N/A` |
| Cloud Monitoring | 0.000087 | 0.000 | 0% | `neutral` | `N/A` |

> Percentages show 0% for sub-$1 amounts against an $11.88 total because `Math.round()` rounds anything below 0.5% down to 0. This is expected for sandbox data with small absolute values.

---

## Step 3 — useDashboard passes the lists to the component

**Code — `Presentation/Dashboard/useDashboard.ts:5–19`**
```ts
export function useDashboard() {
  const { data, isLoading, isError, error } = useApiDashboard()

  return {
    byService: data?.byService ?? [],   // CostDriver[]
    byProject: data?.byProject ?? [],   // CostDriver[]
    bySku:     data?.bySku     ?? [],   // CostDriver[]  (top 20)
    ...
  }
}
```

`?? []` means if the API hasn't responded yet or returned nothing, each list defaults to an empty array — no crash.

---

## Step 4 — Component renders the breakdown

**Code — `components/MainContent/index.tsx:274–275, 303–318`**
```ts
export function MainContent() {
  const { byService, byProject, bySku, charts, summary, isLoading, isError } = useDashboard()
  ...
  <BreakdownSection title="By Service" items={byService} />
  <BreakdownSection title="By Project" items={byProject} />
  <BreakdownSection title="By SKU"     items={bySku}     />
```

**`BreakdownSection` — `components/MainContent/index.tsx:97–111`**
```ts
function BreakdownSection({ title, description, items }) {
  const topItems  = items.slice(0, 8)           // max 8 bars shown
  const chartData = topItems.map((item, index) => ({
    name:           item.name.length > 24
                      ? `${item.name.slice(0, 24)}...`
                      : item.name,              // truncate long names at 24 chars
    amount:         item.amount,
    percentage:     item.percentage,
    fill:           chartPalette[index % chartPalette.length],
  }))
  const total = items.reduce((sum, item) => sum + item.amount, 0)
```

- Slices to top 8 for the bar chart (even if `byService` has more entries)
- Names longer than 24 characters get truncated with `...`
- `total` is recomputed from all `items` (not just top 8) for the header display

**`formatSpendAmount` — `components/MainContent/index.tsx:51–59`**
```ts
function formatSpendAmount(amount: number) {
  const safeAmount = Math.max(0, amount)         // negative → 0

  if (safeAmount >= 1000) {
    return `$${(safeAmount / 1000).toFixed(1)}k` // e.g. $1.2k
  }

  return currencyFormatter.format(safeAmount)    // e.g. $0.09
}
```

| amount | result |
|---|---|
| `0.088488` | `$0.09` |
| `0.005315` | `$0.01` |
| `1200` | `$1.2k` |
| `-0.001` | `$0.00` (Math.max clamps to 0) |

---

## Final Output — What the UI shows

Three bar charts, each sorted highest spend first:

**By Service**
| Service | Amount | % of Total | MoM |
|---|---|---|---|
| Kubernetes Engine | $0.09 | 1% | +43% |
| Cloud Run | $0.01 | 0% | +33% |
| Cloud SQL | $0.00 | 0% | -6% |
| Compute Engine | $0.00 | 0% | -97% |
| ... | | | |

**By Project**
| Project | Amount | % of Total | MoM |
|---|---|---|---|
| DF-SANDBOX | $11.88 | 100% | -7% |

**By SKU** (top 20 only)
| SKU | Amount | % of Total | MoM |
|---|---|---|---|
| Autopilot Pod mCPU Requests (me-central1) | $0.09 | 1% | +43% |
| Cloud Run CPU Allocation Time me-central1 | $0.00 | 0% | +33% |
| ... | | | |
