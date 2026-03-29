"""
FinOps Engine — Python port of lib/finops-engine.ts aggregate()
Aligned exactly with TS output shape and behaviour.
"""

import calendar
from collections import defaultdict
from datetime import datetime

from app.models import (
    AggregatedDashboard,
    ChartDataPoint,
    CostDriver,
    FinancialMetric,
    FinancialSummary,
    ServiceCostRow,
)

MONTH_NAMES: dict[str, str] = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}


# ── Helpers (match TS helpers exactly) ───────────────────────────────────

def _short_month(yyyymm: str) -> str:
    """
    Converts a YYYYMM string to a 3-letter month label.
    Slices characters 4–6 to extract the month number, then looks it up in MONTH_NAMES.
    Used for chart X-axis labels.
    Example: "202503" → "Mar"
    """
    return MONTH_NAMES.get(yyyymm[4:6], yyyymm[4:6])


def _long_period(yyyymm: str) -> str:
    """
    Converts a YYYYMM string to a human-readable month + year label.
    Same month slice as _short_month but also prepends the 4-digit year.
    Used in stat card descriptions, labels, and sidebar period display.
    Example: "202503" → "Mar 2026"
    """
    return f"{MONTH_NAMES.get(yyyymm[4:6], yyyymm[4:6])} {yyyymm[:4]}"


def _days_in_month(year: int, month: int) -> int:
    """
    Returns the total number of days in a given month.
    Uses Python's calendar.monthrange(year, month) which returns
    (weekday_of_first_day, total_days) — takes index [1] for the day count.
    Handles leap years automatically (e.g. Feb 2024 → 29).
    Example: (2026, 3) → 31
    """
    return calendar.monthrange(year, month)[1]


def _fmt(n: float) -> str:
    """
    Formats a float as a USD dollar string. Matches TS Intl.NumberFormat USD behaviour:
    - Tiny negatives that round to 0 (e.g. -0.001) → "$0"  avoids displaying "-$0"
    - Values under $1  → 2 decimal places:  "$0.53"
    - Values $1 and above → 0 decimals with comma separators: "$1,584"
    Examples: 1584.5 → "$1,585" | 0.53 → "$0.53" | -0.001 → "$0"
    """
    safe = 0.0 if (n < 0 and round(n) == 0) else n
    if abs(safe) < 1:
        return f"${safe:.2f}"
    return f"${safe:,.0f}"


def _pct_change(current: float, previous: float) -> tuple[str, str]:
    """
    Calculates month-over-month % change and trend direction.
    Matches TS pctChange() exactly.

    - If previous == 0 → returns ("N/A", "neutral") — avoids division by zero
    - delta = (current - previous) / previous * 100
    - trend: "neutral" if |delta| < 1% (noise floor), "up" if positive, "down" if negative
      The 1% floor prevents trivial fluctuations from showing as up/down arrows.
    - Returns a signed string like "+12%" or "-5%"

    Examples:
      (13, 9)  → ("+44%", "up")
      (9, 13)  → ("-31%", "down")
      (10, 10) → ("+0%", "neutral")
      (5, 0)   → ("N/A", "neutral")
    """
    if previous == 0:
        return "N/A", "neutral"
    delta = (current - previous) / previous * 100
    trend = "neutral" if abs(delta) < 1 else ("up" if delta > 0 else "down")
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta:.0f}%", trend


def _build_drilldown(
    current_map: dict[str, float],
    prev_map: dict[str, float],
    total_spend: float,
    top_n: int | None = None,
) -> list[CostDriver]:
    """
    Converts a {name: amount} spend dict into a ranked list of CostDriver objects.
    Matches TS buildDrilldown() exactly.

    Steps:
    1. Sort entries by amount DESC (highest spend first)
    2. Optionally slice to top_n (used for SKUs — top 20 only, to avoid noise)
    3. For each entry, call _pct_change(amount, prev_map.get(name, 0)) for MoM change.
       prev_map.get(name, 0) returns 0 if the service didn't exist last month → "N/A"
    4. Calculate percentage = round(amount / total_spend * 100) as an integer (e.g. 35)
       Guards against division by zero when total_spend == 0
    5. Return CostDriver objects with name, amount, percentage, trend, change

    Used three times in aggregate():
      - by_service: all services ranked by spend
      - by_project: all projects ranked by spend
      - by_sku: top 20 SKUs only
    """
    items = sorted(current_map.items(), key=lambda x: x[1], reverse=True)
    if top_n:
        items = items[:top_n]

    return [
        CostDriver(
            name=name,
            amount=amount,
            percentage=float(round((amount / total_spend * 100)) if total_spend > 0 else 0),
            trend=trend,
            change=pct,
        )
        for name, amount in items
        for pct, trend in [_pct_change(amount, prev_map.get(name, 0))]
    ]


# ── aggregate() ───────────────────────────────────────────────────────────

