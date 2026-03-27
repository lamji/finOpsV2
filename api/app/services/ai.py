"""
AI insights — Python port of generateInsights() in lib/finops-engine.ts
Uses byService / byProject / bySku — no drilldown (matches TS exactly).
"""

import json
import logging

import anthropic

from app.config import settings
from app.models import AggregatedDashboard, Alert

logger = logging.getLogger(__name__)


def generate_insights(aggregated: AggregatedDashboard) -> list[Alert]:
    if not settings.ANTHROPIC_API_KEY:
        return []

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        stats = {s.label: s for s in aggregated.statistics}
        mtd       = stats.get("MTD Spend")
        burn_rate = stats.get("Daily Burn Rate")
        projected = stats.get("Projected Monthly")
        prev      = stats.get(next((k for k in stats if "Spend" in k and k != "MTD Spend"), ""), None)
        summary   = aggregated.summary

        def fmt(items: list) -> str:
            return "\n".join(
                f"  {d.name}: ${d.amount} ({d.percentage}%, {d.change} MoM)"
                for d in items
            )

        prompt = f"""You are a FinOps analyst reviewing cloud spend data. Analyze this data and return actionable insights.

SPEND DATA ({summary.period if summary else "Unknown"}):
- MTD Spend: {mtd.value if mtd else "N/A"} ({mtd.change if mtd else ""})
- Daily Burn Rate: {burn_rate.value if burn_rate else "N/A"}
- Projected Monthly: {projected.value if projected else "N/A"}
- Previous Month: {prev.value if prev else "N/A"}
- Days Elapsed: {summary.daysElapsed if summary else "?"} of {summary.daysInMonth if summary else "?"}

BY SERVICE:
{fmt(aggregated.byService)}

BY PROJECT:
{fmt(aggregated.byProject)}

TOP SKUs:
{fmt(aggregated.bySku[:10])}

Return a JSON array of 3 to 5 insights. Each insight must follow this exact shape:
[
  {{
    "id": "unique-kebab-case-id",
    "type": "warning" | "info" | "success",
    "title": "Short title (max 5 words)",
    "message": "One sentence actionable insight."
  }}
]

Rules:
- "warning" for budget risks or cost spikes
- "info" for anomalies or trends worth watching
- "success" for cost reductions or positive patterns
- Be specific with numbers from the data
- Return ONLY the JSON array, no markdown, no explanation"""

        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text if response.content else ""

        # Strip markdown fences if present — matches TS strip logic
        text = raw.replace("```json", "").replace("```", "").strip()

        parsed = json.loads(text)
        return [Alert(**item) for item in parsed] if isinstance(parsed, list) else []

    except Exception as e:
        logger.error(f"generateInsights failed: {e}")
        return []
