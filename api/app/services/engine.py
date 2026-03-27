"""
FinOps Engine — Python port of lib/finops-engine.ts
aggregate(rows) → AggregatedDashboard
"""

import calendar
from collections import defaultdict
from datetime import datetime
from typing import Optional

from app.models import (
    AggregatedDashboard,
    ChartDataPoint,
    CostDriver,
    FinancialMetric,
    FinancialSummary,
    ServiceCostRow,
)

# ── Service → Category map ────────────────────────────────────────────────

SERVICE_CATEGORY_MAP: dict[str, str] = {
    # Compute
    "Compute Engine": "Compute",
    "Google Kubernetes Engine": "Compute",
    "Cloud Run": "Compute",
    "App Engine": "Compute",
    "Cloud Functions": "Compute",
    "Bare Metal Solution": "Compute",
    "VMware Engine": "Compute",
    # Storage
    "Cloud Storage": "Storage",
    "Cloud SQL": "Storage",
    "Cloud Bigtable": "Storage",
    "Cloud Spanner": "Storage",
    "Filestore": "Storage",
    "Persistent Disk": "Storage",
    "Cloud Firestore": "Storage",
    # Network
    "Networking": "Network & Data Transfer",
    "Cloud CDN": "Network & Data Transfer",
    "Cloud DNS": "Network & Data Transfer",
    "Cloud Interconnect": "Network & Data Transfer",
    "Cloud VPN": "Network & Data Transfer",
    "Network Connectivity": "Network & Data Transfer",
    # Third-party Services
    "Cloud Key Management Service (KMS)": "Third-party Services",
    "Pub/Sub": "Third-party Services",
    "BigQuery": "Third-party Services",
    "Cloud Monitoring": "Third-party Services",
    "Cloud Logging": "Third-party Services",
    "Secret Manager": "Third-party Services",
    "Cloud Build": "Third-party Services",
    "Artifact Registry": "Third-party Services",
}

MONTH_NAMES = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}


# ── Helpers ───────────────────────────────────────────────────────────────

def _categorise(service: str) -> str:
    return SERVICE_CATEGORY_MAP.get(service, "Other")


def _short_month(yyyymm: str) -> str:
    return MONTH_NAMES.get(yyyymm[4:6], yyyymm)


def _long_period(yyyymm: str) -> str:
    month = MONTH_NAMES.get(yyyymm[4:6], yyyymm[4:6])
    year = yyyymm[:4]
    return f"{month} {year}"


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _fmt(n: float) -> str:
    if n < 1:
        return f"${n:.2f}"
    return f"${n:,.0f}"


def _pct_change(current: float, previous: float) -> tuple[str, str]:
    if previous == 0:
        return "N/A", "neutral"
    delta = (current - previous) / previous * 100
    if abs(delta) < 1:
        trend = "neutral"
    elif delta > 0:
        trend = "up"
    else:
        trend = "down"
    sign = "+" if delta > 0 else ""
    return f"{sign}{delta:.0f}%", trend


def _build_drilldown(
    current_map: dict[str, float],
    prev_map: dict[str, float],
    total_spend: float,
    top_n: Optional[int] = None,
) -> list[CostDriver]:
    sorted_items = sorted(current_map.items(), key=lambda x: x[1], reverse=True)
    if top_n:
        sorted_items = sorted_items[:top_n]

    drivers = []
    for name, amount in sorted_items:
        prev_amount = prev_map.get(name, 0)
        pct_str, trend = _pct_change(amount, prev_amount)
        percentage = (amount / total_spend * 100) if total_spend > 0 else 0

        change = (
            f"{pct_str} vs last month"
            if pct_str != "N/A"
            else "No prior month data"
        )

        drivers.append(
            CostDriver(
                name=name,
                amount=round(amount, 4),
                percentage=round(percentage, 1),
                trend=trend,
                change=change,
            )
        )
    return drivers


# ── Main aggregate function ───────────────────────────────────────────────

