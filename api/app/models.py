from typing import Literal, Optional
from pydantic import BaseModel


class FinancialMetric(BaseModel):
    label: str
    value: str
    change: str
    trend: Literal["up", "down", "neutral"]
    description: str


class CostDriver(BaseModel):
    name: str
    amount: float
    percentage: float
    trend: Literal["up", "down", "neutral"]
    change: str


class ChartDataPoint(BaseModel):
    month: str
    expenses: float
    budget: Optional[float] = None


class Alert(BaseModel):
    id: str
    type: Literal["warning", "info", "success"]
    title: str
    message: str


class FinancialSummary(BaseModel):
    period: str
    daysElapsed: int
    daysInMonth: int
    daysRemaining: int


class ServiceCostRow(BaseModel):
    invoice_month: str
    service_description: str
    project_name: Optional[str] = None
    project_id: Optional[str] = None
    sku_description: Optional[str] = None
    effective_cost: float


class AggregatedDashboard(BaseModel):
    statistics: list[FinancialMetric]
    charts: list[ChartDataPoint]
    drilldown: list[CostDriver]
    byService: list[CostDriver]
    byProject: list[CostDriver]
    bySku: list[CostDriver]
    summary: Optional[FinancialSummary] = None


class DashboardResponse(BaseModel):
    status: int
    source: Literal["cached", "db"]
    statistics: list[FinancialMetric]
    charts: list[ChartDataPoint]
    drilldown: list[CostDriver]
    byService: list[CostDriver]
    byProject: list[CostDriver]
    bySku: list[CostDriver]
    aiInsights: list[Alert]
    summary: Optional[FinancialSummary] = None
