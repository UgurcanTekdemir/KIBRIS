# SportMonks Rate Limit Management Implementation

## Overview

Entity-based rate limit management system for SportMonks V3 API with:
- Token bucket + sliding window algorithm
- 429 error handling with exponential backoff
- Degrade mode when remaining < 200
- In-flight request deduplication
- Observability and metrics

## Architecture

### Components

1. **Rate Limit Manager** (`backend/services/rate_limit_manager.py`)
   - Entity-based rate limit tracking
   - Token bucket algorithm (3000/hour/entity)
   - Cooldown management for 429 errors
   - Degrade mode activation
   - Metrics collection

2. **Rate Limit Config** (`backend/config/rate_limit_config.py`)
   - Entity definitions
   - Cache TTL per entity
   - Backoff configuration
   - Observability thresholds

3. **SportMonks Service** (Updated)
   - Integrated rate limit manager
   - Request deduplication
   - Cache integration
   - Metadata parsing from headers/response

## Entity-Based Rate Limiting

### How It Works

1. **Entity Detection**: Automatically extracts entity from API path
   - `fixtures/123` → `fixtures`
   - `livescores` → `livescores`
   - `odds/fixtures/123` → `odds`

2. **Token Bucket**: Each entity has independent bucket
   - Capacity: 3000 requests/hour
   - Tokens refill proportionally to elapsed time
   - Sliding window tracks actual request count

3. **Request Flow**:
   ```
   Request → Check Cache → Check In-Flight → Acquire Token → API Call → Update State → Cache Response
   ```

### Rate Limit Metadata

System extracts rate limit info from:
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Limit`, `X-RateLimit-Reset`
- **Response Body**: `rate_limit.remaining`, `rate_limit.limit`, `rate_limit.reset_at`

## 429 Error Handling

### Cooldown Mechanism

When 429 received:
1. Entity enters cooldown period
2. Cooldown duration calculated from:
   - `Retry-After` header (preferred)
   - `reset_at` from response body
   - Exponential backoff (fallback)
3. Jitter added (0-30% of wait time)
4. All requests to entity blocked during cooldown

### Exponential Backoff

```python
base_delay = 1.0s
max_delay = 300s (5 minutes)
exponential_base = 2.0
jitter_max = 0.3 (30%)

delay = min(max_delay, base_delay * (2.0 ^ attempt)) + jitter
```

## Degrade Mode

### Activation

- Triggered when `remaining < 200` requests
- Entity marked as degraded
- All requests served from cache only
- No API calls made until recovery

### Recovery

- Exits when `remaining >= 400` (2x threshold)
- Normal operation resumes
- API calls allowed again

## In-Flight Request Deduplication

### How It Works

1. Generate request key: `MD5(path + sorted_params)`
2. Check if same request is in-flight
3. If yes: Wait for existing request result
4. If no: Create new request task

### Benefits

- Prevents duplicate API calls
- Reduces rate limit consumption
- Improves response time for concurrent requests

## Cache Strategy

### TTL Per Entity

| Entity Type | TTL | Reason |
|------------|-----|--------|
| Static (teams, leagues, markets) | 24 hours | Rarely change |
| Semi-static (standings, sidelined) | 5-10 min | Change occasionally |
| Dynamic (fixtures) | 3 min | Change frequently |
| Live (livescores, odds, events) | 4 sec | Very dynamic |

### Cache Integration

- Cache checked before API call
- Successful responses cached automatically
- Degrade mode uses cache as fallback

## Observability

### Metrics Endpoint

`GET /api/rate-limit/metrics?entity=<entity_name>`

Returns:
```json
{
  "success": true,
  "metrics": {
    "entities": {
      "fixtures": {
        "entity": "fixtures",
        "tokens_remaining": 2500,
        "requests_in_window": 500,
        "capacity": 3000,
        "api_remaining": 2500,
        "api_limit": 3000,
        "reset_at": 1704067200,
        "reset_in_seconds": 3600,
        "is_in_cooldown": false,
        "is_degraded": false,
        "total_requests": 10000,
        "total_429_errors": 5,
        "recent_429_rate": 0,
        "cache_hits": 5000,
        "cache_misses": 5000,
        "cache_hit_rate": 0.5
      }
    }
  },
  "alerts": [
    {
      "level": "warning",
      "entity": "fixtures",
      "message": "Warning: fixtures has 250 requests remaining",
      "remaining": 250
    }
  ]
}
```

### Alerts

Generated for:
- **Critical**: `remaining < 200`
- **Warning**: `remaining < 500`
- **Warning**: `429_rate > 10` in last minute
- **Warning**: `cache_hit_rate < 50%`

## Configuration

### Environment Variables

No new environment variables required. Uses existing:
- `SPORTMONKS_API_TOKEN`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (for cache)

### Config File

`backend/config/rate_limit_config.py` contains:
- Entity definitions
- Cache TTL mapping
- Backoff parameters
- Alert thresholds

## Usage Examples

### Making a Request

```python
# Automatic entity detection
data = await sportmonks_service._get("fixtures/12345")

# Explicit entity
data = await sportmonks_service._get(
    "fixtures/12345",
    entity="fixtures",
    use_cache=True,
    use_deduplication=True
)
```

### Checking Metrics

```python
from services.rate_limit_manager import get_rate_limit_manager

manager = get_rate_limit_manager()
metrics = manager.get_metrics(entity="fixtures")
alerts = manager.check_alerts()
```

## Testing

See `TEST_PLAN.md` for comprehensive test cases covering:
- 429 error simulation
- Concurrency and deduplication
- Cache hit rates
- Degrade mode
- Observability

## Best Practices

1. **Minimize Includes**: Only request needed data
2. **Use Cache**: Leverage entity-specific TTLs
3. **Monitor Metrics**: Check `/api/rate-limit/metrics` regularly
4. **Handle Degrade Mode**: Implement fallback UI when degraded
5. **Respect Cooldowns**: Don't retry during cooldown period

## Migration Notes

### Breaking Changes

None. System is backward compatible.

### Performance Impact

- **Positive**: Reduced API calls via deduplication and caching
- **Positive**: Better rate limit utilization
- **Neutral**: Slight overhead from rate limit checks (negligible)

## Troubleshooting

### High 429 Rate

1. Check metrics: `GET /api/rate-limit/metrics`
2. Review entity usage patterns
3. Increase cache TTL for static entities
4. Reduce polling frequency

### Low Cache Hit Rate

1. Check cache TTL configuration
2. Verify Redis connection
3. Review request patterns (unique params prevent caching)

### Degrade Mode Stuck

1. Check `remaining` in metrics
2. Verify API is returning correct metadata
3. Manual reset: Restart backend (clears in-memory state)

## Future Enhancements

- [ ] Distributed rate limiting (Redis-based)
- [ ] Request queuing with priority
- [ ] Adaptive TTL based on data freshness
- [ ] Prometheus metrics export
- [ ] Webhook notifications for alerts