def aggregate(rows: list[ServiceCostRow]) -> AggregatedDashboard:
    # ── Step 1: Derive available periods ─────────────────────────────────
    all_months = sorted({r.invoice_month for r in rows if r.invoice_month})

    if not all_months:
        return AggregatedDashboard(
            statistics=[],
            charts=[],
            drilldown=[],
            byService=[],
            byProject=[],
            bySku=[],
            summary=None,
        )

    current_yyyymm = all_months[-1]
    prev_yyyymm = all_months[-2] if len(all_months) >= 2 else None

    # ── Step 1.5: Period day math ─────────────────────────────────────────
    year = int(current_yyyymm[:4])
    month = int(current_yyyymm[4:6])
    total_days = _days_in_month(year, month)

    now = datetime.now()
    today_yyyymm = f"{now.year}{now.month:02d}"
    elapsed = now.day if current_yyyymm == today_yyyymm else total_days
    remaining = total_days - elapsed

    # ── Step 2: Split rows by month ───────────────────────────────────────
    current_rows = [r for r in rows if r.invoice_month == current_yyyymm]
    prev_rows = [r for r in rows if r.invoice_month == prev_yyyymm] if prev_yyyymm else []

    # ── Step 3: Compute financial totals ─────────────────────────────────
    mtd_spend = sum(r.effective_cost for r in current_rows)
    prev_spend = sum(r.effective_cost for r in prev_rows)
    daily_burn_rate = mtd_spend / elapsed if elapsed > 0 else 0
    projected_monthly = daily_burn_rate * total_days
    mom_pct, mom_trend = _pct_change(mtd_spend, prev_spend)

    # ── Step 4: Build statistics ──────────────────────────────────────────
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
            value=_fmt(projected_monthly),
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

    # ── Step 5: Build summary ─────────────────────────────────────────────
    summary = FinancialSummary(
        period=_long_period(current_yyyymm),
        daysElapsed=elapsed,
        daysInMonth=total_days,
        daysRemaining=remaining,
    )

    # ── Step 6: Build dimension maps ──────────────────────────────────────
    category_map: dict[str, float] = defaultdict(float)
    service_map: dict[str, float] = defaultdict(float)
    project_map: dict[str, float] = defaultdict(float)
    sku_map: dict[str, float] = defaultdict(float)

    prev_category_map: dict[str, float] = defaultdict(float)
    prev_service_map: dict[str, float] = defaultdict(float)
    prev_project_map: dict[str, float] = defaultdict(float)
    prev_sku_map: dict[str, float] = defaultdict(float)

    for row in current_rows:
        cat = _categorise(row.service_description)
        category_map[cat] += row.effective_cost
        service_map[row.service_description] += row.effective_cost
        project_key = row.project_name or row.project_id or "Unknown"
        project_map[project_key] += row.effective_cost
        if row.sku_description:
            sku_map[row.sku_description] += row.effective_cost

    for row in prev_rows:
        cat = _categorise(row.service_description)
        prev_category_map[cat] += row.effective_cost
        prev_service_map[row.service_description] += row.effective_cost
        project_key = row.project_name or row.project_id or "Unknown"
        prev_project_map[project_key] += row.effective_cost
        if row.sku_description:
            prev_sku_map[row.sku_description] += row.effective_cost

    # ── Step 6.5: Build ranked drilldown arrays ───────────────────────────
    drilldown = _build_drilldown(category_map, prev_category_map, mtd_spend)
    by_service = _build_drilldown(service_map, prev_service_map, mtd_spend)
    by_project = _build_drilldown(project_map, prev_project_map, mtd_spend)
    by_sku = _build_drilldown(sku_map, prev_sku_map, mtd_spend, top_n=20)

    # ── Step 7: Build charts — last 12 months ────────────────────────────
    monthly_map: dict[str, float] = defaultdict(float)
    for row in rows:
        monthly_map[row.invoice_month] += row.effective_cost

    sorted_months = sorted(monthly_map.keys())[-12:]
    charts = [
        ChartDataPoint(
            month=_short_month(yyyymm),
            expenses=round(monthly_map[yyyymm]),
        )
        for yyyymm in sorted_months
    ]

    # ── Step 8: Return ────────────────────────────────────────────────────
    return AggregatedDashboard(
        statistics=statistics,
        charts=charts,
        drilldown=drilldown,
        byService=by_service,
        byProject=by_project,
        bySku=by_sku,
        summary=summary,
    )
