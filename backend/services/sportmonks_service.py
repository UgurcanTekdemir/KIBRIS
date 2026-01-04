"""
Sportmonks V3 API Service Module
Fetches football match data from Sportmonks V3 API (Advanced Worldwide Plan).
Acts as a Data Proxy - no database storage, direct pass-through to frontend.
"""
import os
import asyncio
import random
import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import httpx
import logging

from services.rate_limit_manager import get_rate_limit_manager
from config.rate_limit_config import get_entity_from_path, get_cache_ttl
from services.cache import get_cached, set_cached, cache_key

logger = logging.getLogger(__name__)

SPORTMONKS_API_BASE_URL = "https://api.sportmonks.com/v3/football"
# API Token from environment variable or use provided token
SPORTMONKS_API_TOKEN = os.environ.get(
    "SPORTMONKS_API_TOKEN",
    "DANuduophWe7ysew7fNLOxySHaeQKvWsEPlpbOGCxI4Jt6sBuQhBnGUFFEem"
)

# Bet365 (bookmaker ID: 2) supported market IDs for Standard Odds (Total Pre-Match/In-Play)
BET365_SUPPORTED_MARKET_IDS = {
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 37, 38, 40, 42, 43, 44, 45,
    46, 47, 50, 51, 53, 56, 57, 60, 61, 62, 63, 64, 65, 66, 67, 68, 70, 80,
    97, 101, 120, 121, 126, 247, 264, 265, 266
}

# Allowed event type_ids (Bet365 shows these)
# Events that should be displayed in the UI
ALLOWED_EVENT_TYPE_IDS = {
    10,  # Goal
    14,  # Goal
    15,  # Card (Yellow)
    16,  # Card (Red)
    17,  # Substitution
    18,  # Penalty
    19,  # VAR
    20,  # VAR Decision
    21,  # Other important events
}

# Popular leagues for default filtering (20-40 leagues instead of all 113)
# These are the most commonly watched leagues
POPULAR_LEAGUE_IDS = [
    8,    # Premier League
    39,   # La Liga
    78,   # Bundesliga
    135,  # Serie A
    61,   # Ligue 1
    88,   # Eredivisie
    203,  # Super Lig
    71,   # Brasileirão
    169,  # Championship
    140,  # Primera División (Argentina)
    235,  # Liga MX
    17,   # UEFA Champions League
    18,   # UEFA Europa League
    5,    # World Cup
    1,    # World
    2,    # International
    4,    # Europe
    564,  # MLS
    384,  # J1 League
    197,  # A-League
    119,  # Primeira Liga
    144,  # Scottish Premiership
    103, # Belgian Pro League
    45,   # Austrian Bundesliga
    41,   # Swiss Super League
    50,   # Russian Premier League
    37,   # Danish Superliga
    38,   # Norwegian Eliteserien
    39,   # Swedish Allsvenskan
    42,   # Polish Ekstraklasa
    48,   # Czech First League
    51,   # Greek Super League
    52,   # Croatian First League
    53,   # Romanian Liga I
    54,   # Bulgarian First League
    55,   # Serbian SuperLiga
]


