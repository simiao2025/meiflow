import os
import json
import redis.asyncio as redis
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def get_cached(key: str) -> Optional[Any]:
    """Recupera um valor do cache Redis."""
    try:
        data = await redis_client.get(key)
        return json.loads(data) if data else None
    except Exception:
        return None

async def set_cache(key: str, value: Any, expire: int = 300):
    """Armazena um valor no cache Redis com tempo de expiração (default 5 min)."""
    try:
        await redis_client.set(key, json.dumps(value), ex=expire)
    except Exception:
        pass

async def delete_cache(key: str):
    """Remove uma chave do cache."""
    try:
        await redis_client.delete(key)
    except Exception:
        pass
