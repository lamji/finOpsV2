# Projected Monthly — How It's Computed

## The Short Answer
Take the Daily Burn Rate and multiply by the total number of days in the current month. This gives the end-of-month spend projection if the current daily pace holds.

---

## Step by Step

**1. Start with Daily Burn Rate**
Already computed — see `daily-burn-rate-computation.md`.
```
Daily Burn Rate (March 2026, 25 days elapsed) = $0.475334/day
```

**2. Determine total days in the month**
```ts
const totalDays = calcDaysInMonth(year, month)
// calcDaysInMonth(2026, 3) → new Date(2026, 3, 0).getDate() → 31
```
March 2026 has 31 days.

**3. Compute Projected Monthly**
```
Projected Monthly = Daily Burn Rate × totalDays
                  = $0.475334 × 31
                  = $14.74
                  ≈ $15  (formatted, no decimals for values ≥ $1)
```

**4. Compute the change label (-7% vs. Feb 2026)**
The change shown on the card is the same MoM % as MTD Spend — it compares this month's MTD to last month's full total:
```
Feb 2026 total = $12.83
Mar 2026 MTD   = $11.88

MoM % = (11.88 - 12.83) / 12.83 × 100 = -7%
```
The label is built at `finops-engine.ts:194`:
```ts
change: prevSpend > 0
  ? `${momPct} vs. ${longPeriod(prevYYYYMM)}`   // "-7% vs. Feb 2026"
  : "No comparison"
```

**5. Compute the description ("Based on 25-day avg burn rate")**
Built at `finops-engine.ts:198`:
```ts
description: `Based on ${elapsed}-day avg burn rate`
// → "Based on 25-day avg burn rate"
```
`elapsed = 25` because March 2026 matches `todayYYYYMM` and today is the 25th.

---

## Why $15 from a sandbox project?

The GCP billing export (`DF-SANDBOX`, project `lithe-sonar-431106-j2`) has very low actual spend.
March 2026 has 1,659 rows but most carry near-zero cost:

| Service | MTD Cost | Daily Avg |
|---------|----------|-----------|
| Compute Engine | $4.48 | $0.18/day |
| Vertex AI | $2.26 | $0.09/day |
| Kubernetes Engine | $1.79 | $0.07/day |
| Networking | $1.72 | $0.07/day |
| Cloud SQL | $1.37 | $0.06/day |
| **Total** | **$11.88** | **$0.48/day** |

Projected: `$0.48 × 31 = $15`

---

## Where It Appears in Code

```
lib/finops-engine.ts → aggregate()
  ├── mtdSpend        = Σ effectiveCost(currentRows)    → $11.88
  ├── elapsed         = now.getDate()                   → 25
  ├── dailyBurnRate   = mtdSpend / elapsed              → $0.4753/day
  ├── totalDays       = calcDaysInMonth(2026, 3)        → 31
  ├── projectedMonthly = dailyBurnRate × totalDays      → $14.74
  ├── momPct          = pctChange(11.88, 12.83)         → "-7%"
  └── statistics[2] = {
        label:       "Projected Monthly"
        value:       fmt(projectedMonthly)              → "$15"
        change:      "-7% vs. Feb 2026"
        trend:       momTrend                           → "down"
        description: "Based on 25-day avg burn rate"
      }
```

---

## Difference vs. "Projected 30-day" (Daily Burn Rate card)

| Card | Formula | Value |
|------|---------|-------|
| Daily Burn Rate → change | `dailyBurnRate × 30` | `$14` (fixed 30-day window) |
| **Projected Monthly** → value | `dailyBurnRate × totalDays` | `$15` (actual days in month) |

The Projected Monthly card uses the real month length (31 for March), not a fixed 30-day window.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| `elapsed = 0` (no data yet) | `dailyBurnRate = 0` → `projectedMonthly = 0` |
| No previous month data | `change = "No comparison"`, `trend = "neutral"` |
| Past month data (not current month) | `elapsed = totalDays` — full month already elapsed, projection = actual MTD |
| Projected > budget ($50,000) | No cap — shown as-is; budget comparison lives in a separate card |
