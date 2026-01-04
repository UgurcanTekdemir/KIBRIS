"""
Entity-based Rate Limit Manager for SportMonks API
Implements token bucket algorithm with entity-specific tracking
"""
import asyncio
import time
import random
import logging
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import deque

from config.rate_limit_config import (
    RATE_LIMIT_CAPACITY,
    RATE_LIMIT_WINDOW,
    DEGRADE_THRESHOLD,
    BACKOFF_CONFIG,
    OBSERVABILITY_THRESHOLDS,
)

logger = logging.getLogger(__name__)

@dataclass
class EntityRateLimitState:
    """Rate limit state for a single entity"""
    entity: str
    capacity: int = RATE_LIMIT_CAPACITY
    window_seconds: int = RATE_LIMIT_WINDOW
    
    # Token bucket state
    tokens: int = RATE_LIMIT_CAPACITY
    last_refill: float = field(default_factory=time.time)
    
    # Sliding window tracking (for accurate counting)
    request_timestamps: deque = field(default_factory=deque)
    
    # Rate limit metadata from API
    remaining: Optional[int] = None
    limit: Optional[int] = None
    reset_at: Optional[float] = None  # Unix timestamp when limit resets
    
    # Cooldown state (for 429 handling)
    cooldown_until: Optional[float] = None  # Unix timestamp
    cooldown_reason: Optional[str] = None
    
    # Degrade mode
    is_degraded: bool = False
    degraded_at: Optional[float] = None
    
    # Metrics
    total_requests: int = 0
    total_429_errors: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    
    # Recent 429 timestamps (for observability)
    recent_429_timestamps: deque = field(default_factory=deque)
    
    def __post_init__(self):
        """Initialize with current time"""
        self.last_refill = time.time()
    
    def refill_tokens(self) -> None:
        """Refill tokens based on elapsed time (token bucket algorithm)"""
        now = time.time()
        elapsed = now - self.last_refill
        
        if elapsed > 0:
            # Calculate tokens to add (proportional to elapsed time)
            tokens_to_add = int((elapsed / self.window_seconds) * self.capacity)
            if tokens_to_add > 0:
                self.tokens = min(self.capacity, self.tokens + tokens_to_add)
                self.last_refill = now
    
    def consume_token(self) -> bool:
        """
        Try to consume a token.
        Returns True if token was consumed, False if rate limited.
        """
        self.refill_tokens()
        
        # Also check sliding window for accuracy
        now = time.time()
        # Remove timestamps outside the window
        cutoff = now - self.window_seconds
        while self.request_timestamps and self.request_timestamps[0] < cutoff:
            self.request_timestamps.popleft()
        
        # Check if we have capacity
        if len(self.request_timestamps) >= self.capacity:
            return False
        
        # Check token bucket
        if self.tokens <= 0:
            return False
        
        # Consume token
        self.tokens -= 1
        self.request_timestamps.append(now)
        self.total_requests += 1
        return True
    
    def update_from_response(self, remaining: Optional[int], limit: Optional[int], reset_at: Optional[float]) -> None:
        """Update state from API response metadata"""
        if remaining is not None:
            self.remaining = remaining
            # Sync token bucket with API state
            if remaining < self.tokens:
                self.tokens = max(0, remaining)
        
        if limit is not None:
            self.limit = limit
            # Adjust capacity if limit changed
            if limit != self.capacity:
                self.capacity = limit
                self.tokens = min(self.tokens, limit)
        
        if reset_at is not None:
            self.reset_at = reset_at
    
    def enter_cooldown(self, duration_seconds: float, reason: str = "429") -> None:
        """Enter cooldown period (e.g., after 429 error)"""
        self.cooldown_until = time.time() + duration_seconds
        self.cooldown_reason = reason
        logger.warning(f"Entity {self.entity} entered cooldown for {duration_seconds:.1f}s: {reason}")
    
    def is_in_cooldown(self) -> bool:
        """Check if entity is in cooldown"""
        if self.cooldown_until is None:
            return False
        if time.time() >= self.cooldown_until:
            self.cooldown_until = None
            self.cooldown_reason = None
            return False
        return True
    
    def enter_degrade_mode(self) -> None:
        """Enter degrade mode when remaining is low"""
        if not self.is_degraded:
            self.is_degraded = True
            self.degraded_at = time.time()
            logger.warning(f"Entity {self.entity} entered degrade mode (remaining: {self.remaining})")
    
    def exit_degrade_mode(self) -> None:
        """Exit degrade mode when remaining is sufficient"""
        if self.is_degraded:
            self.is_degraded = False
            logger.info(f"Entity {self.entity} exited degrade mode (remaining: {self.remaining})")
    
    def record_429(self) -> None:
        """Record a 429 error"""
        self.total_429_errors += 1
        now = time.time()
        self.recent_429_timestamps.append(now)
        # Keep only last minute of 429 timestamps
        cutoff = now - 60
        while self.recent_429_timestamps and self.recent_429_timestamps[0] < cutoff:
            self.recent_429_timestamps.popleft()
    
    def get_429_rate(self) -> int:
        """Get number of 429 errors in last minute"""
        now = time.time()
        cutoff = now - 60
        return sum(1 for ts in self.recent_429_timestamps if ts >= cutoff)
    
    def get_cache_hit_rate(self) -> float:
        """Get cache hit rate (0.0 to 1.0)"""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return self.cache_hits / total
    
    def get_metrics(self) -> Dict:
        """Get current metrics for observability"""
        now = time.time()
        requests_in_window = len(self.request_timestamps)
        
        return {
            "entity": self.entity,
            "tokens_remaining": self.tokens,
            "requests_in_window": requests_in_window,
            "capacity": self.capacity,
            "api_remaining": self.remaining,
            "api_limit": self.limit,
            "reset_at": self.reset_at,
            "reset_in_seconds": max(0, self.reset_at - now) if self.reset_at else None,
            "is_in_cooldown": self.is_in_cooldown(),
            "cooldown_until": self.cooldown_until,
            "is_degraded": self.is_degraded,
            "total_requests": self.total_requests,
            "total_429_errors": self.total_429_errors,
            "recent_429_rate": self.get_429_rate(),
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "cache_hit_rate": self.get_cache_hit_rate(),
        }


