"""
Redis cache service for backend API responses.
Provides caching for fixtures, match details, and live matches to reduce SportMonks API calls.
"""
import json
import logging
from typing import Optional, Any
import redis
import os
from functools import wraps
from datetime import timedelta

logger = logging.getLogger(__name__)

# Redis connection pool (singleton)
_redis_client: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    """Get or create Redis client (singleton pattern)."""
    global _redis_client
    
    if _redis_client is not None:
        return _redis_client
    
    try:
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", "6379"))
        redis_db = int(os.getenv("REDIS_DB", "0"))
        redis_password = os.getenv("REDIS_PASSWORD", None)
        
        _redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            password=redis_password,
            decode_responses=True,  # Automatically decode responses to strings
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True
        )
        
        # Test connection
        _redis_client.ping()
        logger.info(f"Redis connected successfully to {redis_host}:{redis_port}")
        return _redis_client
    except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
        logger.warning(f"Redis connection failed: {e}. Cache will be disabled.")
        _redis_client = None
        return None


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from prefix and arguments."""
    key_parts = [prefix]
    key_parts.extend(str(arg) for arg in args if arg is not None)
    key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()) if v is not None)
    return ":".join(key_parts)


async def get_cached(key: str) -> Optional[Any]:
    """Get value from cache."""
    client = get_redis_client()
    if not client:
        return None
    
    try:
        value = client.get(key)
        if value:
            return json.loads(value)
    except (redis.RedisError, json.JSONDecodeError) as e:
        logger.warning(f"Cache get error for key {key}: {e}")
    
    return None


async def set_cached(key: str, value: Any, ttl_seconds: int) -> bool:
    """Set value in cache with TTL."""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        serialized = json.dumps(value, default=str)  # default=str handles datetime objects
        client.setex(key, ttl_seconds, serialized)
        return True
    except (redis.RedisError, TypeError) as e:
        logger.warning(f"Cache set error for key {key}: {e}")
        return False


async def delete_cached(key: str) -> bool:
    """Delete value from cache."""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.delete(key)
        return True
    except redis.RedisError as e:
        logger.warning(f"Cache delete error for key {key}: {e}")
        return False


def cached(ttl_seconds: int, key_prefix: str = None):
    """
    Decorator to cache async function results.
    
    Args:
        ttl_seconds: Time to live in seconds
        key_prefix: Optional prefix for cache key (defaults to function name)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            prefix = key_prefix or f"{func.__module__}.{func.__name__}"
            cache_key_str = cache_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_value = await get_cached(cache_key_str)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {cache_key_str}")
                return cached_value
            
            # Cache miss - call function
            logger.debug(f"Cache MISS: {cache_key_str}")
            result = await func(*args, **kwargs)
            
            # Store in cache
            await set_cached(cache_key_str, result, ttl_seconds)
            
            return result
        return wrapper
    return decorator



