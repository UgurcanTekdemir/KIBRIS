# Rate Limit Management Test Plan

## 1. 429 Error Simulation Test

### Test Case 1.1: Single Entity 429 Handling
```python
# Simulate 429 for fixtures entity
# Expected: Cooldown activated, exponential backoff applied
# Verify: Cooldown duration calculated correctly, retry after cooldown
```

### Test Case 1.2: Multiple Entities 429 Handling
```python
# Simulate 429 for fixtures and livescores simultaneously
# Expected: Each entity enters independent cooldown
# Verify: One entity's cooldown doesn't affect the other
```

### Test Case 1.3: 429 Recovery
```python
# Simulate 429, wait for cooldown, then retry
# Expected: Request succeeds after cooldown period
# Verify: Rate limit state resets correctly
```

## 2. Concurrency Test

### Test Case 2.1: In-Flight Request Deduplication
```python
# Make 10 concurrent requests with same path/params
# Expected: Only 1 actual API call, others wait for result
# Verify: All 10 requests return same data, only 1 API call logged
```

### Test Case 2.2: Different Request Parameters
```python
# Make 10 concurrent requests with different params
# Expected: All 10 requests go through (no deduplication)
# Verify: All requests succeed independently
```

### Test Case 2.3: High Concurrency Load
```python
# Make 100 concurrent requests across multiple entities
# Expected: Rate limiting prevents exceeding capacity
# Verify: Requests are queued and processed within limits
```

## 3. Cache Hit Test

### Test Case 3.1: Cache Hit Rate
```python
# Make 100 requests, 50% cache hits expected
# Expected: Cache hit rate ~50%
# Verify: Metrics show correct cache hit/miss counts
```

### Test Case 3.2: Degrade Mode Cache Fallback
```python
# Enter degrade mode, make request
# Expected: Request served from cache if available
# Verify: No API call made, cache data returned
```

### Test Case 3.3: Cache TTL Per Entity
```python
# Test different entities have different cache TTLs
# Expected: Static entities (24h), live entities (4s)
# Verify: Cache expires at correct times
```

## 4. Rate Limit Metadata Parsing Test

### Test Case 4.1: Header Parsing
```python
# Mock response with X-RateLimit-* headers
# Expected: Rate limit state updated from headers
# Verify: remaining, limit, reset_at extracted correctly
```

### Test Case 4.2: Response Body Parsing
```python
# Mock response with rate_limit object in body
# Expected: Rate limit state updated from body
# Verify: remaining, limit, reset_at extracted correctly
```

### Test Case 4.3: Missing Metadata
```python
# Mock response without rate limit metadata
# Expected: System continues with token bucket algorithm
# Verify: No errors, graceful degradation
```

## 5. Degrade Mode Test

### Test Case 5.1: Enter Degrade Mode
```python
# Simulate remaining < 200
# Expected: Entity enters degrade mode
# Verify: is_degraded flag set, cache-only requests
```

### Test Case 5.2: Exit Degrade Mode
```python
# Simulate remaining > 400 (2x threshold)
# Expected: Entity exits degrade mode
# Verify: is_degraded flag cleared, normal requests resume
```

## 6. Observability Test

### Test Case 6.1: Metrics Endpoint
```python
# GET /api/rate-limit/metrics
# Expected: Returns metrics for all entities
# Verify: All metrics present (requests, 429s, cache hits, etc.)
```

### Test Case 6.2: Alerts Generation
```python
# Trigger alert conditions (low remaining, high 429 rate)
# Expected: Alerts returned in metrics endpoint
# Verify: Alert levels and messages correct
```

### Test Case 6.3: Entity-Specific Metrics
```python
# GET /api/rate-limit/metrics?entity=fixtures
# Expected: Returns metrics for fixtures only
# Verify: Only fixtures metrics returned
```

## 7. Integration Test

### Test Case 7.1: Full Request Flow
```python
# Make request -> check cache -> rate limit -> API call -> update state -> cache response
# Expected: All steps executed correctly
# Verify: Cache hit/miss, rate limit state, API call, caching all work
```

### Test Case 7.2: Error Recovery
```python
# Simulate network error, then retry
# Expected: Retry with backoff, eventual success
# Verify: Rate limit state preserved, retry logic works
```

## Test Execution

### Manual Testing
1. Start backend server
2. Use curl/Postman to make requests
3. Monitor logs for rate limit behavior
4. Check `/api/rate-limit/metrics` endpoint

### Automated Testing
```python
# pytest test_rate_limit.py
# Run all test cases above
```

### Load Testing
```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 http://localhost:8000/api/matches/live
# Monitor rate limit behavior under load
```

## Success Criteria

1. ✅ 429 errors handled gracefully with cooldown
2. ✅ In-flight requests deduplicated correctly
3. ✅ Cache hit rate > 50% for repeated requests
4. ✅ Degrade mode activates when remaining < 200
5. ✅ Metrics endpoint returns accurate data
6. ✅ Alerts generated for critical conditions
7. ✅ No rate limit exceeded errors in production

