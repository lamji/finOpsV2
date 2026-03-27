import hashlib
import json
import logging

from fastapi import APIRouter, HTTPException, Query

from app.models import DashboardResponse
from app.services import ai, bigquery, cache, engine

logger = logging.getLogger(__name__)
router = APIRouter()


def _cache_key(project_id: str) -> str:
    raw = f"dashboard:{project_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    no_cache: bool = Query(False, alias="noCache"),
) -> DashboardResponse:
    from app.config import settings

    project_id = settings.GCP_PROJECT_ID
    key = _cache_key(project_id)

    # ── Cache check ───────────────────────────────────────────────────────
    if not no_cache:
        cached = cache.cache_get(key)
        if cached:
            logger.info("Dashboard served from cache")
            cached["source"] = "cached"
            return DashboardResponse(**cached)

    # ── Fetch from BigQuery ───────────────────────────────────────────────
    try:
        rows = bigquery.fetch_rows()
    except Exception as e:
        logger.error(f"BigQuery fetch failed: {e}")
        raise HTTPException(status_code=503, detail=f"BigQuery unavailable: {e}")

    if not rows:
        raise HTTPException(status_code=204, detail="No billing data found")

    # ── Aggregate ─────────────────────────────────────────────────────────
    aggregated = engine.aggregate(rows)

    # ── AI insights ───────────────────────────────────────────────────────
    insights = await _run_insights(aggregated)

    # ── Build response ────────────────────────────────────────────────────
    payload = DashboardResponse(
        status=200,
        source="db",
        statistics=aggregated.statistics,
        charts=aggregated.charts,
        drilldown=aggregated.drilldown,
        byService=aggregated.byService,
        byProject=aggregated.byProject,
        bySku=aggregated.bySku,
        aiInsights=insights,
        summary=aggregated.summary,
    )

    # ── Write to cache ────────────────────────────────────────────────────
    cache.cache_set(key, json.loads(payload.model_dump_json()), cache.TTL_DEFAULT)
    logger.info("Dashboard fetched from BigQuery and cached")

    return payload


async def _run_insights(aggregated):
    """Run AI insights in a thread pool to avoid blocking the event loop."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, ai.generate_insights, aggregated)
