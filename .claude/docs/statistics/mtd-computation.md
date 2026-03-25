# MTD Spend — How It's Computed

## The Short Answer
We pull every billing row for the current year from BigQuery, then sum up the `cost` field for rows that belong to the current month.

---

## Step by Step

**1. Query BigQuery**
Get all raw billing rows for 2026 (Jan + Feb + Mar so far).
- Total: 4,046 rows across 3 months
- Mar 2026 alone: 1,659 rows

**2. For each row, compute effective cost**
```
effectiveCost = cost + credits
```
- `cost` is already in USD (e.g. `"0.00294"`)
- `credits` are negative amounts (discounts) — subtracted automatically
- Most rows have no credits, so `effectiveCost = cost`

**3. Filter to current month only**
Only rows where `invoice.month = "202603"` count toward MTD.

**4. Sum them all up**
```
MTD Spend = SUM of effectiveCost for all March 2026 rows
          = $11.88
```

**5. Compare to last month (MoM %)**

Same process — sum all rows where `invoice.month = "202602"`:

Sample Feb 2026 rows (from `march-2026-raw.json`):
```json
[
  {
    "service": { "description": "Kubernetes Engine" },
    "sku": { "description": "Autopilot SSD Pod Ephemeral Storage Requests (europe-central2)" },
    "cost": "1.85E-4",
    "credits": [],
    "invoice": { "month": "202602" }
  },
  {
    "service": { "description": "Compute Engine" },
    "sku": { "description": "E2 Instance Core running in Doha" },
    "cost": "0.053002",
    "credits": [],
    "invoice": { "month": "202602" }
  },
  {
    "service": { "description": "Cloud SQL" },
    "sku": { "description": "Cloud SQL for MySQL: Zonal - Low cost storage in Americas" },
    "cost": "0.001339",
    "credits": [],
    "invoice": { "month": "202602" }
  }
]
```

Then apply the formula:
```
Feb total  = $12.83   (sum of all 1,126 Feb rows)
Mar total  = $11.88   (sum of all 1,659 Mar rows)

MoM % = (Mar - Feb) / Feb * 100
       = (11.88 - 12.83) / 12.83 * 100
       = -0.95 / 12.83 * 100
       = -7%
```

---

## Why $11.88 from 1,659 rows?

Most rows have `cost: "0.0"` — GCP exports a row for every resource-hour even if the cost rounds to zero.

Example of a zero-cost row:
```
Service:  Cloud Storage (Standard Storage Warsaw)
Usage:    1.86E-7 gibibyte month  ← tiny
Cost:     $0.0                    ← rounds to nothing
```

Real rows from your `march-2026-only.json` that contribute to the $11.88:

```json
[
  {
    "service": { "description": "Kubernetes Engine" },
    "sku": { "description": "Autopilot Pod mCPU Requests (me-central1)" },
    "cost": "0.088353",
    "credits": [],
    "invoice": { "month": "202603" }
  },
  {
    "service": { "description": "Cloud SQL" },
    "sku": { "description": "Cloud SQL for PostgreSQL: Regional - Low cost storage in Americas" },
    "cost": "0.002422",
    "credits": [],
    "invoice": { "month": "202603" }
  },
  {
    "service": { "description": "Compute Engine" },
    "sku": { "description": "E2 Instance Core running in Doha" },
    "cost": "0.001034",
    "credits": [],
    "invoice": { "month": "202603" }
  },
  {
    "service": { "description": "Kubernetes Engine" },
    "sku": { "description": "Autopilot SSD Pod Ephemeral Storage Requests (europe-central2)" },
    "cost": "1.26E-4",
    "credits": [],
    "invoice": { "month": "202603" }
  },
  {
    "service": { "description": "Kubernetes Engine" },
    "sku": { "description": "Autopilot SSD Pod Ephemeral Storage Requests (me-central1)" },
    "cost": "9.0E-6",
    "credits": [],
    "invoice": { "month": "202603" }
  }
]
```

No credits on any → `effectiveCost = parseFloat(cost)` directly.

1,659 rows × ~$0.007 average = **$11.88 total**. The sandbox runs lightweight services (Cloud Run, KMS, Monitoring) with no heavy compute or storage.