def aggregate(rows: list[ServiceCostRow]) -> AggregatedDashboard:

    # ── Step 1 — Derive period from data ──────────────────────────────────
    # Build a deduplicated, sorted set of all YYYYMM strings present in the rows.
    # Example: ["202508", "202509"] — latest = current period, second latest = previous.
    # If no months exist at all → return an empty dashboard immediately (safe fallback).
    all_months = sorted({r.invoice_month for r in rows if r.invoice_month})

    if not all_months:
        # Matches TS empty-state return exactly
        return AggregatedDashboard(
            statistics=[],
            charts=[],
            byService=[],
            byProject=[],
            bySku=[],
            summary=FinancialSummary(
                period="—", daysElapsed=0, daysInMonth=0, daysRemaining=0
            ),
        )

    current_yyyymm = all_months[-1]                                          # most recent month in data
    prev_yyyymm    = all_months[-2] if len(all_months) >= 2 else None        # second most recent, or None

    # ── Step 1.5 — Day math ───────────────────────────────────────────────
    # Parse year and month from the current period string, then get total days.
    # Compare the data's latest month to today's actual calendar month:
    #   - Match  (data IS the current month) → elapsed = today's date (partial month, e.g. day 21)
    #   - No match (data is a past month)    → elapsed = total_days (treat as complete month)
    # remaining = days left in the month, used in the sidebar "This Month" card.
    year  = int(current_yyyymm[:4])
    month = int(current_yyyymm[4:6])
    total_days = _days_in_month(year, month)

    now = datetime.now()
    today_yyyymm = f"{now.year}{now.month:02d}"
    elapsed   = now.day if current_yyyymm == today_yyyymm else total_days
    remaining = total_days - elapsed

    # ── Step 2 — Split rows by month ──────────────────────────────────────
    # Separate all rows into two buckets for independent aggregation.
    # current_rows = rows for the latest month (MTD spend source)
    # prev_rows    = rows for the previous month (MoM comparison source)
    current_rows = [r for r in rows if r.invoice_month == current_yyyymm]
    prev_rows    = [r for r in rows if r.invoice_month == prev_yyyymm] if prev_yyyymm else []

    # ── Step 3 — Financial totals ─────────────────────────────────────────
    # mtd_spend:        sum of effective_cost for all current-month rows
    # prev_spend:       sum of effective_cost for all previous-month rows (full month)
    # daily_burn_rate:  average daily spend = mtd / elapsed days (0 if elapsed == 0)
    # projected:        linear extrapolation to end of month = daily_rate × total_days
    # mom_pct/trend:    month-over-month % change and direction via _pct_change()
    mtd_spend        = sum(r.effective_cost for r in current_rows)
    prev_spend       = sum(r.effective_cost for r in prev_rows)
    daily_burn_rate  = mtd_spend / elapsed if elapsed > 0 else 0.0
    projected        = daily_burn_rate * total_days
    mom_pct, mom_trend = _pct_change(mtd_spend, prev_spend)

    # ── Step 4 — Statistics: 4 stat cards ────────────────────────────────
    # Each card has: label, value, change (MoM context string), trend, description.
    # change field falls back gracefully when no prior data exists.
    #
    # Card 1 — MTD Spend
    #   value:       total spend so far this month  e.g. "$13"
    #   change:      MoM % vs last month            e.g. "+40% vs. last month"
    #                fallback: "No prior month data" when prev_spend == 0
    #   trend:       derived from MoM direction (up/down/neutral)
    #   description: period label + days elapsed    e.g. "Sep 2025 — 30 of 30 days"
    #
    # Card 2 — Daily Burn Rate
    #   value:       avg daily spend                e.g. "$0/day"
    #   change:      projected 30-day cost          e.g. "$0 projected 30-day"
    #   trend:       always "neutral" — burn rate has no inherent good/bad direction
    #   description: how many days the avg is based on
    #
    # Card 3 — Projected Monthly
    #   value:       daily_rate × total_days        e.g. "$19"
    #   change:      MoM % vs previous period       e.g. "+40% vs. Aug 2025"
    #                fallback: "No comparison" when no prior data
    #   trend:       same as Card 1 (shared mom_trend)
    #   description: clarifies this is an extrapolation
    #
    # Card 4 — Previous Month Spend
    #   label:       dynamic e.g. "Aug 2025 Spend" — falls back to "Previous Month"
    #   value:       actual full-month spend        e.g. "$9"
    #                fallback: "—" when only one month of data exists
    #   trend:       always "neutral" — historical fact, no direction implied
    statistics = [
        FinancialMetric(
            label="MTD Spend",
            value=_fmt(mtd_spend),
            change=f"{mom_pct} vs. last month" if prev_spend > 0 else "No prior month data",
            trend=mom_trend,
            description=f"{_long_period(current_yyyymm)} — {elapsed} of {total_days} days",
        ),
        FinancialMetric(
            label="Daily Burn Rate",
            value=f"{_fmt(daily_burn_rate)}/day",
            change=f"{_fmt(daily_burn_rate * 30)} projected 30-day",
            trend="neutral",
            description=f"Avg over {elapsed} days",
        ),
        FinancialMetric(
            label="Projected Monthly",
            value=_fmt(projected),
            change=(
                f"{mom_pct} vs. {_long_period(prev_yyyymm)}"
                if prev_spend > 0 and prev_yyyymm
                else "No comparison"
            ),
            trend=mom_trend,
            description=f"Based on {elapsed}-day avg burn rate",
        ),
        FinancialMetric(
            label=f"{_long_period(prev_yyyymm)} Spend" if prev_yyyymm else "Previous Month",
            value=_fmt(prev_spend) if prev_spend > 0 else "—",
            change=_long_period(prev_yyyymm) if prev_spend > 0 and prev_yyyymm else "No data",
            trend="neutral",
            description="Prior period actual spend" if prev_spend > 0 else "No prior month data available",
        ),
    ]

    # ── Step 5 — Summary ──────────────────────────────────────────────────
    # Simple period metadata consumed by DashboardSidebar "This Month" card.
    # period:        human-readable label  e.g. "Sep 2025"
    # daysElapsed:   days used so far      e.g. 30
    # daysInMonth:   total days in period  e.g. 30
    # daysRemaining: days left             e.g. 0
    summary = FinancialSummary(
        period=_long_period(current_yyyymm),
        daysElapsed=elapsed,
        daysInMonth=total_days,
        daysRemaining=remaining,
    )

    # ── Step 6 — Dimension maps ───────────────────────────────────────────
    # Loop through current_rows and prev_rows separately, accumulating costs
    # into defaultdict(float) accumulators — one set for current, one for previous.
    #
    # Three dimensions tracked:
    #   service_map:  keyed by row.service_description  e.g. "Cloud Storage"
    #   project_map:  keyed by row.project_name or row.project_id  e.g. "DF-SANDBOX"
    #   sku_map:      keyed by row.sku_description  e.g. "Standard Storage US"
    #
    # Falls back to "Unknown" if a field is missing/None.
    # prev_* maps are used by _build_drilldown() for MoM % change per dimension entry.
    #
    # Then calls _build_drilldown() three times to produce ranked CostDriver lists:
    #   by_service: all services sorted by spend DESC
    #   by_project: all projects sorted by spend DESC
    #   by_sku:     top 20 SKUs only (top_n=20) — avoids long-tail noise
    service_map: dict[str, float] = defaultdict(float)
    project_map: dict[str, float] = defaultdict(float)
    sku_map:     dict[str, float] = defaultdict(float)
    prev_service_map: dict[str, float] = defaultdict(float)
    prev_project_map: dict[str, float] = defaultdict(float)
    prev_sku_map:     dict[str, float] = defaultdict(float)

    for row in current_rows:
        svc  = row.service_description or "Unknown"
        proj = row.project_name or row.project_id or "Unknown"
        sku  = row.sku_description or "Unknown"
        service_map[svc]  += row.effective_cost
        project_map[proj] += row.effective_cost
        sku_map[sku]      += row.effective_cost

    for row in prev_rows:
        svc  = row.service_description or "Unknown"
        proj = row.project_name or row.project_id or "Unknown"
        sku  = row.sku_description or "Unknown"
        prev_service_map[svc]  += row.effective_cost
        prev_project_map[proj] += row.effective_cost
        prev_sku_map[sku]      += row.effective_cost

    by_service = _build_drilldown(service_map, prev_service_map, mtd_spend)
    by_project = _build_drilldown(project_map, prev_project_map, mtd_spend)
    by_sku     = _build_drilldown(sku_map, prev_sku_map, mtd_spend, top_n=20)

    # ── Step 7 — Charts: full year, zero-filled ───────────────────────────
    # Builds a monthly total map from ALL rows (not just current month),
    # then generates exactly 12 ChartDataPoint entries — one per month of the
    # current year (Jan → Dec), regardless of whether data exists for that month.
    #
    # Months with no rows get expenses=0 via .get(..., 0) — zero-fill ensures
    # the chart always has a complete 12-month X-axis even with sparse data.
    #
    # expenses is rounded to the nearest integer (no cents on a bar chart).
    # chart_year is derived from current_yyyymm so it always matches the data year.
    monthly_map: dict[str, float] = defaultdict(float)
    for row in rows:
        if row.invoice_month:
            monthly_map[row.invoice_month] += row.effective_cost

    chart_year = current_yyyymm[:4]
    charts = [
        ChartDataPoint(
            month=_short_month(f"{chart_year}{str(i + 1).zfill(2)}"),
            expenses=round(monthly_map.get(f"{chart_year}{str(i + 1).zfill(2)}", 0)),
        )
        for i in range(12)
    ]

    return AggregatedDashboard(
        statistics=statistics,
        charts=charts,
        byService=by_service,
        byProject=by_project,
        bySku=by_sku,
        summary=summary,
    )
