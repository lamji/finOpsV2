import hashlib
import json
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

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

    # ── Redis cache check ─────────────────────────────────────────────────
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
        byService=aggregated.byService,
        byProject=aggregated.byProject,
        bySku=aggregated.bySku,
        aiInsights=insights,
        summary=aggregated.summary,
    )

    # ── Write to cache (only on success, matches TS: only cache HTTP 200) ─
    cache.cache_set(key, json.loads(payload.model_dump_json()), cache.TTL_DEFAULT)
    logger.info("Dashboard fetched from BigQuery and cached")

    return payload


@router.delete("/dashboard")
async def flush_cache() -> JSONResponse:
    """Flush entire Redis cache — matches TS DELETE /api/bigquery"""
    try:
        client = cache._get_client()
        if client:
            client.flushall()
        return JSONResponse({"status": 200, "message": "Redis cache flushed"})
    except Exception as e:
        logger.error(f"Redis flush failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _run_insights(aggregated):
    """Run blocking Anthropic call in thread pool — keeps event loop free."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, ai.generate_insights, aggregated)
