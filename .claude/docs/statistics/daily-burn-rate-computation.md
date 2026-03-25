# Daily Burn Rate — How It's Computed

## The Short Answer
Take the MTD Spend and divide by the number of days elapsed so far this month. That gives the average daily spend. Multiply by 30 for the projected 30-day figure shown on the card.

---

## Step by Step

**1. Start with MTD Spend**
Already computed — see `mtd-computation.md`.
```
MTD Spend (March 2026, 25 days elapsed) = $11.88
```

**2. Determine days elapsed**
```ts
const now = new Date()
const todayYYYYMM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
const elapsed = currentYYYYMM === todayYYYYMM ? now.getDate() : totalDays
```
- If the data's current month equals today's calendar month → use `now.getDate()` (e.g. 25)
- If the data is a past month → use the full month length (all days elapsed)

For March 2026 on the 25th:
```
elapsed = 25
```

**3. Compute Daily Burn Rate**
```
Daily Burn Rate = MTD Spend / days elapsed
               = $11.883347 / 25
               = $0.475334/day
               ≈ $0.48/day  (formatted to 2 decimal places)
```

**4. Compute Projected 30-day**
The card shows projected spend over a fixed 30-day window — not end-of-month projection:
```
Projected 30-day = Daily Burn Rate × 30
                 = $0.475334 × 30
                 = $14.26
```

**5. Projected Monthly (end of March)**
The "Projected Monthly" stat card uses the actual days in the month:
```
Projected Monthly = Daily Burn Rate × totalDays
                  = $0.475334 × 31
                  = $14.74
```

---

## Why the Formatter Matters

Daily Burn Rate is sub-$1 for this sandbox. The `fmt()` function in `lib/finops-engine.ts` handles this:

```ts
const safe = n < 0 && Math.round(n) === 0 ? 0 : n
return new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: Math.abs(safe) < 1 ? 2 : 0,
}).format(safe)
```

- Values `< $1` → formatted with **2 decimal places** → `$0.48`
- Values `≥ $1` → formatted with **0 decimal places** → `$14`

**The bug that was fixed:** The original guard was `Math.round(n) === 0 ? 0 : n` (no `n < 0` check). This collapsed any positive value < $0.50 to zero before formatting — so `$0.475` became `$0`. Fixed to only guard negative near-zero values.

---

## Where It Appears in Code

```
lib/finops-engine.ts → aggregate()
  ├── mtdSpend = Σ effectiveCost(currentRows)          → $11.88
  ├── elapsed  = now.getDate()                         → 25
  ├── dailyBurnRate = mtdSpend / elapsed               → $0.4753
  └── statistics[1] = {
        label:       "Daily Burn Rate"
        value:       fmt(dailyBurnRate) + "/day"       → "$0.48/day"
        change:      fmt(dailyBurnRate * 30) + " projected 30-day"  → "$14 projected 30-day"
        description: "Avg over 25 days"
      }
```

---

## Per-Service Breakdown of Daily Burn

The $0.48/day comes from these top services (March 2026):

| Service | MTD Cost | Daily Average |
|---------|----------|---------------|
| Compute Engine | $4.48 | $0.18/day |
| Vertex AI | $2.26 | $0.09/day |
| Kubernetes Engine | $1.79 | $0.07/day |
| Networking | $1.72 | $0.07/day |
| Cloud SQL | $1.37 | $0.06/day |
| **Total** | **$11.88** | **$0.48/day** |

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| `elapsed = 0` (first day, no data yet) | `dailyBurnRate = 0` (guarded: `elapsed > 0 ? mtdSpend / elapsed : 0`) |
| Past month data (not current month) | `elapsed = totalDays` — treats full month as elapsed |
| Sub-$0.50 daily rate | Shown as `$0.XX` (2 decimal places) — not collapsed to `$0` |
| Credits applied | `effectiveCost = cost + credits` — credits are negative, so net cost is lower |
