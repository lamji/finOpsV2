import json
import logging
from typing import Any, Optional

import redis as redis_lib

from app.config import settings

logger = logging.getLogger(__name__)

TTL_DEFAULT = 300   # 5 min
TTL_HEAVY = 1800    # 30 min

_client: Optional[redis_lib.Redis] = None


def _get_client() -> Optional[redis_lib.Redis]:
    global _client
    if _client is not None:
        return _client
    if not settings.REDIS_URL:
        return None
    try:
        _client = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
        _client.ping()
        return _client
    except Exception as e:
        logger.warning(f"Redis unavailable — caching disabled: {e}")
        return None


def cache_get(key: str) -> Optional[Any]:
    client = _get_client()
    if not client:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning(f"Redis GET failed: {e}")
        return None


def cache_set(key: str, value: Any, ttl: int = TTL_DEFAULT) -> None:
    client = _get_client()
    if not client or ttl == 0:
        return
    try:
        client.set(key, json.dumps(value), ex=ttl)
    except Exception as e:
        logger.warning(f"Redis SET failed: {e}")
