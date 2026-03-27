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
    return MONTH_NAMES.get(yyyymm[4:6], yyyymm[4:6])


def _long_period(yyyymm: str) -> str:
    return f"{MONTH_NAMES.get(yyyymm[4:6], yyyymm[4:6])} {yyyymm[:4]}"


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _fmt(n: float) -> str:
    """
    Matches TS Intl.NumberFormat USD:
    - Tiny negatives near zero (e.g. -0.001) → $0  (avoids "-$0")
    - < $1  → 2 decimal places  ($0.53)
    - >= $1 → 0 decimal places with comma  ($1,584)
    """
    safe = 0.0 if (n < 0 and round(n) == 0) else n
    if abs(safe) < 1:
        return f"${safe:.2f}"
    return f"${safe:,.0f}"


def _pct_change(current: float, previous: float) -> tuple[str, str]:
    """Returns (pct_string, trend) — matches TS pctChange()"""
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
    Matches TS buildDrilldown():
    - sorted DESC by amount
    - percentage: Math.round → integer
    - change: just the pct string ("+12%" or "N/A")  ← matches TS `change: pct`
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

    # Step 1 — derive period from data
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

    current_yyyymm = all_months[-1]
    prev_yyyymm = all_months[-2] if len(all_months) >= 2 else None

    # Step 1.5 — day math
    year  = int(current_yyyymm[:4])
    month = int(current_yyyymm[4:6])
    total_days = _days_in_month(year, month)

    now = datetime.now()
    today_yyyymm = f"{now.year}{now.month:02d}"
    elapsed   = now.day if current_yyyymm == today_yyyymm else total_days
    remaining = total_days - elapsed

    # Step 2 — split rows
    current_rows = [r for r in rows if r.invoice_month == current_yyyymm]
    prev_rows    = [r for r in rows if r.invoice_month == prev_yyyymm] if prev_yyyymm else []

    # Step 3 — totals
    mtd_spend        = sum(r.effective_cost for r in current_rows)
    prev_spend       = sum(r.effective_cost for r in prev_rows)
    daily_burn_rate  = mtd_spend / elapsed if elapsed > 0 else 0.0
    projected        = daily_burn_rate * total_days
    mom_pct, mom_trend = _pct_change(mtd_spend, prev_spend)

    # Step 4 — statistics (matches TS statistics[] exactly)
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

    # Step 5 — summary
    summary = FinancialSummary(
        period=_long_period(current_yyyymm),
        daysElapsed=elapsed,
        daysInMonth=total_days,
        daysRemaining=remaining,
    )

    # Step 6 — dimension maps (byService, byProject, bySku — no category/drilldown)
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

    # Step 7 — charts: ALL 12 months of current year, zero-fill missing
    # Matches TS: Array.from({ length: 12 }, ...) with monthlyMap.get(yyyymm) ?? 0
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
