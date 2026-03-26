# Dashboard Summary Metrics Investigation

## Request
Investigate why the dashboard cards in the screenshot show `MTD Spend = $0.00`, `Daily Burn Rate = $0.00/day`, `Projected Monthly = $0.00`, and `Feb 2026 Spend = $1,450`.

## Trigger Point
- Confirmed trigger: `Presentation/Dashboard/index.tsx:18` renders `StatsSection`, which is the component that shows the summary cards.

## Confirmed Flow
1. `Dashboard()` renders `StatsSection`, so the stats cards start from the dashboard page render. (`Presentation/Dashboard/index.tsx:10-23`)
2. `StatsSection()` reads `financialOverview` from `useDashboard()` and passes each returned metric directly into `StatCard` without changing the values. (`components/StatsSection/index.tsx:25-57`)
3. `useDashboard()` maps `data.statistics` from the API response into `financialOverview`. It does not transform the numbers. (`Presentation/Dashboard/useDashboard.ts:5-18`)
4. `useApiDashboard()` fetches `/api/bigquery` and returns the JSON body unchanged to the dashboard query hook. (`Presentation/Dashboard/useApiDashboard.ts:9-25`)
5. `GET /api/bigquery` uses a default SQL query that selects all rows for the current year by `invoice.month LIKE '${new Date().getFullYear()}%'`, grouped by month, service, project, and SKU. There is no filter limiting the query to completed months or excluding near-zero totals. (`app/api/bigquery/route.ts:131-140`)
6. After BigQuery returns rows, the route normalizes them and calls `aggregate(rows)`. The aggregated statistics are then returned to the client as `statistics`, and the raw rows are also returned as `rawPayload`. (`app/api/bigquery/route.ts:109-127`, `app/api/bigquery/route.ts:306-316`, `app/api/bigquery/route.ts:333-337`)
7. `aggregate()` derives the active reporting period from the lexicographically last `invoice_month` present in the raw rows. It does this with `allMonths = unique(invoice_month).sort()` and then `currentYYYYMM = allMonths[allMonths.length - 1]`. It does not check whether that month is materially populated. (`lib/finops-engine.ts:105-120`)
8. `aggregate()` then filters `currentRows` to that chosen month and computes `mtdSpend`, `dailyBurnRate`, `projectedMonthly`, and the month-over-month comparison from those rows. (`lib/finops-engine.ts:131-140`)
9. The formatter used for the stat values deliberately collapses tiny negative values whose rounded value is zero to `0`, specifically `const safe = n < 0 && Math.round(n) === 0 ? 0 : n`. That causes a slightly negative near-zero month total to display as `$0.00`. (`lib/finops-engine.ts:93-103`)
10. The labels in the screenshot come directly from those computed metrics: `MTD Spend`, `Daily Burn Rate`, `Projected Monthly`, and the previous month label `${longPeriod(prevYYYYMM)} Spend`. (`lib/finops-engine.ts:143-173`)

## Runtime Confirmation
- Confirmed live API response from `http://127.0.0.1:3000/api/bigquery` matched the screenshot exactly:
  - `MTD Spend = $0.00`
  - `Daily Burn Rate = $0.00/day`
  - `Projected Monthly = $0.00`
  - `Feb 2026 Spend = $1,450`
  - `summary.period = Mar 2026`
- Confirmed live payload totals:
  - March 2026 rows: `829`
  - March 2026 summed `effective_cost`: `-0.018503999999995295`
  - February 2026 rows: `854`
  - February 2026 summed `effective_cost`: `1449.7599999999993`
- This runtime result is consistent with the code path above:
  - March is chosen because it is the latest `invoice_month`.
  - March displays as `$0.00` because the month total is a tiny negative value and the formatter collapses that to zero.
  - February displays as `$1,450` because the previous month total rounds to that value.

