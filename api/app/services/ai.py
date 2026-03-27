"""
AI insights — Python port of generateInsights() in lib/finops-engine.ts
Calls Anthropic claude-haiku-4-5 → Alert[]
"""

import json
import logging

import anthropic

from app.config import settings
from app.models import AggregatedDashboard, Alert

logger = logging.getLogger(__name__)


def generate_insights(aggregated: AggregatedDashboard) -> list[Alert]:
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        stats = {s.label: s for s in aggregated.statistics}
        mtd = stats.get("MTD Spend")
        burn = stats.get("Daily Burn Rate")
        projected = stats.get("Projected Monthly")
        summary = aggregated.summary

        def fmt(drivers: list) -> str:
            return "\n".join(
                f"  {d.name}: {d.amount:.2f} USD ({d.percentage:.1f}%, {d.change})"
                for d in drivers
            )

        prompt = f"""You are a FinOps analyst. Analyze the following cloud spend data and return 3-5 actionable insights as a JSON array.

## Dashboard Summary
- Period: {summary.period if summary else "Unknown"}
- Days elapsed: {summary.daysElapsed if summary else "?"} of {summary.daysInMonth if summary else "?"} days
- MTD Spend: {mtd.value if mtd else "N/A"} ({mtd.change if mtd else ""})
- Daily Burn Rate: {burn.value if burn else "N/A"}
- Projected Monthly: {projected.value if projected else "N/A"} ({projected.change if projected else ""})

## Cost by Category
{fmt(aggregated.drilldown)}

## Cost by Service
{fmt(aggregated.byService)}

## Cost by Project
{fmt(aggregated.byProject)}

## Top SKUs
{fmt(aggregated.bySku[:10])}

Return ONLY a JSON array (no markdown, no explanation):
[
  {{
    "id": "insight-1",
    "type": "warning" | "info" | "success",
    "title": "Short title",
    "message": "Actionable detail"
  }}
]

Rules:
- "warning" → budget risks, cost spikes, anomalies requiring action
- "info"    → trends worth watching, neutral observations
- "success" → cost reductions, positive patterns
"""

        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text if response.content else ""
        # Strip markdown fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            text = text.rsplit("```", 1)[0].strip()

        parsed = json.loads(text)
        return [Alert(**item) for item in parsed] if isinstance(parsed, list) else []

    except Exception as e:
        logger.error(f"generateInsights failed: {e}")
        return []