class RateLimitManager:
    """Entity-based rate limit manager"""
    
    def __init__(self):
        self._entities: Dict[str, EntityRateLimitState] = {}
        self._lock = asyncio.Lock()
        self._in_flight_requests: Dict[str, asyncio.Task] = {}  # For deduplication
    
    async def acquire(self, entity: str) -> Tuple[bool, Optional[float]]:
        """
        Try to acquire permission to make a request.
        
        Returns:
            (allowed, wait_time): (True, None) if allowed, (False, wait_seconds) if rate limited
        """
        async with self._lock:
            state = self._get_or_create_state(entity)
            
            # Check cooldown first
            if state.is_in_cooldown():
                wait_time = state.cooldown_until - time.time()
                return False, wait_time
            
            # Check if we can consume a token
            if state.consume_token():
                # Check if we should enter degrade mode
                if state.remaining is not None and state.remaining < DEGRADE_THRESHOLD:
                    state.enter_degrade_mode()
                elif state.remaining is not None and state.remaining >= DEGRADE_THRESHOLD * 2:
                    state.exit_degrade_mode()
                
                return True, None
            
            # Rate limited - calculate wait time
            if state.request_timestamps:
                oldest_ts = state.request_timestamps[0]
                wait_time = self._calculate_wait_time(oldest_ts, state.window_seconds)
            elif state.reset_at:
                wait_time = max(0, state.reset_at - time.time())
            else:
                wait_time = state.window_seconds / state.capacity
            
            return False, wait_time
    
    def _calculate_wait_time(self, oldest_ts: float, window: int) -> float:
        """Calculate wait time until oldest request expires"""
        now = time.time()
        elapsed = now - oldest_ts
        wait_time = window - elapsed + 0.1  # Small buffer
        return max(0, wait_time)
    
    def _get_or_create_state(self, entity: str) -> EntityRateLimitState:
        """Get or create rate limit state for entity"""
        if entity not in self._entities:
            self._entities[entity] = EntityRateLimitState(entity=entity)
        return self._entities[entity]
    
    def update_from_response(
        self,
        entity: str,
        remaining: Optional[int] = None,
        limit: Optional[int] = None,
        reset_at: Optional[float] = None,
        headers: Optional[Dict] = None
    ) -> None:
        """
        Update rate limit state from API response.
        Extracts metadata from headers and response body.
        """
        state = self._get_or_create_state(entity)
        
        # Parse from headers if provided
        if headers:
            # Try different header formats
            remaining_header = (
                headers.get("X-RateLimit-Remaining") or
                headers.get("x-ratelimit-remaining") or
                headers.get("RateLimit-Remaining")
            )
            limit_header = (
                headers.get("X-RateLimit-Limit") or
                headers.get("x-ratelimit-limit") or
                headers.get("RateLimit-Limit")
            )
            reset_header = (
                headers.get("X-RateLimit-Reset") or
                headers.get("x-ratelimit-reset") or
                headers.get("RateLimit-Reset")
            )
            
            if remaining_header:
                try:
                    remaining = int(remaining_header)
                except (ValueError, TypeError):
                    pass
            
            if limit_header:
                try:
                    limit = int(limit_header)
                except (ValueError, TypeError):
                    pass
            
            if reset_header:
                try:
                    # Reset can be Unix timestamp or seconds from now
                    reset_value = int(reset_header)
                    # If it's a small number (< 1000000), assume it's seconds from now
                    if reset_value < 1000000:
                        reset_at = time.time() + reset_value
                    else:
                        reset_at = reset_value
                except (ValueError, TypeError):
                    pass
        
        state.update_from_response(remaining, limit, reset_at)
    
    async def handle_429(
        self,
        entity: str,
        retry_after: Optional[int] = None,
        reset_at: Optional[float] = None
    ) -> float:
        """
        Handle 429 error for an entity.
        Returns wait time in seconds.
        """
        state = self._get_or_create_state(entity)
        state.record_429()
        
        # Calculate cooldown duration
        if retry_after:
            cooldown_duration = retry_after
        elif reset_at:
            cooldown_duration = max(1, reset_at - time.time())
        else:
            # Default exponential backoff
            backoff_attempt = min(state.total_429_errors, 10)  # Cap at 10
            cooldown_duration = min(
                BACKOFF_CONFIG["max_delay"],
                BACKOFF_CONFIG["base_delay"] * (BACKOFF_CONFIG["exponential_base"] ** backoff_attempt)
            )
        
        # Add jitter
        jitter = random.uniform(0, cooldown_duration * BACKOFF_CONFIG["jitter_max"])
        cooldown_duration += jitter
        
        state.enter_cooldown(cooldown_duration, "429")
        return cooldown_duration
    
    def record_cache_hit(self, entity: str) -> None:
        """Record a cache hit"""
        state = self._get_or_create_state(entity)
        state.cache_hits += 1
    
    def record_cache_miss(self, entity: str) -> None:
        """Record a cache miss"""
        state = self._get_or_create_state(entity)
        state.cache_misses += 1
    
    def is_degraded(self, entity: str) -> bool:
        """Check if entity is in degrade mode"""
        state = self._get_or_create_state(entity)
        return state.is_degraded
    
    async def get_in_flight_request(self, request_key: str) -> Optional[asyncio.Task]:
        """Get in-flight request for deduplication"""
        async with self._lock:
            return self._in_flight_requests.get(request_key)
    
    async def set_in_flight_request(self, request_key: str, task: asyncio.Task) -> None:
        """Set in-flight request for deduplication"""
        async with self._lock:
            self._in_flight_requests[request_key] = task
    
    async def remove_in_flight_request(self, request_key: str) -> None:
        """Remove in-flight request after completion"""
        async with self._lock:
            self._in_flight_requests.pop(request_key, None)
    
    def get_metrics(self, entity: Optional[str] = None) -> Dict:
        """Get metrics for entity(ies)"""
        if entity:
            state = self._get_or_create_state(entity)
            return state.get_metrics()
        
        # Return metrics for all entities
        return {
            "entities": {
                entity: state.get_metrics()
                for entity, state in self._entities.items()
            }
        }
    
    def check_alerts(self) -> List[Dict]:
        """Check for alert conditions and return alerts"""
        alerts = []
        now = time.time()
        
        for entity, state in self._entities.items():
            # Low remaining warning
            if state.remaining is not None:
                if state.remaining < OBSERVABILITY_THRESHOLDS["critical_remaining_warning"]:
                    alerts.append({
                        "level": "critical",
                        "entity": entity,
                        "message": f"Critical: {entity} has only {state.remaining} requests remaining",
                        "remaining": state.remaining,
                    })
                elif state.remaining < OBSERVABILITY_THRESHOLDS["low_remaining_warning"]:
                    alerts.append({
                        "level": "warning",
                        "entity": entity,
                        "message": f"Warning: {entity} has {state.remaining} requests remaining",
                        "remaining": state.remaining,
                    })
            
            # High 429 rate
            if state.get_429_rate() > OBSERVABILITY_THRESHOLDS["high_429_rate"]:
                alerts.append({
                    "level": "warning",
                    "entity": entity,
                    "message": f"High 429 rate for {entity}: {state.get_429_rate()} in last minute",
                    "429_rate": state.get_429_rate(),
                })
            
            # Low cache hit rate
            hit_rate = state.get_cache_hit_rate()
            if state.cache_hits + state.cache_misses > 10 and hit_rate < OBSERVABILITY_THRESHOLDS["cache_hit_rate_warning"]:
                alerts.append({
                    "level": "warning",
                    "entity": entity,
                    "message": f"Low cache hit rate for {entity}: {hit_rate:.1%}",
                    "cache_hit_rate": hit_rate,
                })
        
        return alerts


# Global singleton instance
_rate_limit_manager: Optional[RateLimitManager] = None

def get_rate_limit_manager() -> RateLimitManager:
    """Get global rate limit manager instance"""
    global _rate_limit_manager
    if _rate_limit_manager is None:
        _rate_limit_manager = RateLimitManager()
    return _rate_limit_manager