## Variables And Declarations That Matter
- `query` - default SQL that fetches all months in the current year, not just the last complete month. (`app/api/bigquery/route.ts:134-136`)
- `rows` - normalized BigQuery result passed into the aggregator. (`app/api/bigquery/route.ts:306-313`)
- `allMonths` - sorted distinct month list used to decide the active period. (`lib/finops-engine.ts:105-106`)
- `currentYYYYMM` - chosen as the last month in `allMonths`, which becomes the dashboard period. (`lib/finops-engine.ts:119`)
- `currentRows` and `prevRows` - the rows used to compute current and previous period metrics. (`lib/finops-engine.ts:132-133`)
- `mtdSpend` and `prevSpend` - totals that drive the summary cards and comparison strings. (`lib/finops-engine.ts:136-140`)
- `safe` in `fmt()` - forces tiny negative totals to render as zero. (`lib/finops-engine.ts:94-103`)

## Branches And Alternate Paths
- Confirmed branch on investigated path: when at least one month exists, `aggregate()` skips the empty-data return and continues with the latest month in the dataset. (`lib/finops-engine.ts:108-120`)
- Confirmed branch on investigated path: because `prevSpend > 0`, the MTD card uses the change string `${momPct} vs. last month`, and the projected card uses `${momPct} vs. ${longPeriod(prevYYYYMM)}`. (`lib/finops-engine.ts:145-165`)
- Alternate branch not taken: if `allMonths.length === 0`, the function would return empty statistics and a blank summary instead of the cards in the screenshot. (`lib/finops-engine.ts:108-116`)
- Alternate branch not taken: if the selected month total were a positive sub-dollar value, `fmt()` would preserve decimals instead of forcing zero. (`lib/finops-engine.ts:95-103`)

## Terminal Effect
- The API returns `aggregated.statistics` and `aggregated.summary`, and the client renders those values directly in the cards. (`app/api/bigquery/route.ts:115-125`, `app/api/bigquery/route.ts:333-337`, `components/StatsSection/index.tsx:46-57`)

## Evidence Ledger
- Stats cards originate from the dashboard page render -> `Presentation/Dashboard/index.tsx:10-23`
- Stats card values come straight from `financialOverview` -> `components/StatsSection/index.tsx:25-57`
- `financialOverview` is `data.statistics` from the API hook -> `Presentation/Dashboard/useDashboard.ts:5-18`
- `/api/bigquery` is the only fetch in this path -> `Presentation/Dashboard/useApiDashboard.ts:9-25`
- Default query selects all current-year invoice months -> `app/api/bigquery/route.ts:134-136`
- BigQuery rows are normalized and passed into `aggregate(rows)` -> `app/api/bigquery/route.ts:306-313`
- Aggregated statistics are returned unchanged to the client -> `app/api/bigquery/route.ts:115-125`, `app/api/bigquery/route.ts:333-337`
- Latest visible month is chosen by sorted `invoice_month`, not by completeness or spend threshold -> `lib/finops-engine.ts:105-120`
- Current-period totals come only from `currentRows` for that chosen month -> `lib/finops-engine.ts:131-140`
- Tiny negative totals are rendered as zero -> `lib/finops-engine.ts:94-103`
- Metric labels and descriptions in the screenshot are generated in `statistics` -> `lib/finops-engine.ts:143-173`

## Inferred Or Unresolved
- Confirmed: the screenshot is not caused by a frontend display bug. The frontend is rendering the API response as-is. (`components/StatsSection/index.tsx:46-57`, `Presentation/Dashboard/useDashboard.ts:5-18`)
- Confirmed: the immediate root cause is period selection plus rounding behavior. March 2026 is selected because it exists in the dataset, and its near-zero negative total is formatted as `$0.00`. (`lib/finops-engine.ts:105-120`, `lib/finops-engine.ts:94-103`)
- Inferred: if the intended business rule is “show the last materially populated or last closed billing month,” then the current implementation is wrong because it always prefers the latest raw `invoice_month` regardless of completeness or magnitude. The code contains no rule for completeness, closure, or minimum spend threshold. (`app/api/bigquery/route.ts:134-136`, `lib/finops-engine.ts:105-120`)
