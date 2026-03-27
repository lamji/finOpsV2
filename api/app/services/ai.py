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

    # ── Step 1 — Guard: check API key ─────────────────────────────────────
    # If ANTHROPIC_API_KEY is not set, return [] immediately.
    # Avoids an AuthenticationError at runtime and makes the feature optional
    # (dashboard works without Anthropic configured).
    if not settings.ANTHROPIC_API_KEY:
        return []

    try:
        # ── Step 2 — Init Anthropic client ────────────────────────────────
        # Creates an Anthropic SDK client scoped to the API key from settings.
        # Instantiated per-call (not a singleton) — stateless and safe for
        # concurrent requests.
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        # ── Step 3 — Extract key metrics from statistics[] ────────────────
        # Builds a {label: FinancialMetric} lookup dict from aggregated.statistics,
        # then pulls the 4 stat cards by label:
        #   - "MTD Spend"         → current month total + MoM change
        #   - "Daily Burn Rate"   → avg daily spend
        #   - "Projected Monthly" → linear extrapolation to end of month
        #   - previous month card → found by scanning for any label containing
        #                           "Spend" that is not "MTD Spend"
        #                           (dynamic label e.g. "Aug 2025 Spend")
        # Any card may be None if statistics[] is empty — all usages below guard
        # with `mtd.value if mtd else "N/A"` to avoid AttributeError.
        stats = {s.label: s for s in aggregated.statistics}
        mtd       = stats.get("MTD Spend")
        burn_rate = stats.get("Daily Burn Rate")
        projected = stats.get("Projected Monthly")
        prev      = stats.get(next((k for k in stats if "Spend" in k and k != "MTD Spend"), ""), None)
        summary   = aggregated.summary

        # ── Step 4 — fmt() helper ─────────────────────────────────────────
        # Inline formatter that converts a list of CostDriver objects into a
        # human-readable bullet string for the prompt.
        # Used three times: byService, byProject, bySku[:10] (top 10 SKUs only —
        # sliced to avoid token waste on long-tail items).
        # Example output line: "  Cloud Storage: $9 (69%, +44% MoM)"
        def fmt(items: list) -> str:
            return "\n".join(
                f"  {d.name}: ${d.amount} ({d.percentage}%, {d.change} MoM)"
                for d in items
            )

        # ── Step 5 — Build prompt ─────────────────────────────────────────
        # Injects the full spend snapshot into a structured prompt.
        # Output instructions tell the model to return ONLY a raw JSON array —
        # "no markdown, no explanation" prevents ```json fences or preamble text.
        # Type rules injected:
        #   "warning"  → budget risks or cost spikes
        #   "info"     → anomalies or trends worth watching
        #   "success"  → cost reductions or positive patterns
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

        # ── Step 6 — Call Anthropic API ───────────────────────────────────
        # model:      "claude-haiku-4-5" — fast, cheap, sufficient for structured JSON
        # max_tokens: 1024 — enough for 3–5 alerts, prevents runaway output
        # messages:   single user turn with the full prompt
        # Returns a Message object with content: list[ContentBlock].
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        # ── Step 7 — Extract text from first content block ────────────────
        # Guards with `if response.content else ""` in case the model returns
        # an empty response (shouldn't happen but safe to handle).
        raw = response.content[0].text if response.content else ""

        # ── Step 8 — Strip markdown fences if present ─────────────────────
        # Even with "no markdown" in the prompt, models occasionally wrap output
        # in ```json ... ``` fences. Strip both opening and closing fences.
        # Matches the same strip logic in the TS generateInsights().
        text = raw.replace("```json", "").replace("```", "").strip()

        # ── Step 9 — Parse JSON and map to Alert models ───────────────────
        # json.loads() parses the cleaned string into a Python list.
        # Each dict item is mapped to an Alert Pydantic model via Alert(**item).
        # If result is not a list (unexpected shape), returns [] safely.
        parsed = json.loads(text)
        return [Alert(**item) for item in parsed] if isinstance(parsed, list) else []

    except Exception as e:
        # ── Step 10 — Non-fatal error path ────────────────────────────────
        # Catches any exception: network failure, AuthenticationError,
        # JSONDecodeError, or ValidationError from Alert(**item).
        # Logs and returns [] — dashboard renders without the insights panel
        # rather than returning a 500 to the client.
        logger.error(f"generateInsights failed: {e}")
        return []