class SportmonksService:
    """Service class for interacting with Sportmonks V3 API."""

    def __init__(self) -> None:
        if not SPORTMONKS_API_TOKEN:
            logger.warning("SPORTMONKS_API_TOKEN is not set. Requests will fail.")
        self.api_token = SPORTMONKS_API_TOKEN
        self.base_url = SPORTMONKS_API_BASE_URL
        self.timeout = 35.0  # Optimized timeout for faster error detection
        # Lazy initialization of HTTP client with connection pooling
        self._client = None
        
        # Entity-based rate limit manager
        self._rate_limit_manager = get_rate_limit_manager()
        
        # Entity caching (for rarely-changing entities like States, Types, Countries)
        # Cache TTL: 24 hours (these entities rarely change)
        self._entity_cache = {}  # {entity_type: {data: [...], timestamp: float}}
        self._entity_cache_ttl = 24 * 60 * 60  # 24 hours in seconds
    
    def _get_client(self) -> httpx.AsyncClient:
        """Get or create reusable HTTP client with connection pooling."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
            )
        return self._client

    def _generate_request_key(self, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        """Generate a unique key for request deduplication"""
        key_parts = [path]
        if params:
            # Sort params for consistent key generation
            sorted_params = sorted(params.items())
            key_parts.append(json.dumps(sorted_params, sort_keys=True))
        key_string = "|".join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    async def _get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        retries: int = 3,
        backoff_factor: float = 0.5,
        entity: Optional[str] = None,
        use_cache: bool = True,
        use_deduplication: bool = True
    ) -> Any:
        """
        Generic GET request handler with retry logic and entity-based rate limit management.
        
        Args:
            path: API endpoint path (e.g., "livescores", "fixtures/12345")
            params: Additional query parameters (include, filters, etc.)
            retries: Number of retry attempts
            backoff_factor: Exponential backoff multiplier
            entity: Entity type (auto-detected from path if not provided)
            use_cache: Whether to use cache
            use_deduplication: Whether to deduplicate in-flight requests
            
        Returns:
            JSON response data
        """
        if not self.api_token:
            raise Exception(
                "SPORTMONKS_API_TOKEN environment variable is not set. "
                "Please configure it to enable Sportmonks V3 requests."
            )
        
        # Determine entity from path
        if not entity:
            entity = get_entity_from_path(path)
        
        # Generate request key for deduplication
        request_key = self._generate_request_key(path, params) if use_deduplication else None
        
        # Check for in-flight request (deduplication)
        if use_deduplication and request_key:
            in_flight_task = await self._rate_limit_manager.get_in_flight_request(request_key)
            if in_flight_task and not in_flight_task.done():
                logger.debug(f"Waiting for in-flight request: {path}")
                try:
                    return await in_flight_task
                except Exception as e:
                    logger.warning(f"In-flight request failed: {e}, making new request")
        
        # Check cache first
        if use_cache:
            cache_ttl = get_cache_ttl(entity)
            cache_key_str = cache_key(f"sportmonks:{entity}", path, params)
            cached_data = await get_cached(cache_key_str)
            if cached_data is not None:
                logger.debug(f"Cache HIT for {entity}: {path}")
                self._rate_limit_manager.record_cache_hit(entity)
                return cached_data
            self._rate_limit_manager.record_cache_miss(entity)
        
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {
            "Authorization": self.api_token,
            "Accept": "application/json"
        }
        
        query_params = {}
        if params:
            query_params.update(params)
        
        # Check if entity is degraded (serve from cache if available)
        if self._rate_limit_manager.is_degraded(entity) and use_cache:
            logger.warning(f"Entity {entity} is degraded, trying cache only")
            cache_key_str = cache_key(f"sportmonks:{entity}", path, params)
            cached_data = await get_cached(cache_key_str)
            if cached_data is not None:
                logger.info(f"Serving degraded request from cache: {entity}: {path}")
                return cached_data
            # If no cache, raise exception
            raise Exception(f"Entity {entity} is degraded and no cache available for {path}")
        
        # Create request task for deduplication
        async def make_request():
            last_exception = None
            for attempt in range(retries):
                try:
                    # Acquire rate limit permission
                    allowed, wait_time = await self._rate_limit_manager.acquire(entity)
                    if not allowed:
                        logger.info(f"Rate limit wait for {entity}: {wait_time:.2f}s")
                        await asyncio.sleep(wait_time)
                        # Try again
                        allowed, wait_time = await self._rate_limit_manager.acquire(entity)
                        if not allowed:
                            raise Exception(f"Rate limit exceeded for {entity} after waiting")
                    
                    # Use reusable client with connection pooling
                    client = self._get_client()
                    response = await client.get(url, headers=headers, params=query_params)
                    
                    # Update rate limit state from response headers
                    self._rate_limit_manager.update_from_response(
                        entity=entity,
                        headers=dict(response.headers)
                    )
                    
                    # Handle rate limiting (429) - check this first
                    if response.status_code == 429:
                        try:
                            error_data = response.json()
                            error_message = error_data.get("message", "Rate limit exceeded")
                            reset_code = error_data.get("reset_code", "")
                            # Try to extract reset time from error response
                            reset_at = error_data.get("reset_at") or error_data.get("reset")
                        except:
                            error_message = response.text[:200] if response.text else "Rate limit exceeded"
                            reset_code = ""
                            reset_at = None
                        
                        retry_after = None
                        try:
                            retry_after = int(response.headers.get("Retry-After", 0))
                        except (ValueError, TypeError):
                            pass
                        
                        # Handle 429 with rate limit manager
                        cooldown_duration = await self._rate_limit_manager.handle_429(
                            entity=entity,
                            retry_after=retry_after,
                            reset_at=reset_at
                        )
                        
                        if attempt < retries - 1:
                            logger.warning(
                                f"Rate limited for {entity}:{path}. Cooldown: {cooldown_duration:.2f}s. "
                                f"Retry {attempt + 1}/{retries}. Message: {error_message}"
                            )
                            await asyncio.sleep(cooldown_duration)
                            continue
                        else:
                            error_msg = f"Rate limit exceeded after {retries} attempts for {entity}:{path}: {error_message}"
                            if reset_code:
                                error_msg += f" (reset_code: {reset_code})"
                            logger.error(error_msg)
                            raise Exception(error_msg)
                
                # Handle other HTTP errors (400+)
                if response.status_code >= 400:
                    error_text = response.text[:200] if response.text else "Unknown error"
                    if attempt < retries - 1:
                        wait_time = (backoff_factor ** attempt)
                        # Add jitter (random delay between 0-30% of wait_time) to prevent synchronized retries
                        jitter = random.uniform(0, wait_time * 0.3)
                        wait_time_with_jitter = wait_time + jitter
                        logger.warning(
                            f"HTTP {response.status_code} error for {path}: {error_text}. "
                            f"Retrying in {wait_time_with_jitter:.2f} seconds (base: {wait_time:.2f}, jitter: {jitter:.2f})..."
                        )
                        await asyncio.sleep(wait_time_with_jitter)
                        continue
                    else:
                        raise Exception(f"HTTP {response.status_code} error for {path}: {error_text}")
                
                    # Success (200) - parse and return JSON
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            
                            # Extract rate limit metadata from response body
                            rate_limit_info = data.get("rate_limit", {})
                            remaining = rate_limit_info.get("remaining")
                            limit = rate_limit_info.get("limit")
                            reset_at = rate_limit_info.get("reset_at") or rate_limit_info.get("reset")
                            
                            # Update rate limit state from response body
                            if remaining is not None or limit is not None or reset_at is not None:
                                self._rate_limit_manager.update_from_response(
                                    entity=entity,
                                    remaining=remaining,
                                    limit=limit,
                                    reset_at=reset_at,
                                    headers=dict(response.headers)
                                )
                            
                        except (ValueError, KeyError, TypeError) as e:
                            logger.debug(f"Could not parse rate limit info from response: {e}")
                            # Still update from headers if available
                            self._rate_limit_manager.update_from_response(
                                entity=entity,
                                headers=dict(response.headers)
                            )
                        
                        # Cache successful response
                        if use_cache:
                            cache_ttl = get_cache_ttl(entity)
                            cache_key_str = cache_key(f"sportmonks:{entity}", path, params)
                            await set_cached(cache_key_str, data, cache_ttl)
                        
                        # Success - return JSON
                        return data
                
                # If we get here, status code is not 200, 429, or >= 400 (shouldn't happen)
                raise Exception(f"Unexpected status code {response.status_code} for {path}")
                    
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt < retries - 1:
                    wait_time = (backoff_factor ** attempt) * 2
                    # Add jitter (random delay between 0-30% of wait_time) to prevent synchronized retries
                    jitter = random.uniform(0, wait_time * 0.3)
                    wait_time_with_jitter = wait_time + jitter
                    logger.warning(f"Request timeout. Retrying in {wait_time_with_jitter:.2f} seconds (base: {wait_time:.2f}, jitter: {jitter:.2f})...")
                    await asyncio.sleep(wait_time_with_jitter)
                    continue
                else:
                    raise Exception(f"Request timeout after {retries} attempts: {str(e)}")
                    
            except httpx.RequestError as e:
                last_exception = e
                if attempt < retries - 1:
                    wait_time = (backoff_factor ** attempt)
                    logger.warning(f"Request error: {str(e)}. Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"Request failed after {retries} attempts: {str(e)}")
                    
                except Exception as e:
                    last_exception = e
                    if attempt < retries - 1:
                        wait_time = (backoff_factor ** attempt)
                        logger.warning(f"Unexpected error: {str(e)}. Retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise
            
            # If we get here, all retries failed
            if last_exception:
                error_msg = f"Request failed after {retries} retries for {entity}:{path}: {str(last_exception)}"
                logger.error(error_msg)
                raise Exception(error_msg)
            error_msg = f"Request failed after all {retries} retries for {entity}:{path} (no exception captured)"
            logger.error(error_msg)
            raise Exception(error_msg)
        
        # Create and track task for deduplication
        if use_deduplication and request_key:
            task = asyncio.create_task(make_request())
            await self._rate_limit_manager.set_in_flight_request(request_key, task)
            try:
                result = await task
                return result
            finally:
                await self._rate_limit_manager.remove_in_flight_request(request_key)
        else:
            return await make_request()

    async def get_livescores(
        self,
        include: str = "participants;scores;events;league;odds;currentPeriod",
        filters: Optional[str] = None,
        use_inplay: bool = False,
        league_ids: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get live football matches.
        
        Args:
            include: Comma-separated list of relations to include
            filters: Optional filters parameter (e.g., "markets:1;bookmakers:1")
            use_inplay: If True, use livescores/inplay endpoint for better accuracy
            league_ids: Optional list of league IDs to filter by (formatted as fixtureLeagues filter)
            
        Returns:
            List of live match data
        """
        try:
            params = {}
            if include:
                params["include"] = include
            
            # Build filters string
            filter_parts = []
            if filters:
                filter_parts.append(filters)
            
            # Add league filter if provided
            if league_ids and len(league_ids) > 0:
                league_filter = f"fixtureLeagues:{','.join(map(str, league_ids))}"
                filter_parts.append(league_filter)
            
            if filter_parts:
                params["filters"] = ";".join(filter_parts)
            
            # Use inplay endpoint for better accuracy if requested
            endpoint = "livescores/inplay" if use_inplay else "livescores"
            response = await self._get(endpoint, params=params)
            
            # Sportmonks V3 returns data in response.data array
            if isinstance(response, dict) and "data" in response:
                return response["data"]
            elif isinstance(response, list):
                return response
            else:
                logger.warning(f"Unexpected response format: {type(response)}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching livescores: {e}")
            raise

    async def get_fixtures_by_date(
        self,
        date: str,
        include: str = "participants;scores;events;league;odds",
        filters: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get fixtures for a specific date using Sportmonks V3 /fixtures/date/{date} endpoint.
        Handles pagination to fetch all fixtures for the date.
        
        Args:
            date: Date in YYYY-MM-DD format
            include: Comma-separated list of relations to include
            filters: Optional filters parameter (e.g., "markets:1;bookmakers:1")
            
        Returns:
            List of fixture data for the specified date (all pages combined)
        """
        try:
            all_fixtures = []
            page = 1
            per_page = 100  # Maximum per page (Sportmonks allows up to 100)
            has_more = True
            
            while has_more:
                params = {
                    "page": page,
                    "per_page": per_page
                }
                if include:
                    params["include"] = include
                if filters:
                    params["filters"] = filters
                
                # Use Sportmonks V3 fixtures/date/{date} endpoint
                response = await self._get(f"fixtures/date/{date}", params=params)
                
                # Extract fixtures from response
                fixtures_list = []
                if isinstance(response, dict):
                    if "data" in response:
                        fixtures_list = response["data"]
                    # Check pagination info
                    pagination = response.get("pagination", {})
                    current_page = pagination.get("current_page", page)
                    last_page = pagination.get("last_page", 1)
                    has_more = current_page < last_page
                elif isinstance(response, list):
                    fixtures_list = response
                    # If response is a list, assume it's the last page
                    has_more = len(fixtures_list) >= per_page
                else:
                    has_more = False
                
                if fixtures_list:
                    all_fixtures.extend(fixtures_list)
                    logger.debug(f"Fetched {len(fixtures_list)} fixtures from page {page} for date {date}. Total: {len(all_fixtures)}")
                
                # If we got fewer results than per_page, we're done
                if len(fixtures_list) < per_page:
                    has_more = False
                
                page += 1
                
                # Safety limit: don't fetch more than 100 pages (10000 fixtures max per date)
                if page > 100:
                    logger.warning(f"Reached safety limit of 100 pages. Stopping pagination.")
                    has_more = False
                
                # Small delay between pages to respect rate limits
                if has_more:
                    await asyncio.sleep(0.1)
            
            logger.info(f"Total fixtures fetched for date {date}: {len(all_fixtures)}")
            return all_fixtures
        except Exception as e:
            logger.error(f"Error fetching fixtures for date {date}: {e}")
            return []

    async def get_fixtures_between(
        self,
        date_from: str,
        date_to: str,
        include: str = "participants;scores;events;league;odds",
        filters: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get fixtures for a date range using Sportmonks V3 /fixtures/between/{start}/{end} endpoint.
        This is more efficient than fetching each day separately.
        Maximum range: 100 days.
        Handles pagination to fetch all fixtures.
        
        Args:
            date_from: Start date in YYYY-MM-DD format
            date_to: End date in YYYY-MM-DD format
            include: Comma-separated list of relations to include
            filters: Optional filters parameter (e.g., "markets:1;bookmakers:1")
            
        Returns:
            List of fixture data for the date range (all pages combined)
        """
        try:
            all_fixtures = []
            page = 1
            per_page = 100  # Maximum per page (Sportmonks allows up to 100)
            has_more = True
            
            while has_more:
                params = {
                    "page": page,
                    "per_page": per_page
                }
                if include:
                    params["include"] = include
                if filters:
                    params["filters"] = filters
                
                # Use Sportmonks V3 fixtures/between/{start}/{end} endpoint
                response = await self._get(f"fixtures/between/{date_from}/{date_to}", params=params)
                
                # Extract fixtures from response
                fixtures_list = []
                if isinstance(response, dict):
                    if "data" in response:
                        fixtures_list = response["data"]
                    # Check pagination info
                    pagination = response.get("pagination", {})
                    current_page = pagination.get("current_page", page)
                    last_page = pagination.get("last_page", 1)
                    has_more = current_page < last_page
                elif isinstance(response, list):
                    fixtures_list = response
                    # If response is a list, assume it's the last page
                    has_more = len(fixtures_list) >= per_page
                else:
                    logger.warning(f"Unexpected response format: {type(response)}")
                    has_more = False
                
                if fixtures_list:
                    all_fixtures.extend(fixtures_list)
                    logger.debug(f"Fetched {len(fixtures_list)} fixtures from page {page}. Total: {len(all_fixtures)}")
                
                # If we got fewer results than per_page, we're done
                if len(fixtures_list) < per_page:
                    has_more = False
                
                page += 1
                
                # Safety limit: don't fetch more than 100 pages (10000 fixtures max per date range)
                if page > 100:
                    logger.warning(f"Reached safety limit of 100 pages. Stopping pagination.")
                    has_more = False
                
                # Small delay between pages to respect rate limits
                if has_more:
                    await asyncio.sleep(0.1)
            
            logger.info(f"Total fixtures fetched for {date_from} to {date_to}: {len(all_fixtures)}")
            return all_fixtures
                
        except Exception as e:
            logger.error(f"Error fetching fixtures between {date_from} and {date_to}: {e}")
            return []

    async def get_fixtures(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        league_id: Optional[int] = None,
        include: str = "participants;scores;events;league;odds",
        filters: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get fixtures (matches) for a date range or specific league.
        Uses /fixtures/between/{start}/{end} endpoint for efficiency (up to 100 days).
        Falls back to /fixtures/date/{date} for each day if range > 100 days.
        
        Args:
            date_from: Start date (YYYY-MM-DD format)
            date_to: End date (YYYY-MM-DD format)
            league_id: Optional league ID to filter by
            include: Comma-separated list of relations to include
            filters: Optional filters parameter (e.g., "markets:1;bookmakers:1")
            
        Returns:
            List of fixture data
        """
        try:
            from datetime import datetime, timedelta
            
            # If date range specified, use fixtures/between endpoint (more efficient)
            if date_from and date_to:
                start_date = datetime.strptime(date_from, "%Y-%m-%d")
                end_date = datetime.strptime(date_to, "%Y-%m-%d")
                days_diff = (end_date - start_date).days + 1
                
                # Use fixtures/between for ranges <= 100 days (Sportmonks limit)
                if days_diff <= 100:
                    fixtures_list = await self.get_fixtures_between(
                        date_from, date_to, include=include, filters=filters
                    )
                    
                    # Fallback: If get_fixtures_between returns empty or suspiciously low count,
                    # try per-day fetching (like old system) to ensure we get all matches
                    # This handles cases where fixtures/between might have issues or miss matches
                    # Average matches per day is typically 50-200, so if we get less than 10 per day, it's suspicious
                    avg_matches_per_day = len(fixtures_list) / days_diff if days_diff > 0 else 0
                    if not fixtures_list or (days_diff > 1 and avg_matches_per_day < 10):
                        logger.warning(
                            f"get_fixtures_between returned {len(fixtures_list)} fixtures ({avg_matches_per_day:.1f} per day) "
                            f"for {date_from} to {date_to}. Falling back to per-day fetching to ensure completeness."
                        )
                        all_fixtures = []
                        current_date = start_date
                        
                        while current_date <= end_date:
                            day_fixtures = await self.get_fixtures_by_date(
                                current_date.strftime("%Y-%m-%d"), 
                                include=include, 
                                filters=filters
                            )
                            if day_fixtures:
                                all_fixtures.extend(day_fixtures)
                            current_date += timedelta(days=1)
                            
                            # Small delay between days to respect rate limits
                            if current_date <= end_date:
                                await asyncio.sleep(0.05)
                        
                        # Use per-day results if they're better (more matches)
                        between_count = len(fixtures_list)
                        if len(all_fixtures) > between_count:
                            fixtures_list = all_fixtures
                            logger.info(f"Per-day fallback fetched {len(fixtures_list)} fixtures (vs {between_count} from between) for {date_from} to {date_to}")
                        else:
                            logger.info(f"Keeping get_fixtures_between results ({between_count} fixtures)")
                else:
                    # For ranges > 100 days, split into chunks of 100 days
                    all_fixtures = []
                    current_start = start_date
                    
                    while current_start <= end_date:
                        current_end = min(current_start + timedelta(days=99), end_date)
                        chunk_fixtures = await self.get_fixtures_between(
                            current_start.strftime("%Y-%m-%d"),
                            current_end.strftime("%Y-%m-%d"),
                            include=include,
                            filters=filters
                        )
                        all_fixtures.extend(chunk_fixtures)
                        current_start = current_end + timedelta(days=1)
                        
                        # Small delay between chunks to respect rate limits
                        if current_start <= end_date:
                            await asyncio.sleep(0.1)
                    
                    fixtures_list = all_fixtures
            elif date_from:
                # Single date
                fixtures_list = await self.get_fixtures_by_date(date_from, include=include, filters=filters)
            else:
                # No date specified, use today + 7 days
                today = datetime.now().strftime("%Y-%m-%d")
                fixtures_list = await self.get_fixtures_by_date(today, include=include, filters=filters)
            
            # Filter by league_id if specified
            if league_id and fixtures_list:
                fixtures_list = [
                    f for f in fixtures_list
                    if f.get("league_id") == league_id or 
                    (isinstance(f.get("league"), dict) and f.get("league", {}).get("id") == league_id) or
                    (isinstance(f.get("league"), dict) and "data" in f.get("league", {}) and 
                     f.get("league", {}).get("data", {}).get("id") == league_id)
                ]
            
            return fixtures_list
                
        except Exception as e:
            logger.error(f"Error fetching fixtures: {e}")
            return []

    async def get_latest_odds_inplay(self) -> List[Dict[str, Any]]:
        """
        Get latest in-play odds updates (last 10 seconds).
        Returns odds that have changed in the last 10 seconds for in-play matches.
        This is the "Last Updated Odds" endpoint for delta polling.
        
        Returns:
            List of odds data with fixture_id and odds information
        """
        try:
            response = await self._get("odds/inplay/latest")
            
            # Sportmonks V3 returns data in response.data array
            if isinstance(response, dict) and "data" in response:
                return response["data"]
            elif isinstance(response, list):
                return response
            else:
                logger.warning(f"Unexpected response format for latest in-play odds: {type(response)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching latest in-play odds: {e}")
            return []
    
    async def get_last_updated_odds(self) -> List[Dict[str, Any]]:
        """
        Get last updated in-play odds (delta updates).
        Returns only fixtures with odds changes in the last 10 seconds.
        This is used for efficient polling (5-10 second intervals).
        
        Returns:
            List of odds data with fixture_id and updated odds information
        """
        # Alias for get_latest_odds_inplay - same endpoint
        return await self.get_latest_odds_inplay()
    
    async def get_latest_odds_prematch(self) -> List[Dict[str, Any]]:
        """
        Get latest pre-match odds updates (last 10 seconds).
        Returns odds that have changed in the last 10 seconds for pre-match matches.
        
        Returns:
            List of odds data with fixture_id and odds information
        """
        try:
            response = await self._get("odds/pre-match/latest")
            
            # Sportmonks V3 returns data in response.data array
            if isinstance(response, dict) and "data" in response:
                return response["data"]
            elif isinstance(response, list):
                return response
            else:
                logger.warning(f"Unexpected response format for latest pre-match odds: {type(response)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching latest pre-match odds: {e}")
            return []
    
    async def get_inplay_odds_by_fixture(
        self,
        fixture_id: int,
        bookmaker_id: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Get in-play odds for a specific fixture from a specific bookmaker.
        This is the most stable endpoint for match detail pages (71 markets).
        
        Args:
            fixture_id: Sportmonks fixture ID
            bookmaker_id: Bookmaker ID (default: 2 for Bet365)
            
        Returns:
            List of odds data for all markets from the specified bookmaker
        """
        try:
            endpoint = f"odds/inplay/fixtures/{fixture_id}/bookmakers/{bookmaker_id}"
            response = await self._get(endpoint)
            
            # Sportmonks V3 returns data in response.data array
            if isinstance(response, dict) and "data" in response:
                return response["data"]
            elif isinstance(response, list):
                return response
            else:
                logger.warning(f"Unexpected response format for fixture odds: {type(response)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching in-play odds for fixture {fixture_id}: {e}")
            return []

    async def get_fixture(
        self,
        fixture_id: int,
        include: str = "participants;scores;statistics;lineups;events;odds;venue;season",
        filters: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed fixture information.
        
        Args:
            fixture_id: Sportmonks fixture ID
            include: Comma-separated list of relations to include
            filters: Optional filters parameter (e.g., "markets:1;bookmakers:1")
            
        Returns:
            Fixture data dictionary or None if not found
        """
        try:
            params = {}
            if include:
                params["include"] = include
            if filters:
                params["filters"] = filters
            response = await self._get(f"fixtures/{fixture_id}", params=params)
            
            # Sportmonks V3 returns data in response.data object
            if isinstance(response, dict):
                if "data" in response:
                    return response["data"]
                else:
                    # Sometimes the data is directly in the response
                    return response
            else:
                logger.warning(f"Unexpected response format: {type(response)}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching fixture {fixture_id}: {e}")
            return None

    def _get_cached_entity(self, entity_type: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached entity data if still valid."""
        if entity_type not in self._entity_cache:
            return None
        
        cache_entry = self._entity_cache[entity_type]
        cache_age = asyncio.get_event_loop().time() - cache_entry.get("timestamp", 0)
        
        if cache_age < self._entity_cache_ttl:
            return cache_entry.get("data")
        
        # Cache expired, remove it
        del self._entity_cache[entity_type]
        return None
    
    def _set_cached_entity(self, entity_type: str, data: List[Dict[str, Any]]) -> None:
        """Cache entity data with timestamp."""
        self._entity_cache[entity_type] = {
            "data": data,
            "timestamp": asyncio.get_event_loop().time()
        }
    
    async def _fetch_and_cache_entities(
        self,
        entity_type: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch entities with caching (for States, Types, Countries).
        
        Args:
            entity_type: Type of entity (e.g., "states", "types", "countries")
            endpoint: API endpoint to fetch from
            params: Optional query parameters
            
        Returns:
            List of entity data
        """
        # Check cache first
        cached_data = self._get_cached_entity(entity_type)
        if cached_data is not None:
            logger.debug(f"Using cached {entity_type} data")
            return cached_data
        
        # Fetch from API
        try:
            response = await self._get(endpoint, params=params or {})
            
            # Extract data from response
            entities_list = []
            if isinstance(response, dict) and "data" in response:
                entities_list = response["data"]
            elif isinstance(response, list):
                entities_list = response
            
            # Cache the data
            if entities_list:
                self._set_cached_entity(entity_type, entities_list)
            
            return entities_list
        except Exception as e:
            logger.error(f"Error fetching {entity_type}: {e}")
            return []
    
    async def get_leagues(
        self,
        include: str = "country;currentSeason"
    ) -> List[Dict[str, Any]]:
        """
        Get all available leagues from Sportmonks V3.
        Handles pagination to fetch all leagues.
        
        Args:
            include: Comma-separated list of relations to include
            
        Returns:
            List of league data (all pages combined)
        """
        try:
            all_leagues = []
            page = 1
            per_page = 100  # Maximum per page (Sportmonks allows up to 100)
            has_more = True
            
            while has_more:
                params = {
                    "page": page,
                    "per_page": per_page
                }
                if include:
                    params["include"] = include
                
                response = await self._get("leagues", params=params)
                
                # Extract leagues from response
                leagues_list = []
                if isinstance(response, dict):
                    if "data" in response:
                        leagues_list = response["data"]
                    # Check pagination info
                    pagination = response.get("pagination", {})
                    current_page = pagination.get("current_page", page)
                    last_page = pagination.get("last_page", 1)
                    has_more = current_page < last_page
                elif isinstance(response, list):
                    leagues_list = response
                    # If response is a list, assume it's the last page
                    has_more = len(leagues_list) >= per_page
                else:
                    has_more = False
                
                if leagues_list:
                    all_leagues.extend(leagues_list)
                    logger.info(f"Fetched {len(leagues_list)} leagues from page {page}. Total: {len(all_leagues)}")
                
                # If we got fewer results than per_page, we're done
                if len(leagues_list) < per_page:
                    has_more = False
                
                page += 1
                
                # Safety limit: don't fetch more than 50 pages (5000 leagues max)
                if page > 50:
                    logger.warning(f"Reached safety limit of 50 pages. Stopping pagination.")
                    has_more = False
            
            logger.info(f"Total leagues fetched: {len(all_leagues)}")
            return all_leagues
        except Exception as e:
            logger.error(f"Error fetching leagues: {e}")
            return []

    def _transform_standings_data(self, table_data: List[Dict[str, Any]], season_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Transform standings data from API format to frontend format.
        
        Args:
            table_data: List of standing entries from API
            season_id: Optional season ID
            
        Returns:
            Transformed standings data
        """
        transformed_table = []
        for entry in table_data:
            if isinstance(entry, dict):
                # Extract participant/team info
                participant = entry.get("participant") or entry.get("team") or {}
                if isinstance(participant, dict):
                    team_name = participant.get("name") or participant.get("full_name") or ""
                    team_id = participant.get("id")
                    team_logo = participant.get("image_path") or participant.get("logo") or ""
                elif isinstance(participant, str):
                    team_name = participant
                    team_id = entry.get("participant_id")
                    team_logo = ""
                else:
                    team_name = entry.get("team_name") or entry.get("name") or ""
                    team_id = entry.get("participant_id") or entry.get("team_id")
                    team_logo = ""
                
                # Extract details if available
                details = entry.get("details", [])
                details_dict = {}
                if isinstance(details, list):
                    for detail in details:
                        if isinstance(detail, dict):
                            type_id = detail.get("type_id")
                            value = detail.get("value", 0)
                            details_dict[type_id] = value
                
                # Map type_id to field names based on Sportmonks API
                # Type IDs vary by league, common ones:
                # 129=played, 130=won, 131=drawn, 132=lost, 133=goals_for, 134=goals_against, 135=won (home), 136=drawn (home), 137=lost (home), 138=lost (away), 139=won (home), 140=won (away), 141=drawn (home), 143=lost (home), 144=lost (away), 185=matches_played, 186=matches_played, 187=points
                # Try multiple type IDs for each field
                # Note: Some leagues use different type IDs, so we check multiple possibilities
                # Use get() with explicit None check to handle 0 values correctly
                def get_detail_value(*type_ids):
                    for tid in type_ids:
                        if tid in details_dict:
                            val = details_dict[tid]
                            # Return value even if it's 0 (0 is a valid value)
                            return val if val is not None else None
                    return None
                
                # For played: 129, 185, 186 are common
                played_detail = get_detail_value(129, 185, 186)
                played = played_detail if played_detail is not None else (entry.get("played") or entry.get("matches_played") or entry.get("games_played") or 0)
                # For won: 130 is standard
                won_detail = get_detail_value(130)
                won = won_detail if won_detail is not None else (entry.get("won") or entry.get("wins") or 0)
                # For drawn: 131 is standard
                drawn_detail = get_detail_value(131)
                drawn = drawn_detail if drawn_detail is not None else (entry.get("drawn") or entry.get("draws") or entry.get("ties") or 0)
                # For lost: 132 is standard
                lost_detail = get_detail_value(132)
                lost = lost_detail if lost_detail is not None else (entry.get("lost") or entry.get("losses") or 0)
                # For goals_for: 133 is standard
                goals_for_detail = get_detail_value(133)
                goals_for = goals_for_detail if goals_for_detail is not None else (entry.get("goals_for") or entry.get("goals_scored") or entry.get("gf") or 0)
                # For goals_against: 134 is standard
                goals_against_detail = get_detail_value(134)
                goals_against = goals_against_detail if goals_against_detail is not None else (entry.get("goals_against") or entry.get("goals_conceded") or entry.get("ga") or 0)
                # For points: 187 is standard
                points_detail = get_detail_value(187)
                points = points_detail if points_detail is not None else (entry.get("points") or entry.get("pts") or 0)
                
                # Calculate averages
                avg_points = round(points / played, 2) if played > 0 else 0
                avg_goals_for = round(goals_for / played, 2) if played > 0 else 0
                avg_goals_against = round(goals_against / played, 2) if played > 0 else 0
                
                transformed_entry = {
                    "position": entry.get("position") or entry.get("rank") or entry.get("standing") or 0,
                    "team_name": team_name,
                    "team_id": team_id,
                    "team_logo": team_logo,
                    "played": played,
                    "won": won,
                    "drawn": drawn,
                    "lost": lost,
                    "goals_for": goals_for,
                    "goals_against": goals_against,
                    "goal_difference": entry.get("goal_difference") or entry.get("gd") or entry.get("diff") or (goals_for - goals_against),
                    "points": points,
                    "avg_points": avg_points,
                    "avg_goals_for": avg_goals_for,
                    "avg_goals_against": avg_goals_against,
                }
                transformed_table.append(transformed_entry)
        
        # Sort by position
        transformed_table.sort(key=lambda x: x.get("position", 999))
        
        return {
            "table": transformed_table,
            "season_id": season_id or (table_data[0].get("season_id") if table_data else None),
        }
    
    async def get_standings_by_season(
        self,
        season_id: int,
        include: str = "participant;details"
    ) -> Dict[str, Any]:
        """
        Get league standings by season ID from Sportmonks V3.
        Uses the general standings endpoint and filters by season_id.
        
        Args:
            season_id: Season ID
            include: Comma-separated list of relations to include
            
        Returns:
            Standings data with transformed table
        """
        try:
            params = {}
            if include:
                params["include"] = include
            else:
                params["include"] = "participant;details"
            
            # Try the general standings endpoint first
            response = await self._get("standings", params=params)
            
            # Filter by season_id if response is successful
            if isinstance(response, dict) and "data" in response:
                standings_list = response["data"]
                if isinstance(standings_list, list):
                    # Filter by season_id
                    filtered_standings = [s for s in standings_list if s.get("season_id") == season_id]
                    response = {"data": filtered_standings}
            
            # If general endpoint doesn't work or returns empty, try the season-specific endpoint
            if not response or (isinstance(response, dict) and "data" in response and len(response.get("data", [])) == 0):
                response = await self._get(f"standings/seasons/{season_id}", params=params)
            
            # Check if response contains error message
            if isinstance(response, dict) and "message" in response:
                error_message = response.get("message", "")
                # If it's an access/subscription error, log and return empty
                if "access" in error_message.lower() or "subscription" in error_message.lower() or "not found" in error_message.lower():
                    logger.warning(f"Standings not available for season {season_id}: {error_message}")
                    return {}
            
            # Check if response contains error message
            if isinstance(response, dict) and "message" in response:
                error_message = response.get("message", "")
                # If it's an access/subscription error, log and return empty
                if "access" in error_message.lower() or "subscription" in error_message.lower() or "not found" in error_message.lower():
                    logger.warning(f"Standings not available for season {season_id}: {error_message}")
                    return {}
            
            # Extract standings from response
            # The general standings endpoint returns data as a list directly
            table_data = []
            if isinstance(response, dict):
                if "data" in response:
                    # Data is a list of standings
                    table_data = response["data"]
                    if not isinstance(table_data, list):
                        table_data = []
                elif "message" not in response:  # Only use response if it's not an error message
                    # Try to extract from other possible structures
                    if "standings" in response:
                        table_data = response["standings"] if isinstance(response["standings"], list) else []
                    elif isinstance(response.get("table"), list):
                        table_data = response["table"]
                    elif isinstance(response.get("results"), list):
                        table_data = response["results"]
            elif isinstance(response, list):
                table_data = response
            
            # Transform table entries using helper function
            return self._transform_standings_data(table_data, season_id)
        except Exception as e:
            logger.error(f"Error fetching standings for season {season_id}: {e}")
            return {}

    async def get_standings_by_league(
        self,
        league_id: int,
        season_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get league standings by league ID.
        Uses the general standings endpoint and filters by league_id.
        If season_id is not provided, uses the first available season from standings.
        
        Args:
            league_id: League ID
            season_id: Optional season ID (if not provided, uses first available from standings)
            
        Returns:
            Standings data
        """
        try:
            # Try to get standings from general endpoint first
            params = {"include": "participant;details"}
            response = await self._get("standings", params=params)
            
            if isinstance(response, dict) and "data" in response:
                standings_list = response["data"]
                if isinstance(standings_list, list):
                    # Filter by league_id
                    league_standings = [s for s in standings_list if s.get("league_id") == league_id]
                    
                    if league_standings:
                        # If season_id not provided, use the most common season_id from filtered standings
                        if not season_id:
                            # Count season_id occurrences
                            season_counts = {}
                            for s in league_standings:
                                sid = s.get("season_id")
                                if sid:
                                    season_counts[sid] = season_counts.get(sid, 0) + 1
                            
                            # Use the season_id with most standings (likely current season)
                            if season_counts:
                                season_id = max(season_counts.items(), key=lambda x: x[1])[0]
                        
                        # Filter by season_id if provided
                        if season_id:
                            league_standings = [s for s in league_standings if s.get("season_id") == season_id]
                        
                        # Transform standings to match frontend format
                        return self._transform_standings_data(league_standings, season_id)
            
            # Fallback: try to get season_id and use season-specific endpoint
            # First try to get from league info directly (more efficient than fetching all leagues)
            if not season_id:
                try:
                    # Get league info directly
                    include = "currentSeason"
                    league_response = await self._get(f"leagues/{league_id}", params={"include": include})
                    
                    if isinstance(league_response, dict):
                        league = league_response.get("data") or league_response
                        if league:
                            current_season = league.get("current_season") or league.get("currentseason")
                            if isinstance(current_season, dict):
                                if "data" in current_season:
                                    current_season = current_season["data"]
                                season_id = current_season.get("id") if isinstance(current_season, dict) else None
                            elif isinstance(current_season, list) and len(current_season) > 0:
                                season_id = current_season[0].get("id") if isinstance(current_season[0], dict) else None
                except Exception as e:
                    logger.debug(f"Error fetching league {league_id} directly: {e}")
                    # Fallback to getting from all leagues
                    include = "currentSeason"
                    leagues = await self.get_leagues(include=include)
                    league = next((l for l in leagues if l.get("id") == league_id), None)
                    
                    if league:
                        current_season = league.get("current_season") or league.get("currentseason")
                        if isinstance(current_season, dict):
                            if "data" in current_season:
                                current_season = current_season["data"]
                            season_id = current_season.get("id") if isinstance(current_season, dict) else None
                        elif isinstance(current_season, list) and len(current_season) > 0:
                            season_id = current_season[0].get("id") if isinstance(current_season[0], dict) else None
            
            # If we have season_id, try season-specific endpoint
            if season_id:
                logger.info(f"Trying season-specific endpoint for league {league_id}, season {season_id}")
                standings_result = await self.get_standings_by_season(season_id)
                if standings_result and standings_result.get("table"):
                    return standings_result
            
            logger.warning(f"No standings found for league {league_id}. No season_id available and no standings in general endpoint.")
            return {}
        except Exception as e:
            logger.error(f"Error fetching standings for league {league_id}: {e}")
            return {}

    def _extract_home_away_teams(self, participants: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extract home and away teams from participants array using meta.location.
        
        Args:
            participants: List of participant objects from Sportmonks V3
            
        Returns:
            Dictionary with 'home' and 'away' team data
        """
        home_team = None
        away_team = None
        
        for participant in participants:
            meta = participant.get("meta", {})
            location = meta.get("location", "").lower()
            
            if location == "home":
                home_team = participant
            elif location == "away":
                away_team = participant
        
        # Fallback: if location not found, use first two participants
        if not home_team and len(participants) >= 1:
            home_team = participants[0]
        if not away_team and len(participants) >= 2:
            away_team = participants[1]
        
        return {
            "home": home_team,
            "away": away_team
        }

    def _extract_scores(self, scores: List[Dict[str, Any]], participants: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extract scores by matching participant_id.
        
        Args:
            scores: List of score objects from Sportmonks V3
            participants: List of participant objects
            
        Returns:
            Dictionary with 'home_score' and 'away_score'
        """
        teams = self._extract_home_away_teams(participants)
        home_participant_id = teams["home"].get("id") if teams["home"] and isinstance(teams["home"], dict) else None
        away_participant_id = teams["away"].get("id") if teams["away"] and isinstance(teams["away"], dict) else None
        
        home_score = None
        away_score = None
        
        # Find CURRENT score (most recent)
        current_scores = [s for s in scores if s.get("description") == "CURRENT"]
        if not current_scores:
            # Fallback to all scores, take the first occurrence for each participant
            current_scores = scores
        
        for score in current_scores:
            if not isinstance(score, dict):
                continue
                
            participant_id = score.get("participant_id")
            score_obj = score.get("score", {})
            
            # Sportmonks V3 score format: {"goals": 1, "participant": "home"}
            if isinstance(score_obj, dict):
                score_value = score_obj.get("goals")
            else:
                # Fallback: if score is directly a number
                score_value = score_obj
            
            if participant_id == home_participant_id:
                home_score = score_value
            elif participant_id == away_participant_id:
                away_score = score_value
        
        return {
            "home_score": home_score,
            "away_score": away_score
        }

    def _extract_and_normalize_odds(self, odds_data: Any, bookmaker_id_filter: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract and normalize odds from Sportmonks V3 format.
        Handles both formats:
        1. Direct list format (already normalized): list of odds with label, value, market_description
        2. Nested format: odds -> data -> array with bookmaker, market, values structure
        
        Args:
            odds_data: Raw odds data from Sportmonks V3 (can be dict, list, or None)
            bookmaker_id_filter: Optional bookmaker ID to filter by (only return odds from this bookmaker)
            
        Returns:
            Normalized list of odds objects with flattened structure
        """
        if not odds_data:
            logger.info("_extract_and_normalize_odds: No odds_data provided")
            return []
        
        # Handle nested format: odds.data
        if isinstance(odds_data, dict):
            if "data" in odds_data:
                odds_data = odds_data["data"]
                logger.info(f"_extract_and_normalize_odds: Extracted odds_data from dict, type: {type(odds_data)}, length: {len(odds_data) if isinstance(odds_data, list) else 'not a list'}")
            else:
                # If it's a dict but no "data" key, try to extract odds from it
                logger.info("_extract_and_normalize_odds: Dict with no 'data' key, returning empty list")
                return []
        
        if not isinstance(odds_data, list):
            logger.info(f"_extract_and_normalize_odds: odds_data is not a list, type: {type(odds_data)}")
            return []
        
        logger.info(f"_extract_and_normalize_odds: Processing {len(odds_data)} odds items")
        normalized_odds = []
        
        # Track if we've logged sample odds (to avoid spam)
        logged_sample = False
        
        # Track Match Winner market specifically for debugging
        match_winner_odds = []
        
        # Track Cards market specifically for debugging
        cards_odds = []
        
        for odd_item in odds_data:
            if not isinstance(odd_item, dict):
                continue
            
            # Check if this is already a normalized format (has label, value directly)
            if "label" in odd_item and "value" in odd_item:
                # Already normalized format - just extract and format
                value_odd = odd_item.get("value")
                if value_odd is None:
                    continue
                
                try:
                    value_odd_float = float(value_odd)
                    if value_odd_float <= 0:
                        continue
                except (ValueError, TypeError):
                    continue
                
                # Extract market name with fallbacks
                market_name = odd_item.get("market_description") or odd_item.get("market_name") or odd_item.get("market")
                if isinstance(market_name, dict):
                    market_name = market_name.get("name") or market_name.get("description")
                
                # Extract bookmaker info - could be nested or flat
                bookmaker = odd_item.get("bookmaker", {})
                if isinstance(bookmaker, dict) and "data" in bookmaker:
                    bookmaker = bookmaker["data"]
                
                # Get bookmaker_id and bookmaker_name from nested structure if available
                if isinstance(bookmaker, dict):
                    bookmaker_id = bookmaker.get("id") or odd_item.get("bookmaker_id")
                    bookmaker_name = bookmaker.get("name") or odd_item.get("bookmaker_name")
                else:
                    bookmaker_id = odd_item.get("bookmaker_id")
                    bookmaker_name = odd_item.get("bookmaker_name")
                
                # Fallback: If bookmaker_name is None but bookmaker_id is 2, use "Bet365"
                if not bookmaker_name and bookmaker_id == 2:
                    bookmaker_name = "Bet365"
                
                # Filter by bookmaker_id if specified
                if bookmaker_id_filter is not None and bookmaker_id != bookmaker_id_filter:
                    continue  # Skip this odd if it doesn't match the filter
                
                # Filter by supported market IDs if filtering for Bet365 (bookmaker ID: 2)
                if bookmaker_id_filter == 2:
                    market_id_val = odd_item.get("market_id")
                    if market_id_val and market_id_val not in BET365_SUPPORTED_MARKET_IDS:
                        continue  # Skip unsupported markets for Bet365
                
                # Log if market name is missing for debugging
                if not market_name or str(market_name).lower() == "unknown":
                    market_id = odd_item.get("market_id")
                    logger.debug(f"Unknown market detected in normalized format - market_id: {market_id}, odd_item keys: {list(odd_item.keys())}")
                
                # Track Match Winner market specifically for debugging
                market_name_lower = (market_name or "").lower()
                if "match winner" in market_name_lower or odd_item.get("market_id") == 1:
                    match_winner_odds.append({
                        "raw": odd_item,
                        "normalized": {
                            "bookmaker_id": bookmaker_id,
                            "bookmaker_name": bookmaker_name,
                            "market_id": odd_item.get("market_id"),
                            "market_name": market_name,
                            "label": odd_item.get("label") or odd_item.get("name") or "",
                            "value": value_odd_float
                        }
                    })
                
                # Track Cards market specifically for debugging
                # Check for various card-related keywords and market IDs
                # Sportmonks card market IDs might be: 83 (Total Cards), 84 (Team Total Cards), etc.
                market_id_val = odd_item.get("market_id")
                is_card_market = (
                    "card" in market_name_lower or 
                    "kart" in market_name_lower or 
                    "booking" in market_name_lower or
                    "yellow" in market_name_lower or
                    "red" in market_name_lower or
                    market_id_val in [83, 84, 85, 86, 87, 88]  # Possible card market IDs
                )
                if is_card_market:
                    cards_odds.append({
                        "raw": odd_item,
                        "normalized": {
                            "bookmaker_id": bookmaker_id,
                            "bookmaker_name": bookmaker_name,
                            "market_id": market_id_val,
                            "market_name": market_name,
                            "label": odd_item.get("label") or odd_item.get("name") or "",
                            "value": value_odd_float
                        }
                    })
                
                # Log first few odds for debugging (to verify bookmaker info)
                if not logged_sample and len(normalized_odds) < 5:
                    # Also log raw bookmaker data for debugging
                    raw_bookmaker = odd_item.get("bookmaker")
                    logger.info(f"Sample normalized odd (normalized format) #{len(normalized_odds)+1}: Bookmaker ID={bookmaker_id}, Bookmaker Name={bookmaker_name}, Market ID={odd_item.get('market_id')}, Market Name={market_name}, Label={odd_item.get('label') or odd_item.get('name') or ''}, Value={value_odd_float}, Raw Bookmaker={type(raw_bookmaker).__name__}")
                    if len(normalized_odds) >= 4:
                        logged_sample = True
                
                # Extract stopped and suspended status
                stopped = odd_item.get("stopped", False)
                suspended = odd_item.get("suspended", False)
                # If either stopped or suspended is true, mark as unavailable
                is_unavailable = odd_item.get("is_unavailable", False)
                active = odd_item.get("active", True)  # Default True if not present
                
                # Selection state filtresi - Bet365 davranışı
                # Eğer herhangi biri true ise, bu bahisi GİZLE
                if stopped or suspended or is_unavailable or not active:
                    continue  # Skip this odd - don't include in results
                
                # Extract timestamp for update comparison
                latest_bookmaker_update = odd_item.get("latest_bookmaker_update")
                updated_at = odd_item.get("updated_at")
                # Use latest_bookmaker_update if available, otherwise updated_at
                timestamp = latest_bookmaker_update or updated_at
                
                normalized_odd = {
                    "bookmaker_id": bookmaker_id,
                    "bookmaker_name": bookmaker_name,
                    "market_id": odd_item.get("market_id"),
                    "market_name": market_name or "Unknown",
                    "market_description": odd_item.get("market_description"),
                    "label": odd_item.get("label") or odd_item.get("name") or "",
                    "name": odd_item.get("name") or odd_item.get("label") or "",
                    "value": value_odd_float,
                    "odd": value_odd_float,
                    "price": value_odd_float,
                    "stopped": stopped,
                    "suspended": suspended,
                    "is_unavailable": is_unavailable,  # True if stopped or suspended
                    "latest_bookmaker_update": timestamp,  # For timestamp guard
                }
                
                normalized_odds.append(normalized_odd)
                continue
            
            # Nested format: extract bookmaker, market, values
            # Extract bookmaker info
            bookmaker = odd_item.get("bookmaker", {})
            if isinstance(bookmaker, dict) and "data" in bookmaker:
                bookmaker = bookmaker["data"]
            
            # Extract market info
            market = odd_item.get("market", {})
            if isinstance(market, dict) and "data" in market:
                market = market["data"]
            
            # Extract values (array of odds values)
            values = odd_item.get("values", [])
            if isinstance(values, dict) and "data" in values:
                values = values["data"]
            if not isinstance(values, list):
                values = []
            
            # Process each value in the values array
            for value_item in values:
                if not isinstance(value_item, dict):
                    continue
                
                # Extract value details
                value_name = value_item.get("name") or value_item.get("label") or value_item.get("outcome", "")
                value_odd = value_item.get("value") or value_item.get("odd") or value_item.get("price")
                
                # Extract participant (player) information if available
                participant_data = value_item.get("participant", {})
                if isinstance(participant_data, dict) and "data" in participant_data:
                    participant_data = participant_data["data"]
                
                # If this is a player-specific odd and we have participant data, use player name
                player_name = None
                player_id = None
                if isinstance(participant_data, dict):
                    player_name = participant_data.get("name")
                    player_id = participant_data.get("id")
                
                # Use player name if available, otherwise use value_name
                final_label = player_name if player_name else value_name
                
                # Skip if no valid value
                if not final_label or value_odd is None:
                    continue
                
                # Try to convert to float
                try:
                    # Handle string values that might be fractional (e.g., "500/1")
                    if isinstance(value_odd, str) and '/' in value_odd:
                        # Fractional odds format: "500/1" -> convert to decimal
                        parts = value_odd.split('/')
                        if len(parts) == 2:
                            numerator = float(parts[0])
                            denominator = float(parts[1])
                            if denominator > 0:
                                value_odd_float = (numerator / denominator) + 1.0  # Convert fractional to decimal
                            else:
                                continue
                        else:
                            value_odd_float = float(value_odd)
                    else:
                        value_odd_float = float(value_odd)
                    
                    if value_odd_float <= 0:
                        continue
                    
                    # Log very high odds for debugging (e.g., > 100)
                    if value_odd_float > 100:
                        logger.debug(f"High odds detected: {value_name} = {value_odd_float} (original: {value_odd}, market: {market.get('name', 'unknown') if isinstance(market, dict) else 'unknown'})")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse odds value: {value_odd} for {value_name}, error: {e}")
                    continue
                
                # Extract market name with fallbacks
                market_name = None
                if isinstance(market, dict):
                    market_name = market.get("name") or market.get("description") or market.get("label")
                if not market_name:
                    market_name = odd_item.get("market_description") or odd_item.get("market_name")
                
                # Log if market name is missing for debugging
                if not market_name or market_name.lower() == "unknown":
                    market_id = market.get("id") if isinstance(market, dict) else odd_item.get("market_id")
                    logger.debug(f"Unknown market detected - market_id: {market_id}, market dict: {market}, odd_item keys: {odd_item.keys()}")
                
                # Build normalized odd object
                bookmaker_id = bookmaker.get("id") if isinstance(bookmaker, dict) else None
                bookmaker_name = bookmaker.get("name") if isinstance(bookmaker, dict) else None
                
                # Fallback: If bookmaker_name is None but bookmaker_id is 2, use "Bet365"
                if not bookmaker_name and bookmaker_id == 2:
                    bookmaker_name = "Bet365"
                
                # Filter by bookmaker_id if specified
                if bookmaker_id_filter is not None and bookmaker_id != bookmaker_id_filter:
                    continue  # Skip this odd if it doesn't match the filter
                
                # Filter by supported market IDs if filtering for Bet365 (bookmaker ID: 2)
                market_id_val = market.get("id") if isinstance(market, dict) else odd_item.get("market_id")
                if bookmaker_id_filter == 2:
                    if market_id_val and market_id_val not in BET365_SUPPORTED_MARKET_IDS:
                        continue  # Skip unsupported markets for Bet365
                
                # Track Match Winner market specifically for debugging
                market_name_lower = (market_name or "").lower()
                if "match winner" in market_name_lower or market_id_val == 1:
                    match_winner_odds.append({
                        "raw": {
                            "odd_item": odd_item,
                            "value_item": value_item,
                            "bookmaker": bookmaker,
                            "market": market
                        },
                        "normalized": {
                            "bookmaker_id": bookmaker_id,
                            "bookmaker_name": bookmaker_name,
                            "market_id": market_id_val,
                            "market_name": market_name,
                            "label": final_label,
                            "value": value_odd_float
                        }
                    })
                
                # Track Cards market specifically for debugging
                # Check for various card-related keywords and market IDs
                is_card_market = (
                    "card" in market_name_lower or 
                    "kart" in market_name_lower or 
                    "booking" in market_name_lower or
                    "yellow" in market_name_lower or
                    "red" in market_name_lower or
                    market_id_val in [83, 84, 85, 86, 87, 88]  # Possible card market IDs
                )
                if is_card_market:
                    cards_odds.append({
                        "raw": {
                            "odd_item": odd_item,
                            "value_item": value_item,
                            "bookmaker": bookmaker,
                            "market": market
                        },
                        "normalized": {
                            "bookmaker_id": bookmaker_id,
                            "bookmaker_name": bookmaker_name,
                            "market_id": market_id_val,
                            "market_name": market_name,
                            "label": final_label,
                            "value": value_odd_float
                        }
                    })
                
                # Log first few odds for debugging (to verify bookmaker info)
                if not logged_sample and len(normalized_odds) < 5:
                    logger.info(f"Sample normalized odd (nested format) #{len(normalized_odds)+1}: Bookmaker ID={bookmaker_id}, Bookmaker Name={bookmaker_name}, Market ID={market.get('id') if isinstance(market, dict) else odd_item.get('market_id')}, Market Name={market_name}, Label={final_label}, Value={value_odd_float}")
                    if len(normalized_odds) >= 4:
                        logged_sample = True
                
                # Extract stopped and suspended status
                stopped = odd_item.get("stopped", False)
                suspended = odd_item.get("suspended", False)
                # Check is_unavailable from value_item as well
                is_unavailable = value_item.get("is_unavailable", False) or odd_item.get("is_unavailable", False)
                active = value_item.get("active", True)  # Default True if not present
                if active is True:  # Also check odd_item level
                    active = odd_item.get("active", True)
                
                # Selection state filtresi - Bet365 davranışı
                # Eğer herhangi biri true ise, bu bahisi GİZLE
                if stopped or suspended or is_unavailable or not active:
                    continue  # Skip this odd - don't include in results
                
                # Extract timestamp for update comparison
                latest_bookmaker_update = odd_item.get("latest_bookmaker_update")
                updated_at = odd_item.get("updated_at")
                # Use latest_bookmaker_update if available, otherwise updated_at
                timestamp = latest_bookmaker_update or updated_at
                
                normalized_odd = {
                    "bookmaker_id": bookmaker_id,
                    "bookmaker_name": bookmaker_name,
                    "market_id": market.get("id") if isinstance(market, dict) else odd_item.get("market_id"),
                    "market_name": market_name or "Unknown",
                    "market_description": market.get("description") if isinstance(market, dict) else odd_item.get("market_description"),
                    "label": final_label,
                    "name": final_label,
                    "value": value_odd_float,
                    "odd": value_odd_float,
                    "price": value_odd_float,
                    "stopped": stopped,
                    "suspended": suspended,
                    "is_unavailable": is_unavailable,  # True if stopped or suspended
                    "latest_bookmaker_update": timestamp,  # For timestamp guard
                    "player_id": player_id,
                    "player_name": player_name,
                }
                
                normalized_odds.append(normalized_odd)
        
        # Log Match Winner odds specifically for debugging
        if match_winner_odds:
            logger.info(f"=== MATCH WINNER ODDS DEBUG ({len(match_winner_odds)} items) ===")
            for i, mw_odd in enumerate(match_winner_odds, 1):
                norm = mw_odd.get("normalized", {})
                logger.info(f"Match Winner #{i}: Label='{norm.get('label')}', Value={norm.get('value')}, Bookmaker ID={norm.get('bookmaker_id')}, Bookmaker Name='{norm.get('bookmaker_name')}', Market ID={norm.get('market_id')}, Market Name='{norm.get('market_name')}'")
                # Log raw data for first item to see structure
                if i == 1:
                    raw = mw_odd.get("raw", {})
                    logger.info(f"  Raw data sample (first item): {str(raw)[:500]}")  # Limit to 500 chars
            logger.info("=== END MATCH WINNER ODDS DEBUG ===")
        
        # Log Cards odds specifically for debugging
        if cards_odds:
            logger.info(f"=== CARDS MARKET DEBUG ({len(cards_odds)} items) ===")
            for i, card_odd in enumerate(cards_odds, 1):
                norm = card_odd.get("normalized", {})
                logger.info(f"Cards Market #{i}: Market Name='{norm.get('market_name')}', Label='{norm.get('label')}', Value={norm.get('value')}, Bookmaker ID={norm.get('bookmaker_id')}, Bookmaker Name='{norm.get('bookmaker_name')}', Market ID={norm.get('market_id')}")
                # Log raw data for first item to see structure
                if i == 1:
                    raw = card_odd.get("raw", {})
                    logger.info(f"  Raw data sample (first item): {str(raw)[:500]}")  # Limit to 500 chars
            logger.info("=== END CARDS MARKET DEBUG ===")
        
        logger.info(f"_extract_and_normalize_odds: Returning {len(normalized_odds)} normalized odds")
        return normalized_odds

    def _build_selection_key(self, odd: Dict[str, Any]) -> str:
        """
        Build unique key for selection: market_id + label + line + participant_id
        Used for snapshot diff comparison.
        
        Args:
            odd: Normalized odd object
            
        Returns:
            Unique selection key string
        """
        market_id = odd.get("market_id", "")
        label = odd.get("label") or odd.get("name") or ""
        line = odd.get("line") or odd.get("handicap") or odd.get("total") or ""
        participant_id = odd.get("participant_id") or odd.get("player_id") or ""
        return f"{market_id}_{label}_{line}_{participant_id}"

    def _filter_by_snapshot_diff(
        self,
        normalized_odds: List[Dict[str, Any]], 
        previous_snapshot: Optional[Dict[str, Any]] = None,
        match_status: str = "LIVE"
    ) -> List[Dict[str, Any]]:
        """
        Filter odds by snapshot diff - hide odds that disappeared from snapshot.
        Bet365 behavior: If an odd was in previous snapshot but not in current, hide it.
        
        Grace periods:
        - LIVE: 20 seconds
        - HT: 60 seconds  
        - FT: 5 seconds
        
        Args:
            normalized_odds: Current normalized odds list
            previous_snapshot: Previous snapshot from Firebase (contains odds list)
            match_status: Match status (LIVE, HT, FT)
            
        Returns:
            Filtered odds list
        """
        if not previous_snapshot:
            return normalized_odds
        
        from datetime import datetime, timezone
        
        # Determine grace period based on match status
        status_upper = (match_status or "").upper()
        if status_upper == "HT":
            grace_period_seconds = 60
        elif status_upper == "FT":
            grace_period_seconds = 5
        else:  # LIVE or other
            grace_period_seconds = 20
        
        # Build selection key map from previous snapshot
        previous_keys = set()
        previous_odds = previous_snapshot.get("odds", [])
        if isinstance(previous_odds, list):
            for prev_odd in previous_odds:
                if isinstance(prev_odd, dict):
                    key = self._build_selection_key(prev_odd)
                    if key:
                        previous_keys.add(key)
        
        # Filter current odds - only keep if:
        # 1. Was in previous snapshot, OR
        # 2. Has recent update timestamp (within grace period)
        filtered_odds = []
        now = datetime.now(timezone.utc)
        
        for odd in normalized_odds:
            if not isinstance(odd, dict):
                continue
            
            key = self._build_selection_key(odd)
            
            # If was in previous snapshot, keep it
            if key in previous_keys:
                filtered_odds.append(odd)
                continue
            
            # If not in previous, check if it has recent update
            timestamp_str = odd.get("latest_bookmaker_update")
            if timestamp_str:
                try:
                    if isinstance(timestamp_str, str):
                        # Parse timestamp (could be ISO format or other)
                        if 'T' in timestamp_str or ' ' in timestamp_str:
                            # Try ISO format
                            update_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            # Try other formats
                            update_time = datetime.fromisoformat(timestamp_str)
                        time_diff = (now - update_time).total_seconds()
                        if time_diff <= grace_period_seconds:
                            filtered_odds.append(odd)
                except Exception as e:
                    logger.debug(f"Error parsing timestamp for snapshot diff: {e}")
                    # If timestamp parsing fails, include the odd (safer)
                    filtered_odds.append(odd)
            else:
                # No timestamp - include it (safer)
                filtered_odds.append(odd)
        
        return filtered_odds

    def _group_odds_by_market_line(
        self,
        odds: List[Dict[str, Any]], 
        home_team_id: Optional[int] = None,
        away_team_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Group odds by market + line + direction for proper display (Bet365 behavior).
        For Over/Under markets: Group Over + Under together by line.
        For Handicap markets: Group Home + Away together by line.
        
        Args:
            odds: List of normalized odds
            home_team_id: Optional home team ID for handicap markets
            away_team_id: Optional away team ID for handicap markets
            
        Returns:
            Grouped structure:
            {
                "market_id": 5,
                "market_name": "Over/Under 2.5",
                "line": 2.5,
                "selections": {
                    "over": {...odd...},
                    "under": {...odd...}
                }
            }
        """
        if not isinstance(odds, list):
            return []
        
        # Market bazında grupla
        market_groups = {}
        
        for odd in odds:
            if not isinstance(odd, dict):
                continue
            
            market_id = odd.get("market_id")
            market_name = odd.get("market_name", "")
            label = (odd.get("label") or odd.get("name") or "").lower()
            
            # Line marketler için (Over/Under, Total Goals)
            line = odd.get("line") or odd.get("total")
            if line is not None:
                try:
                    line_float = float(line)
                    # Line market - group by market_id + line
                    key = f"{market_id}_{line_float}"
                    if key not in market_groups:
                        market_groups[key] = {
                            "market_id": market_id,
                            "market_name": market_name,
                            "line": line_float,
                            "selections": {
                                "over": None,
                                "under": None
                            }
                        }
                    
                    # Determine direction (Over/Under)
                    if "over" in label or "üst" in label or "over" in market_name.lower():
                        market_groups[key]["selections"]["over"] = odd
                    elif "under" in label or "alt" in label or "under" in market_name.lower():
                        market_groups[key]["selections"]["under"] = odd
                except (ValueError, TypeError):
                    pass
            
            # Handicap marketler için
            handicap = odd.get("handicap")
            if handicap is not None:
                try:
                    handicap_float = float(handicap)
                    abs_handicap = abs(handicap_float)
                    # Handicap market - group by market_id + abs(handicap)
                    key = f"{market_id}_handicap_{abs_handicap}"
                    if key not in market_groups:
                        market_groups[key] = {
                            "market_id": market_id,
                            "market_name": market_name,
                            "handicap": abs_handicap,
                            "selections": {
                                "home": None,
                                "away": None
                            }
                        }
                    
                    # Determine participant (Home/Away)
                    participant_id = odd.get("participant_id") or odd.get("player_id")
                    if participant_id:
                        # Check if home or away based on participant_id
                        if home_team_id and participant_id == home_team_id:
                            market_groups[key]["selections"]["home"] = odd
                        elif away_team_id and participant_id == away_team_id:
                            market_groups[key]["selections"]["away"] = odd
                    else:
                        # Try to infer from label
                        if "home" in label or "1" in label:
                            market_groups[key]["selections"]["home"] = odd
                        elif "away" in label or "2" in label:
                            market_groups[key]["selections"]["away"] = odd
                except (ValueError, TypeError):
                    pass
        
        # Convert to list and filter out groups with no selections
        grouped_odds = []
        for group in market_groups.values():
            # Only include groups that have at least one selection
            has_selections = any(
                selection is not None 
                for selection in group.get("selections", {}).values()
            )
            if has_selections:
                grouped_odds.append(group)
        
        return grouped_odds

    def _filter_statistics_by_period(
        self,
        statistics: List[Dict[str, Any]],
        match_status: str,
        is_live: bool,
        is_finished: bool
    ) -> List[Dict[str, Any]]:
        """
        Filter statistics by period based on match status.
        Bet365 behavior:
        - LIVE: period == ALL || TOTAL
        - HT: period == 1ST_HALF
        - FT: period == ALL
        
        Args:
            statistics: List of statistics objects from Sportmonks V3
            match_status: Match status (LIVE, HT, FT, etc.)
            is_live: Whether match is live
            is_finished: Whether match is finished
            
        Returns:
            Filtered list of statistics
        """
        if not isinstance(statistics, list):
            return []
        
        filtered_stats = []
        status_upper = (match_status or "").upper()
        
        for stat in statistics:
            if not isinstance(stat, dict):
                continue
            
            # Extract period information
            period = stat.get("period")
            period_id = stat.get("period_id")
            period_name = (stat.get("period_name") or "").upper()
            
            # Also check in type object if available
            stat_type = stat.get("type", {})
            if isinstance(stat_type, dict):
                if "data" in stat_type:
                    stat_type = stat_type["data"]
                if isinstance(stat_type, dict):
                    period_name = period_name or (stat_type.get("period_name") or "").upper()
            
            # Filter based on match status
            if is_live and not is_finished:
                # Live match - only show ALL/TOTAL period
                if period_name in ["ALL", "TOTAL", "FULL_TIME", "FULLTIME"] or period == "all" or period_id == "all":
                    filtered_stats.append(stat)
            elif status_upper == "HT":
                # Half-time - only show 1ST_HALF
                if period_name in ["1ST_HALF", "FIRST_HALF", "HALF_1", "FIRST"] or period == "1st_half" or period_id == "1st_half":
                    filtered_stats.append(stat)
            elif is_finished:
                # Finished - show ALL/TOTAL
                if period_name in ["ALL", "TOTAL", "FULL_TIME", "FULLTIME"] or period == "all" or period_id == "all":
                    filtered_stats.append(stat)
            else:
                # Pre-match or unknown status - show all statistics
                filtered_stats.append(stat)
        
        return filtered_stats

    def _filter_and_dedup_events(self, events_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter events by type_id and deduplicate.
        Only shows events that Bet365 would show (GOAL, CARD, SUBSTITUTION, PENALTY, VAR).
        Event key: event_id or type + minute + participant
        
        Args:
            events_data: List of event objects from Sportmonks V3
            
        Returns:
            Filtered and deduplicated list of events
        """
        if not isinstance(events_data, list):
            return []
        
        filtered_events = []
        seen_event_keys = set()
        
        for event in events_data:
            if not isinstance(event, dict):
                continue
            
            # Extract type_id
            type_id = event.get("type_id")
            if type_id is None:
                # Try to get from nested type object
                event_type = event.get("type", {})
                if isinstance(event_type, dict):
                    if "data" in event_type:
                        event_type = event_type["data"]
                    if isinstance(event_type, dict):
                        type_id = event_type.get("id")
            
            # Filter by allowed type_ids
            if type_id not in ALLOWED_EVENT_TYPE_IDS:
                continue  # Skip technical/internal events
            
            # Dedup: event_id veya type + minute + participant
            event_id = event.get("id")
            minute = event.get("minute")
            participant_id = event.get("participant_id")
            
            if event_id:
                event_key = f"event_{event_id}"
            else:
                event_key = f"{type_id}_{minute}_{participant_id}"
            
            # Skip duplicate
            if event_key in seen_event_keys:
                continue
            
            seen_event_keys.add(event_key)
            filtered_events.append(event)
        
        return filtered_events

    def _format_time_status(
        self,
        time_data: Dict[str, Any],
        current_period: Optional[Dict[str, Any]] = None,
        periods: Optional[List[Dict[str, Any]]] = None,
        updated_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Format time status and minute from Sportmonks V3 time object and currentPeriod.
        Prioritizes time_data.minute for reliability, then currentPeriod, then periods array.
        
        Args:
            time_data: Time object from Sportmonks V3 (contains status, minute, etc.)
            current_period: CurrentPeriod object from Sportmonks V3 (contains minutes, seconds, ticking, time_added, has_timer)
            periods: List of periods from Sportmonks V3 (fallback if currentPeriod not available)
            
        Returns:
            Dictionary with formatted status, minute, is_live, is_finished, time_added, ticking, has_timer
        """
        if not isinstance(time_data, dict):
            time_data = {}
        
        # Extract currentPeriod data if available
        period_minutes = None
        period_seconds = None
        time_added = None
        ticking = None
        has_timer = None
        
        if current_period and isinstance(current_period, dict):
            period_minutes = current_period.get("minutes")
            period_seconds = current_period.get("seconds")
            time_added = current_period.get("time_added")
            ticking = current_period.get("ticking", True)  # Default to True if not specified
            has_timer = current_period.get("has_timer", True)  # Default to True if not specified
        
        # If currentPeriod not available, try to find active period from periods array
        if not current_period and periods and isinstance(periods, list) and len(periods) > 0:
            # Find the current/active period (usually the last one or one with ticking=true)
            for period in reversed(periods):  # Check from most recent
                if isinstance(period, dict):
                    # Prefer period with ticking=true or has_timer=true
                    if period.get("ticking") is True or period.get("has_timer") is True:
                        period_minutes = period.get("minutes")
                        period_seconds = period.get("seconds")
                        time_added = period.get("time_added")
                        ticking = period.get("ticking", True)
                        has_timer = period.get("has_timer", True)
                        break
            # If no ticking period found, use the last period
            if period_minutes is None and periods:
                last_period = periods[-1] if isinstance(periods[-1], dict) else None
                if last_period:
                    period_minutes = last_period.get("minutes")
                    period_seconds = last_period.get("seconds")
                    time_added = last_period.get("time_added")
                    ticking = last_period.get("ticking", True)
                    has_timer = last_period.get("has_timer", True)
        
        status = time_data.get("status", "")
        if status:
            status = status.upper()
        
        # HT detection - multiple sources (SportMonks behavior)
        # HT is a state, not a time - check multiple indicators
        is_ht = False
        
        # Check status field
        if status in ["HT", "HALF_TIME", "BREAK"]:
            is_ht = True
        
        # Check periods/currentPeriod for break indicators
        if current_period and isinstance(current_period, dict):
            period_type = current_period.get("type", {})
            if isinstance(period_type, dict):
                if "data" in period_type:
                    period_type = period_type["data"]
                if isinstance(period_type, dict):
                    period_type_name = (period_type.get("name") or "").upper()
                    if "BREAK" in period_type_name or "HALF_TIME" in period_type_name:
                        is_ht = True
        
        # Check periods array for break indicators
        if periods and isinstance(periods, list):
            for period in periods:
                if isinstance(period, dict):
                    period_type = period.get("type", {})
                    if isinstance(period_type, dict):
                        if "data" in period_type:
                            period_type = period_type["data"]
                        if isinstance(period_type, dict):
                            period_type_name = (period_type.get("name") or "").upper()
                            if "BREAK" in period_type_name or "HALF_TIME" in period_type_name:
                                is_ht = True
                                break
        
        # If HT detected, override status and ensure proper state
        if is_ht:
            status = "HT"
            is_live = False
            minute = None  # HT is a state, not a time - don't show minute
            time_added = None
            ticking = False
            has_timer = False
            should_tick = False
        
        # Priority: 1) time_data.minute (most reliable), 2) period_minutes, 3) None
        # time_data.minute is often more up-to-date than currentPeriod
        # BUT: Don't use minute if HT (already set to None above)
        if not is_ht:
            minute = time_data.get("minute")
            if minute is None:
                minute = period_minutes
        
        # Convert minute to integer if it's a string or number
        if minute is not None:
            try:
                # Handle string values like "45", "90+3", "HT", etc.
                if isinstance(minute, str):
                    # Remove any non-numeric characters except + (for extra time)
                    # Examples: "45" -> 45, "90+3" -> 93, "HT" -> None
                    if '+' in minute:
                        # Handle extra time: "90+3" -> 93
                        parts = minute.split('+')
                        if len(parts) == 2:
                            base_minute = int(parts[0])
                            extra_minute = int(parts[1])
                            minute = base_minute + extra_minute
                        else:
                            minute = int(parts[0]) if parts[0].isdigit() else None
                    elif minute.isdigit():
                        minute = int(minute)
                    else:
                        # Non-numeric strings like "HT", "FT" -> None
                        minute = None
                elif isinstance(minute, (int, float)):
                    minute = int(minute)
                else:
                    minute = None
            except (ValueError, TypeError):
                minute = None
        
        # Convert time_added to integer if available
        if time_added is not None:
            try:
                if isinstance(time_added, str):
                    time_added = int(time_added) if time_added.isdigit() else None
                elif isinstance(time_added, (int, float)):
                    time_added = int(time_added)
                else:
                    time_added = None
            except (ValueError, TypeError):
                time_added = None
        
        # If time_data is empty, check if we can infer from other fields
        # Sportmonks V3 might not always provide time object for livescores
        # In that case, we'll use default values and let frontend handle it
        
        # Determine match state based on status
        # Note: is_ht already set above if HT detected
        is_live = False
        is_finished = False
        is_postponed = False
        
        if status:
            # HT (Half Time) and BREAK are not live - match is paused
            # Only actively playing statuses are considered live
            if not is_ht:  # Don't set is_live if HT
                is_live = status in ["LIVE", "ET", "PEN", "1ST_HALF", "2ND_HALF", "INPLAY", "IN_PLAY"]
            # Finished statuses: FT, FINISHED, AET, FT_PEN (HT is NOT finished, it's just a break)
            is_finished = status in ["FT", "AET", "FT_PEN", "FINISHED", "AWARDED"]
            is_postponed = status in ["POSTP", "CANCL", "CANCELED", "CANCELLED"]
        
        # If HT, ensure proper state (already set above, but double-check)
        if is_ht:
            is_live = False
            is_finished = False
            minute = None
            time_added = None
            ticking = False
            has_timer = False
            should_tick = False
        
        # If match is finished, don't show minute (set to None)
        # This prevents showing stale minute values (e.g., 78) for finished matches
        if is_finished:
            minute = None
            time_added = None
        
        # Timer çalıştırma kuralı - Bet365 davranışı
        # Timer sadece şu durumlarda çalışır:
        # - status === LIVE && !stopped && !suspended && ticking === true && has_timer === true
        # HT durumunda timer durur (already set above)
        if not is_ht:
            stopped = time_data.get("stopped", False)
            suspended = time_data.get("suspended", False)
            
            should_tick = (
                status == "LIVE" and
                not stopped and
                not suspended and
                ticking is True and
                has_timer is True
            )
        
        # HT/FT durumunda timer durur (double-check)
        if status in ["HT", "FT"] or is_ht:
            should_tick = False
            ticking = False
        
        return {
            "status": status,
            "minute": minute,
            "seconds": period_seconds,  # Include seconds from currentPeriod
            "time_added": time_added,  # Injury time (for "45+X" format) - fixed, timer not added
            "ticking": ticking,  # Whether timer is ticking (false during breaks)
            "has_timer": has_timer,  # Whether timer is available
            "should_tick": should_tick,  # Whether timer should tick (Bet365 behavior)
            "updated_at": updated_at,  # Anchor time for frontend timer calculation (ISO format)
            "is_live": is_live,
            "is_finished": is_finished,
            "is_postponed": is_postponed
        }

    def _transform_livescore_to_match(self, livescore: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform Sportmonks V3 livescore to frontend match format.
        
        Args:
            livescore: Livescore object from Sportmonks V3
            
        Returns:
            Transformed match dictionary for frontend
        """
        # Extract participants - handle nested format
        participants = livescore.get("participants", [])
        if isinstance(participants, dict) and "data" in participants:
            participants = participants["data"]
        if not isinstance(participants, list):
            participants = []
        
        teams = self._extract_home_away_teams(participants)
        
        home_team = teams["home"] or {}
        away_team = teams["away"] or {}
        
        # Extract scores - handle nested format
        scores_data = livescore.get("scores", [])
        if isinstance(scores_data, dict) and "data" in scores_data:
            scores_data = scores_data["data"]
        if not isinstance(scores_data, list):
            scores_data = []
        
        scores = self._extract_scores(scores_data, participants)
        
        # Extract events - handle nested format (needed for time inference)
        events_data = livescore.get("events", [])
        if isinstance(events_data, dict) and "data" in events_data:
            events_data = events_data["data"]
        if not isinstance(events_data, list):
            events_data = []
        
        # Filter and deduplicate events (Bet365 shows only specific event types)
        events_data = self._filter_and_dedup_events(events_data)
        
        # Extract time status - handle nested format
        time_data = livescore.get("time", {})
        if isinstance(time_data, dict) and "data" in time_data:
            time_data = time_data["data"]
        if not isinstance(time_data, dict):
            time_data = {}
        
        # Extract state_id - Sportmonks state_id is reliable for determining match status
        # state_id: 1=Not Started, 2=Live, 3=Period Break, 4=Finished, 5=Finished, 6=Postponed, 7=Cancelled
        state_id = livescore.get("state_id")
        
        # Determine status from state_id if time_data is empty or status is missing
        # This is more reliable than inferring from other fields
        if (not time_data.get("status") or time_data.get("status") == "") and state_id:
            if state_id == 1:
                time_data["status"] = "NS"  # Not Started
            elif state_id == 2:
                time_data["status"] = "LIVE"  # Live
            elif state_id in [3, 8, 10]:
                time_data["status"] = "HT"  # Half Time / Break
            elif state_id in [4, 5]:
                time_data["status"] = "FT"  # Full Time
            elif state_id == 6:
                time_data["status"] = "POSTP"  # Postponed
            elif state_id == 7:
                time_data["status"] = "CANCL"  # Cancelled
        
        # Extract currentPeriod - handle nested format (more accurate for live matches)
        current_period = livescore.get("currentPeriod", {})
        if isinstance(current_period, dict) and "data" in current_period:
            current_period = current_period["data"]
        if not isinstance(current_period, dict):
            current_period = None
        
        # Extract periods - handle nested format (more comprehensive than currentPeriod)
        periods_data = livescore.get("periods", {})
        if isinstance(periods_data, dict) and "data" in periods_data:
            periods_data = periods_data["data"]
        if not isinstance(periods_data, list):
            periods_data = []
        
        # Use first period as currentPeriod if currentPeriod not available
        if not current_period and periods_data and len(periods_data) > 0:
            # Find the current/active period (usually the last one or one with ticking=true)
            for period in reversed(periods_data):  # Check from most recent
                if isinstance(period, dict):
                    # Prefer period with ticking=true or has_timer=true
                    if period.get("ticking") is True or period.get("has_timer") is True:
                        current_period = period
                        break
            # If no ticking period found, use the last period
            if not current_period and periods_data:
                current_period = periods_data[-1] if isinstance(periods_data[-1], dict) else None
        
        # Check starting_at first to determine if match has started and convert to Turkey timezone
        starting_at = livescore.get("starting_at")
        commence_time_turkey = None
        start_dt = None
        
        if starting_at:
            from datetime import datetime, timezone, timedelta
            try:
                # Parse starting_at (usually in UTC)
                if isinstance(starting_at, str):
                    # Try to parse ISO format
                    if 'Z' in starting_at or '+00:00' in starting_at:
                        start_dt = datetime.fromisoformat(starting_at.replace('Z', '+00:00'))
                    else:
                        # Assume UTC if no timezone
                        start_dt = datetime.fromisoformat(starting_at.replace(' ', 'T'))
                        if start_dt.tzinfo is None:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                else:
                    start_dt = starting_at
                    if start_dt.tzinfo is None:
                        start_dt = start_dt.replace(tzinfo=timezone.utc)
                
                # Convert to Turkey timezone (UTC+3)
                turkey_tz = timezone(timedelta(hours=3))
                start_dt_turkey = start_dt.astimezone(turkey_tz)
                commence_time_turkey = start_dt_turkey.strftime("%Y-%m-%d %H:%M:%S")
            except Exception as e:
                logger.warning(f"Error parsing starting_at in livescore: {e}")
                commence_time_turkey = starting_at if isinstance(starting_at, str) else None
        
        # If time_data is empty, try to infer from events and starting_at
        if not time_data or not time_data.get("status"):
            # Check if match has finished based on starting_at + duration
            match_is_finished = False
            if start_dt:
                try:
                    from datetime import datetime, timezone, timedelta
                    # Match duration is typically 90 minutes + extra time
                    match_duration = timedelta(minutes=105)  # 90 + 15 extra time buffer
                    match_end_time = start_dt + match_duration
                    now_utc = datetime.now(timezone.utc)
                    
                    # If match ended more than 5 minutes ago and has scores, it's finished
                    if now_utc > match_end_time and (scores.get("home_score") is not None or scores.get("away_score") is not None):
                        match_is_finished = True
                        time_data["status"] = "FT"
                        time_data["is_finished"] = True
                except Exception as e:
                    logger.debug(f"Could not determine match finish status from starting_at: {e}")
            
            # Only set LIVE if match is not finished
            if not match_is_finished:
                # Check if there are events (indicates match is live or finished)
                if events_data and len(events_data) > 0:
                    # Get the latest event to determine status
                    latest_event = max(events_data, key=lambda e: e.get("minute", 0) if isinstance(e, dict) else 0)
                    if isinstance(latest_event, dict):
                        latest_minute = latest_event.get("minute")
                        if latest_minute is not None:
                            time_data["minute"] = latest_minute
                            # Only set LIVE if minute is reasonable and match hasn't finished
                            if latest_minute > 0 and latest_minute < 120 and not match_is_finished:
                                time_data["status"] = "LIVE"
                
                # If no status from events, check starting_at
                if not time_data.get("status") and start_dt:
                    try:
                        from datetime import datetime, timezone
                        now = datetime.now(timezone.utc)
                        if start_dt <= now and not match_is_finished:
                            # Match has started and not finished - only set LIVE if we have scores or events
                            if (scores.get("home_score") is not None or scores.get("away_score") is not None) or events_data:
                                time_data["status"] = "LIVE"
                    except Exception as e:
                        logger.debug(f"Could not determine match status from starting_at: {e}")
        
        # If minute is still null/undefined and we have events, try to extract from events
        # This helps when time_data.minute is missing but match is live
        if (time_data.get("minute") is None or time_data.get("minute") == "") and events_data and len(events_data) > 0:
            try:
                # Get the latest event with a valid minute
                valid_events = [e for e in events_data if isinstance(e, dict) and e.get("minute") is not None]
                if valid_events:
                    latest_event = max(valid_events, key=lambda e: e.get("minute", 0))
                    latest_minute = latest_event.get("minute")
                    if latest_minute is not None:
                        # Only use if minute is reasonable (0-120)
                        try:
                            minute_int = int(latest_minute) if isinstance(latest_minute, (int, float)) else int(str(latest_minute).split('+')[0])
                            if 0 <= minute_int <= 120:
                                time_data["minute"] = latest_minute
                                logger.debug(f"Extracted minute {latest_minute} from events for match {livescore.get('id')}")
                        except (ValueError, TypeError):
                            pass
            except Exception as e:
                logger.debug(f"Could not extract minute from events: {e}")
        
        # Extract updated_at for anchor time (frontend timer calculation)
        updated_at = livescore.get("updated_at") or livescore.get("last_update")
        
        # Format time status using currentPeriod if available (more accurate)
        time_status = self._format_time_status(time_data, current_period=current_period, periods=periods_data, updated_at=updated_at)
        
        # Override status based on state_id if available (more reliable)
        # state_id: 1=Not Started, 2=Live, 3=Period Break, 4=Finished, 5=Finished, 6=Postponed, 7=Cancelled
        # Additional state_ids: 8=Interrupted, 9=Abandoned, 10=Suspended, 11=Awaiting
        if state_id == 2:
            # state_id == 2 means match is definitely live
            time_status["is_live"] = True
            time_status["is_finished"] = False
            if not time_status.get("status") or time_status.get("status") not in ["LIVE", "ET", "PEN", "1ST_HALF", "2ND_HALF", "INPLAY", "IN_PLAY"]:
                time_status["status"] = "LIVE"
        elif state_id == 3:
            # state_id == 3 means half-time break
            time_status["is_live"] = False
            time_status["is_finished"] = False
            time_status["status"] = "HT"
        elif state_id in [4, 5]:
            # state_id in [4, 5] means finished
            time_status["is_finished"] = True
            time_status["is_live"] = False
            if not time_status.get("status") or time_status.get("status") not in ["FT", "AET", "FT_PEN", "FINISHED"]:
                time_status["status"] = "FT"
        elif state_id in [8, 10]:
            # state_id 8=Interrupted, 10=Suspended - treat as break/not live
            time_status["is_live"] = False
            time_status["is_finished"] = False
            if not time_status.get("status") or time_status.get("status") not in ["HT", "SUSP", "INT"]:
                time_status["status"] = "SUSP"
        elif state_id == 9:
            # state_id 9=Abandoned - treat as finished
            time_status["is_finished"] = True
            time_status["is_live"] = False
            time_status["status"] = "ABAN"
        elif state_id not in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]:
            # Unknown state_id - log warning and rely on other indicators
            logger.warning(f"Unknown state_id {state_id} for match {livescore.get('id')}, relying on other indicators")
        
        # Additional check: if we have scores or events and match has started, consider it live
        # This catches cases where state_id might not be set correctly
        if not time_status.get("is_finished", False) and not time_status.get("is_live", False):
            # Check if match has scores (indicates it has started)
            has_scores = (scores.get("home_score") is not None and scores.get("home_score") > 0) or \
                        (scores.get("away_score") is not None and scores.get("away_score") > 0)
            # Check if match has events (indicates activity)
            has_events = events_data and len(events_data) > 0
            # Check if match has started (starting_at is in the past)
            has_started = False
            if start_dt:
                try:
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    has_started = start_dt <= now
                except:
                    pass
            
            # If match has started and has scores or events, and not finished, it's likely live
            # BUT: Don't set is_live=True if state_id is 3 (HT/Period Break) or 6 (Postponed) or 7 (Cancelled)
            if has_started and (has_scores or has_events) and state_id not in [3, 4, 5, 6, 7]:
                time_status["is_live"] = True
                if not time_status.get("status") or time_status.get("status") in ["NS", ""]:
                    time_status["status"] = "LIVE"
        
        # Double-check: if match is finished, ensure is_live is False
        if time_status.get("is_finished", False):
            time_status["is_live"] = False
        
        # Double-check: if match is in HT/Period Break (state_id == 3), ensure is_live is False
        if state_id == 3:
            time_status["is_live"] = False
        
        # Ensure minute is None if match is finished or HT (prevent showing stale minute values)
        # HT is a state, not a time - don't show minute during HT
        final_minute = time_status.get("minute")
        status_upper = (time_status.get("status", "") or "").upper()
        if time_status.get("is_finished", False):
            final_minute = None
        elif status_upper in ["HT", "HALF_TIME", "BREAK"]:
            final_minute = None  # HT is a state, not a time
        
        # Extract league info - handle nested format
        league_data = livescore.get("league", {})
        if isinstance(league_data, dict) and "data" in league_data:
            league_data = league_data["data"]
        
        # Extract and normalize odds - prioritize inplayOdds for live matches
        # For live matches, inplayOdds is more accurate than prematch odds
        raw_odds_data = livescore.get("inplayOdds", {})
        if not raw_odds_data or (isinstance(raw_odds_data, dict) and not raw_odds_data.get("data")):
            # Fallback to regular odds if inplayOdds not available
            raw_odds_data = livescore.get("odds", {})
        odds_data = self._extract_and_normalize_odds(raw_odds_data, bookmaker_id_filter=2)
        
        # Group odds by market + line + direction (Bet365 behavior)
        odds_grouped = self._group_odds_by_market_line(
            odds_data,
            home_team_id=home_team.get("id") if isinstance(home_team, dict) else None,
            away_team_id=away_team.get("id") if isinstance(away_team, dict) else None
        )
        
        # Build transformed match
        transformed = {
            "id": str(livescore.get("id", "")),
            "sportmonks_id": livescore.get("id"),
            "home_team": home_team.get("name", "Home Team") if isinstance(home_team, dict) else "Home Team",
            "away_team": away_team.get("name", "Away Team") if isinstance(away_team, dict) else "Away Team",
            "home_team_id": home_team.get("id") if isinstance(home_team, dict) else None,
            "away_team_id": away_team.get("id") if isinstance(away_team, dict) else None,
            "home_team_logo": home_team.get("image_path") if isinstance(home_team, dict) else None,
            "away_team_logo": away_team.get("image_path") if isinstance(away_team, dict) else None,
            "home_score": scores.get("home_score"),
            "away_score": scores.get("away_score"),
            "league": league_data.get("name", "") if isinstance(league_data, dict) else "",
            "league_id": league_data.get("id") if isinstance(league_data, dict) else None,
            "league_logo": league_data.get("image_path") if isinstance(league_data, dict) else None,
            "country": league_data.get("country", {}).get("name", "") if isinstance(league_data, dict) and isinstance(league_data.get("country"), dict) else "",
            "status": time_status.get("status", ""),
            "minute": final_minute,
            "seconds": time_status.get("seconds"),  # Seconds from currentPeriod
            "time_added": time_status.get("time_added"),  # Injury time for "45+X" format
            "ticking": time_status.get("ticking"),  # Whether timer is ticking
            "has_timer": time_status.get("has_timer"),  # Whether timer is available
            "should_tick": time_status.get("should_tick", False),  # Whether timer should tick (Bet365 behavior)
            "is_live": time_status.get("is_live", False),
            "is_finished": time_status.get("is_finished", False),
            "is_postponed": time_status.get("is_postponed", False),
            "commence_time": commence_time_turkey or livescore.get("starting_at"),
            "events": events_data if isinstance(events_data, list) else [],
            "odds": odds_data,  # Flat list for backward compatibility
            "odds_grouped": odds_grouped if isinstance(odds_grouped, list) else [],  # Grouped structure (Bet365 behavior)
            "currentPeriod": current_period,  # Store currentPeriod for frontend
            "periods": periods_data,  # Store all periods for frontend (more comprehensive)
            "participants": participants,  # Keep for reference
            "scores": scores_data,  # Keep for reference
            "time": time_data,  # Keep for reference
            "state_id": state_id,  # Store state_id for debugging and filtering
        }
        
        return transformed

    def _transform_fixture_to_match(self, fixture: Dict[str, Any], timezone_offset: int = 0) -> Dict[str, Any]:
        """
        Transform Sportmonks V3 fixture to frontend match format.
        
        Args:
            fixture: Fixture object from Sportmonks V3
            timezone_offset: Timezone offset in hours (e.g., 3 for Turkey UTC+3)
            
        Returns:
            Transformed match dictionary for frontend
        """
        from datetime import datetime, timezone, timedelta
        
        participants = fixture.get("participants", [])
        if isinstance(participants, dict) and "data" in participants:
            participants = participants["data"]
        
        teams = self._extract_home_away_teams(participants)
        
        home_team = teams["home"] or {}
        away_team = teams["away"] or {}
        
        # Extract scores
        scores_data = fixture.get("scores", [])
        if isinstance(scores_data, dict) and "data" in scores_data:
            scores_data = scores_data["data"]
        scores = self._extract_scores(scores_data, participants)
        
        # Extract periods - handle nested format
        periods_data = fixture.get("periods", {})
        if isinstance(periods_data, dict) and "data" in periods_data:
            periods_data = periods_data["data"]
        if not isinstance(periods_data, list):
            periods_data = []
        
        # Extract currentPeriod from periods if available
        current_period = fixture.get("currentPeriod", {})
        if isinstance(current_period, dict) and "data" in current_period:
            current_period = current_period["data"]
        if not isinstance(current_period, dict):
            current_period = None
        
        # Use first period as currentPeriod if currentPeriod not available
        if not current_period and periods_data and len(periods_data) > 0:
            # Find the current/active period (usually the last one or one with ticking=true)
            for period in reversed(periods_data):  # Check from most recent
                if isinstance(period, dict):
                    # Prefer period with ticking=true or has_timer=true
                    if period.get("ticking") is True or period.get("has_timer") is True:
                        current_period = period
                        break
            # If no ticking period found, use the last period
            if not current_period and periods_data:
                current_period = periods_data[-1] if isinstance(periods_data[-1], dict) else None
        
        # Extract time status - check both time object and state_id
        time_data = fixture.get("time", {})
        state_id = fixture.get("state_id")
        
        # Determine status from state_id if time_data is empty
        # Sportmonks state_id: 1=Not Started, 2=Live, 3=Period Break, 4=Finished, 5=Finished, 6=Postponed, 7=Cancelled, 8=Interrupted, 9=Abandoned, 10=Suspended, 11=Awaiting
        if not time_data.get("status") and state_id:
            if state_id == 1:
                time_data["status"] = "NS"  # Not Started
            elif state_id == 2:
                time_data["status"] = "LIVE"
            elif state_id in [3, 8, 10]:
                time_data["status"] = "HT"  # Half Time / Break
            elif state_id in [4, 5]:
                time_data["status"] = "FT"  # Full Time
            elif state_id == 6:
                time_data["status"] = "POSTP"  # Postponed
            elif state_id == 7:
                time_data["status"] = "CANCL"  # Cancelled
        
        # Extract updated_at for anchor time (frontend timer calculation)
        updated_at = fixture.get("updated_at") or fixture.get("last_update")
        
        time_status = self._format_time_status(time_data, current_period=current_period, periods=periods_data, updated_at=updated_at)
        
        # Override is_live for Period Break (state_id == 3) - match is not live during break
        if state_id == 3:
            time_status["is_live"] = False
            time_status["status"] = "HT"  # Ensure status is HT for half-time
            time_status["is_finished"] = False  # HT is not finished
        
        # State ID 4 and 5 are Finished states
        if state_id in [4, 5]:
            time_status["is_finished"] = True
            time_status["is_live"] = False
            if not time_status.get("status") or time_status["status"] not in ["FT", "AET", "FT_PEN", "FINISHED"]:
                time_status["status"] = "FT"
        
        # Smart minute-based status detection
        minute = time_status.get("minute")
        if minute is not None:
            try:
                minute_int = int(minute)
                # If minute is 45 and no extra time indicated, it's half-time break
                if minute_int == 45 and not time_data.get("extra_minute") and not time_data.get("injury_time"):
                    time_status["is_live"] = False
                    time_status["status"] = "HT"
                    time_status["is_finished"] = False
                # If minute is 90+ and no extra time, match is finished
                elif minute_int >= 90 and not time_data.get("extra_minute") and not time_data.get("injury_time"):
                    if not time_status.get("is_live"):
                        time_status["is_finished"] = True
                        time_status["status"] = "FT"
            except (ValueError, TypeError):
                pass  # Keep existing status if minute parsing fails
        
        # Get starting_at and convert to Turkey timezone if needed
        starting_at = fixture.get("starting_at")
        commence_time_turkey = None
        
        if starting_at:
            try:
                # Parse starting_at (usually in UTC)
                if isinstance(starting_at, str):
                    # Try to parse ISO format
                    if 'Z' in starting_at or '+00:00' in starting_at:
                        start_dt = datetime.fromisoformat(starting_at.replace('Z', '+00:00'))
                    else:
                        # Assume UTC if no timezone
                        start_dt = datetime.fromisoformat(starting_at.replace(' ', 'T'))
                        if start_dt.tzinfo is None:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                else:
                    start_dt = starting_at
                
                # Convert to Turkey timezone (UTC+3)
                if timezone_offset != 0:
                    turkey_tz = timezone(timedelta(hours=timezone_offset))
                    start_dt_turkey = start_dt.astimezone(turkey_tz)
                    commence_time_turkey = start_dt_turkey.strftime("%Y-%m-%d %H:%M:%S")
                else:
                    commence_time_turkey = start_dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception as e:
                logger.warning(f"Error parsing starting_at: {e}")
                commence_time_turkey = starting_at if isinstance(starting_at, str) else None
        
        # Determine if match is finished based on starting_at + duration
        if not time_status.get("is_finished") and starting_at:
            try:
                if isinstance(starting_at, str):
                    start_dt = datetime.fromisoformat(starting_at.replace('Z', '+00:00'))
                else:
                    start_dt = starting_at
                
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                
                # Match duration is typically 90 minutes + extra time
                match_duration = timedelta(minutes=105)  # 90 + 15 extra time buffer
                match_end_time = start_dt + match_duration
                
                # Current time in UTC
                now_utc = datetime.now(timezone.utc)
                
                # If match ended more than 5 minutes ago and has scores, it's finished
                if now_utc > match_end_time and (scores.get("home_score") is not None or scores.get("away_score") is not None):
                    if not time_status.get("is_live"):
                        time_status["is_finished"] = True
                        time_status["status"] = "FT"
            except Exception as e:
                logger.debug(f"Could not determine match finish status: {e}")
        
        # Extract league info - try multiple sources
        league_data = None
        
        # First try: direct league field
        league_from_fixture = fixture.get("league", {})
        if isinstance(league_from_fixture, dict):
            if "data" in league_from_fixture:
                league_data = league_from_fixture["data"]
            else:
                league_data = league_from_fixture
        
        # Fallback: try season.league
        if not league_data:
            season_data = fixture.get("season", {})
            if isinstance(season_data, dict) and "data" in season_data:
                season_data = season_data["data"]
            
            if season_data:
                league_from_season = season_data.get("league", {})
                if isinstance(league_from_season, dict):
                    if "data" in league_from_season:
                        league_data = league_from_season["data"]
                    else:
                        league_data = league_from_season
        
        if not league_data:
            league_data = {}
        
        # Extract statistics
        statistics_data = fixture.get("statistics", [])
        if isinstance(statistics_data, dict) and "data" in statistics_data:
            statistics_data = statistics_data["data"]
        
        # Normalize statistics: convert type_id format to type name format
        if isinstance(statistics_data, list):
            normalized_stats = []
            for stat in statistics_data:
                # Extract type information (name, developer_name) from type object
                stat_type = stat.get("type", {})
                if isinstance(stat_type, dict):
                    if "data" in stat_type:
                        stat_type = stat_type["data"]
                    
                    if isinstance(stat_type, dict):
                        # Extract type name
                        type_name = stat_type.get("name")
                        if type_name and not stat.get("type_name"):
                            stat["type_name"] = type_name
                        
                        # Also add type as string for frontend compatibility
                        # Frontend expects s.type to be a string, not an object
                        if type_name:
                            stat["type"] = type_name
                        
                        # Extract developer_name (important for frontend mapping)
                        developer_name = stat_type.get("developer_name")
                        if developer_name:
                            stat["developer_name"] = developer_name
                
                # Extract value from data.value if needed
                if "data" in stat and isinstance(stat["data"], dict) and "value" in stat["data"]:
                    stat["value"] = stat["data"]["value"]
                
                normalized_stats.append(stat)
            statistics_data = normalized_stats
        
        # Filter statistics by period based on match status (Bet365 behavior)
        match_status = time_status.get("status", "")
        is_live = time_status.get("is_live", False)
        is_finished = time_status.get("is_finished", False)
        statistics_data = self._filter_statistics_by_period(
            statistics_data,
            match_status,
            is_live,
            is_finished
        )
        
        # Extract lineups
        lineups_data = fixture.get("lineups", [])
        if isinstance(lineups_data, dict) and "data" in lineups_data:
            lineups_data = lineups_data["data"]
        
        # Transform lineups to home/away structure
        transformed_lineups = {
            "home": {
                "startingXI": [],
                "substitutes": []
            },
            "away": {
                "startingXI": [],
                "substitutes": []
            }
        }
        
        if isinstance(lineups_data, list):
            home_team_id = home_team.get("id") if isinstance(home_team, dict) else None
            away_team_id = away_team.get("id") if isinstance(away_team, dict) else None
            
            # Type ID 12 = Starting XI, Type ID 13 = Substitutes
            for lineup_item in lineups_data:
                if not isinstance(lineup_item, dict):
                    continue
                
                team_id = lineup_item.get("team_id") or lineup_item.get("participant_id")
                type_id = lineup_item.get("type_id")
                type_name_obj = lineup_item.get("type", {})
                if isinstance(type_name_obj, dict) and "data" in type_name_obj:
                    type_name_obj = type_name_obj["data"]
                type_name = type_name_obj.get("name", "").lower() if isinstance(type_name_obj, dict) else str(type_name_obj).lower()
                
                # Determine if starting XI or substitute
                is_substitute = (
                    type_id == 13 or
                    "substitute" in type_name or
                    "bench" in type_name or
                    "reserve" in type_name
                )
                is_starting = (
                    type_id == 12 or
                    ("starting" in type_name and "substitute" not in type_name) or
                    "xi" in type_name or
                    ("lineup" in type_name and "substitute" not in type_name)
                )
                
                # Extract player data
                player_obj = lineup_item.get("player", {})
                if isinstance(player_obj, dict) and "data" in player_obj:
                    player_obj = player_obj["data"]
                
                position_obj = lineup_item.get("position", {})
                if isinstance(position_obj, dict) and "data" in position_obj:
                    position_obj = position_obj["data"]
                
                player_data = {
                    "id": lineup_item.get("player_id"),
                    "name": lineup_item.get("player_name") or (player_obj.get("name") if isinstance(player_obj, dict) else ""),
                    "position": position_obj.get("name", "") if isinstance(position_obj, dict) else "",
                    "jersey_number": lineup_item.get("jersey_number"),
                    "image": player_obj.get("image_path", "") if isinstance(player_obj, dict) else ""
                }
                
                # Add to appropriate list - prioritize substitute check over starting
                if team_id == home_team_id:
                    if is_substitute:
                        transformed_lineups["home"]["substitutes"].append(player_data)
                    elif is_starting:
                        transformed_lineups["home"]["startingXI"].append(player_data)
                elif team_id == away_team_id:
                    if is_substitute:
                        transformed_lineups["away"]["substitutes"].append(player_data)
                    elif is_starting:
                        transformed_lineups["away"]["startingXI"].append(player_data)
        
        lineups_data = transformed_lineups
        
        # Extract events
        events_data = fixture.get("events", [])
        if isinstance(events_data, dict) and "data" in events_data:
            events_data = events_data["data"]
        
        # Filter and deduplicate events (Bet365 shows only specific event types)
        events_data = self._filter_and_dedup_events(events_data)
        
        # Extract and normalize odds, filter by bet365
        raw_odds_data = fixture.get("odds", {})
        odds_data = self._extract_and_normalize_odds(raw_odds_data, bookmaker_id_filter=2)
        
        # Group odds by market + line + direction (Bet365 behavior)
        odds_grouped = self._group_odds_by_market_line(
            odds_data,
            home_team_id=home_team.get("id") if isinstance(home_team, dict) else None,
            away_team_id=away_team.get("id") if isinstance(away_team, dict) else None
        )
        
        # Extract venue
        venue_data = fixture.get("venue", {})
        if isinstance(venue_data, dict) and "data" in venue_data:
            venue_data = venue_data["data"]
        
        # Extract sidelined (match-specific injuries and suspensions)
        sidelined_data = fixture.get("sidelined", [])
        if isinstance(sidelined_data, dict) and "data" in sidelined_data:
            sidelined_data = sidelined_data["data"]
        if not isinstance(sidelined_data, list):
            sidelined_data = []
        
        # Transform sidelined data
        transformed_sidelined = []
        home_team_id = home_team.get("id") if isinstance(home_team, dict) else None
        away_team_id = away_team.get("id") if isinstance(away_team, dict) else None
        
        for sidelined_item in sidelined_data:
            if not isinstance(sidelined_item, dict):
                continue
            
            # Extract player information
            player_data = sidelined_item.get("player", {})
            if isinstance(player_data, dict) and "data" in player_data:
                player_data = player_data["data"]
            
            player_name = player_data.get("name") if isinstance(player_data, dict) else None
            player_id = sidelined_item.get("player_id") or (player_data.get("id") if isinstance(player_data, dict) else None)
            player_image = player_data.get("image_path") if isinstance(player_data, dict) else None
            
            # Extract team information
            # SportMonks uses participant_id instead of team_id for sidelined
            team_id = sidelined_item.get("team_id") or sidelined_item.get("participant_id")
            
            # Extract type (injury/suspension)
            sidelined_type = sidelined_item.get("type", "")
            if isinstance(sidelined_type, dict):
                if "data" in sidelined_type:
                    sidelined_type = sidelined_type["data"].get("name", "") if isinstance(sidelined_type["data"], dict) else ""
                else:
                    sidelined_type = sidelined_type.get("name", "")
            elif not sidelined_type:
                # If type is not included, try to infer from type_id
                type_id = sidelined_item.get("type_id")
                # Common type_id mappings: 535=injury, 537=suspension, etc.
                if type_id == 535:
                    sidelined_type = "injury"
                elif type_id == 537:
                    sidelined_type = "suspension"
                else:
                    sidelined_type = "injury"  # Default
            
            # Translate type to Turkish
            if sidelined_type:
                sidelined_type_lower = sidelined_type.lower().strip()
                
                # Common type translations
                type_translations = {
                    # General
                    "injury": "Sakatlık",
                    "suspension": "Cezalı",
                    "called up to national team": "Milli Takıma Çağrıldı",
                    "national team": "Milli Takıma Çağrıldı",
                    "virus": "Hastalık",
                    "ill": "Hastalık",
                    "illness": "Hastalık",
                    "sick": "Hastalık",
                    "disease": "Hastalık",
                    
                    # Injuries
                    "hamstring injury": "Hamstring Sakatlığı",
                    "ankle injury": "Ayak Bileği Sakatlığı",
                    "knee injury": "Diz Sakatlığı",
                    "shoulder injury": "Omuz Sakatlığı",
                    "back injury": "Sırt Sakatlığı",
                    "foot injury": "Ayak Sakatlığı",
                    "leg injury": "Bacak Sakatlığı",
                    "thigh injury": "Uyluk Sakatlığı",
                    "thigh problems": "Uyluk Sorunu",
                    "groin injury": "Kasık Sakatlığı",
                    "muscle injury": "Kas Sakatlığı",
                    "broken collarbone": "Köprücük Kemiği Kırığı",
                    "broken leg": "Bacak Kırığı",
                    "cruciate ligament tear": "Çapraz Bağ Kopması",
                    "acl injury": "Çapraz Bağ Kopması",
                    "bruised ribs": "Kaburga Ezilmesi",
                    "rib injury": "Kaburga Sakatlığı",
                    "ankle surgery": "Ayak Bileği Ameliyatı",
                    "knee surgery": "Diz Ameliyatı",
                    "shoulder surgery": "Omuz Ameliyatı",
                    "concussion": "Sarsıntı",
                    "head injury": "Kafa Sakatlığı",
                    "neck injury": "Boyun Sakatlığı",
                    "wrist injury": "Bilek Sakatlığı",
                    "elbow injury": "Dirsek Sakatlığı",
                    "hip injury": "Kalça Sakatlığı",
                    "calf injury": "Baldır Sakatlığı",
                    "achilles injury": "Aşil Tendonu Sakatlığı",
                    "meniscus injury": "Menisküs Sakatlığı",
                    "torn muscle": "Kas Yırtığı",
                    "muscle tear": "Kas Yırtığı",
                    "strain": "Zorlanma",
                    "sprain": "Burkulma",
                    "fracture": "Kırık",
                    "dislocation": "Çıkık",
                    "tendon injury": "Tendon Sakatlığı",
                    "ligament injury": "Bağ Sakatlığı",
                    
                    # Suspensions
                    "yellow card suspension": "Sarı Kart Cezası",
                    "red card suspension": "Kırmızı Kart Cezası",
                    "accumulated yellow cards": "Biriken Sarı Kart Cezası",
                    "red card": "Kırmızı Kart Cezası",
                    "yellow card": "Sarı Kart Cezası",
                }
                
                # Try exact match first
                if sidelined_type_lower in type_translations:
                    sidelined_type = type_translations[sidelined_type_lower]
                else:
                    # Try partial matches
                    if "injury" in sidelined_type_lower:
                        sidelined_type = "Sakatlık"
                    elif "suspension" in sidelined_type_lower or "suspended" in sidelined_type_lower:
                        sidelined_type = "Cezalı"
                    elif "national team" in sidelined_type_lower or "called up" in sidelined_type_lower:
                        sidelined_type = "Milli Takıma Çağrıldı"
                    elif "yellow card" in sidelined_type_lower:
                        sidelined_type = "Sarı Kart Cezası"
                    elif "red card" in sidelined_type_lower:
                        sidelined_type = "Kırmızı Kart Cezası"
                    elif "virus" in sidelined_type_lower or "ill" in sidelined_type_lower or "illness" in sidelined_type_lower or "sick" in sidelined_type_lower:
                        sidelined_type = "Hastalık"
                    elif "cruciate" in sidelined_type_lower or "acl" in sidelined_type_lower:
                        sidelined_type = "Çapraz Bağ Kopması"
                    elif "thigh" in sidelined_type_lower and "problem" in sidelined_type_lower:
                        sidelined_type = "Uyluk Sorunu"
                    elif "rib" in sidelined_type_lower and ("bruised" in sidelined_type_lower or "bruise" in sidelined_type_lower):
                        sidelined_type = "Kaburga Ezilmesi"
                    elif "rib" in sidelined_type_lower:
                        sidelined_type = "Kaburga Sakatlığı"
                    elif "ligament" in sidelined_type_lower and "tear" in sidelined_type_lower:
                        sidelined_type = "Bağ Kopması"
                    elif "muscle" in sidelined_type_lower and ("tear" in sidelined_type_lower or "torn" in sidelined_type_lower):
                        sidelined_type = "Kas Yırtığı"
                    elif "concussion" in sidelined_type_lower:
                        sidelined_type = "Sarsıntı"
                    elif "strain" in sidelined_type_lower:
                        sidelined_type = "Zorlanma"
                    elif "sprain" in sidelined_type_lower:
                        sidelined_type = "Burkulma"
                    elif "fracture" in sidelined_type_lower:
                        sidelined_type = "Kırık"
                    elif "dislocation" in sidelined_type_lower:
                        sidelined_type = "Çıkık"
                    # If no match, keep original but translate common words
                    elif "surgery" in sidelined_type_lower:
                        sidelined_type = sidelined_type.replace("Surgery", "Ameliyatı").replace("surgery", "Ameliyatı")
                    elif "injury" in sidelined_type_lower:
                        # General injury pattern - try to translate the body part
                        if "head" in sidelined_type_lower or "kafa" in sidelined_type_lower:
                            sidelined_type = "Kafa Sakatlığı"
                        elif "neck" in sidelined_type_lower or "boyun" in sidelined_type_lower:
                            sidelined_type = "Boyun Sakatlığı"
                        elif "wrist" in sidelined_type_lower or "bilek" in sidelined_type_lower:
                            sidelined_type = "Bilek Sakatlığı"
                        elif "elbow" in sidelined_type_lower or "dirsek" in sidelined_type_lower:
                            sidelined_type = "Dirsek Sakatlığı"
                        elif "hip" in sidelined_type_lower or "kalça" in sidelined_type_lower:
                            sidelined_type = "Kalça Sakatlığı"
                        elif "calf" in sidelined_type_lower or "baldır" in sidelined_type_lower:
                            sidelined_type = "Baldır Sakatlığı"
                        elif "achilles" in sidelined_type_lower or "aşil" in sidelined_type_lower:
                            sidelined_type = "Aşil Tendonu Sakatlığı"
                        elif "meniscus" in sidelined_type_lower or "menisküs" in sidelined_type_lower:
                            sidelined_type = "Menisküs Sakatlığı"
                        elif "tendon" in sidelined_type_lower:
                            sidelined_type = "Tendon Sakatlığı"
                        elif "ligament" in sidelined_type_lower:
                            sidelined_type = "Bağ Sakatlığı"
                        else:
                            sidelined_type = "Sakatlık"
                    else:
                        # If still no match, provide generic translation
                        sidelined_type = "Sakatlık"
            
            # Extract description
            description = sidelined_item.get("description", "")
            if isinstance(description, dict):
                description = description.get("name", "") if isinstance(description, dict) else ""
            
            # Extract dates
            start_date = sidelined_item.get("start_date")
            end_date = sidelined_item.get("end_date")
            
            # Extract is_active
            is_active = sidelined_item.get("is_active", True)
            
            # Determine if it's home or away team
            team_side = None
            if team_id == home_team_id:
                team_side = "home"
            elif team_id == away_team_id:
                team_side = "away"
            
            # Only include active sidelined items
            if is_active and team_side:
                transformed_sidelined.append({
                    "player_id": player_id,
                    "player_name": player_name or f"Player {player_id}" if player_id else "Unknown Player",
                    "player_image": player_image,
                    "team_id": team_id,
                    "team_side": team_side,
                    "type": sidelined_type or "injury",
                    "description": description,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_active": is_active,
                })
            else:
                logger.debug(f"Skipping sidelined item: is_active={is_active}, team_side={team_side}, team_id={team_id}, home_team_id={home_team_id}, away_team_id={away_team_id}")
        
        logger.info(f"Transformed sidelined count: {len(transformed_sidelined)}")
        
        # If minute is still null/undefined and we have events, try to extract from events
        # This helps when time_data.minute is missing but match is live
        if (time_status.get("minute") is None or time_status.get("minute") == "") and events_data and len(events_data) > 0:
            try:
                # Get the latest event with a valid minute
                valid_events = [e for e in events_data if isinstance(e, dict) and e.get("minute") is not None]
                if valid_events:
                    latest_event = max(valid_events, key=lambda e: e.get("minute", 0))
                    latest_minute = latest_event.get("minute")
                    if latest_minute is not None:
                        # Only use if minute is reasonable (0-120)
                        try:
                            minute_int = int(latest_minute) if isinstance(latest_minute, (int, float)) else int(str(latest_minute).split('+')[0])
                            if 0 <= minute_int <= 120:
                                time_status["minute"] = latest_minute
                                logger.debug(f"Extracted minute {latest_minute} from events for fixture {fixture.get('id')}")
                        except (ValueError, TypeError):
                            pass
            except Exception as e:
                logger.debug(f"Could not extract minute from events: {e}")
        
        # Ensure minute is None if match is finished or HT (prevent showing stale minute values)
        # HT is a state, not a time - don't show minute during HT
        final_minute = time_status.get("minute")
        status_upper = (time_status.get("status", "") or "").upper()
        if time_status.get("is_finished", False):
            final_minute = None
        elif status_upper in ["HT", "HALF_TIME", "BREAK"]:
            final_minute = None  # HT is a state, not a time
        
        # Build transformed match
        transformed = {
            "id": str(fixture.get("id", "")),
            "sportmonks_id": fixture.get("id"),
            "home_team": home_team.get("name", "Home Team"),
            "away_team": away_team.get("name", "Away Team"),
            "home_team_id": home_team.get("id"),
            "away_team_id": away_team.get("id"),
            "home_team_logo": home_team.get("image_path"),
            "away_team_logo": away_team.get("image_path"),
            "home_score": scores.get("home_score"),
            "away_score": scores.get("away_score"),
            "league": league_data.get("name", "") if league_data else "",
            "league_id": league_data.get("id") if league_data else None,
            "league_logo": league_data.get("image_path") if league_data else None,
            "country": league_data.get("country", {}).get("name", "") if league_data and isinstance(league_data.get("country"), dict) else "",
            "status": time_status.get("status", ""),
            "minute": final_minute,
            "seconds": time_status.get("seconds"),  # Seconds from currentPeriod
            "time_added": time_status.get("time_added"),  # Injury time for "45+X" format
            "ticking": time_status.get("ticking"),  # Whether timer is ticking
            "has_timer": time_status.get("has_timer"),  # Whether timer is available
            "should_tick": time_status.get("should_tick", False),  # Whether timer should tick (Bet365 behavior)
            "is_live": time_status.get("is_live", False),
            "is_finished": time_status.get("is_finished", False),
            "is_postponed": time_status.get("is_postponed", False),
            "commence_time": commence_time_turkey or fixture.get("starting_at"),  # Use Turkey timezone if available
            "commence_time_utc": fixture.get("starting_at"),  # Keep original UTC time
            "events": events_data if isinstance(events_data, list) else [],
            "statistics": statistics_data if isinstance(statistics_data, list) else [],
            "lineups": lineups_data if isinstance(lineups_data, dict) else (lineups_data if isinstance(lineups_data, list) else {}),
            "odds": odds_data if isinstance(odds_data, list) else [],  # Flat list for backward compatibility
            "odds_grouped": odds_grouped if isinstance(odds_grouped, list) else [],  # Grouped structure (Bet365 behavior)
            "venue": venue_data,
            "sidelined": transformed_sidelined,  # Match-specific injuries and suspensions
            "currentPeriod": current_period,  # Store currentPeriod for frontend
            "periods": periods_data,  # Store all periods for frontend (more comprehensive)
            "participants": participants,  # Keep for reference
            "scores": scores_data,  # Keep for reference
            "time": time_data,  # Keep for reference
            "state_id": state_id,  # Keep state_id for reference
        }
        
        return transformed

    async def close(self):
        """Close the HTTP client and cleanup resources."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# Create singleton instance
sportmonks_service = SportmonksService()

