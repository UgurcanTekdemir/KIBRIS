"""
Sportmonks V3 API Service Module
Fetches football match data from Sportmonks V3 API (Advanced Worldwide Plan).
Acts as a Data Proxy - no database storage, direct pass-through to frontend.
"""
import os
import asyncio
import random
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import httpx
import logging

logger = logging.getLogger(__name__)

SPORTMONKS_API_BASE_URL = "https://api.sportmonks.com/v3/football"
# API Token from environment variable or use provided token
SPORTMONKS_API_TOKEN = os.environ.get(
    "SPORTMONKS_API_TOKEN",
    "DANuduophWe7ysew7fNLOxySHaeQKvWsEPlpbOGCxI4Jt6sBuQhBnGUFFEem"
)


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
        
        # Client-side rate limiting (sliding window)
        # Sportmonks Advanced plan: 1000 requests per minute
        self._rate_limit_window = 60  # 60 seconds window
        self._rate_limit_max_requests = 900  # Conservative limit (90% of 1000)
        self._request_timestamps = []  # Track request timestamps
        self._rate_limit_lock = asyncio.Lock() if hasattr(asyncio, 'Lock') else None
        
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

    async def _get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        retries: int = 3,
        backoff_factor: float = 0.5
    ) -> Any:
        """
        Generic GET request handler with retry logic and rate limit management.
        
        Args:
            path: API endpoint path (e.g., "livescores", "fixtures/12345")
            params: Additional query parameters (include, filters, etc.)
            retries: Number of retry attempts
            backoff_factor: Exponential backoff multiplier
            
        Returns:
            JSON response data
        """
        if not self.api_token:
            raise Exception(
                "SPORTMONKS_API_TOKEN environment variable is not set. "
                "Please configure it to enable Sportmonks V3 requests."
            )
        
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {
            "Authorization": self.api_token,
            "Accept": "application/json"
        }
        
        query_params = {}
        if params:
            query_params.update(params)
        
        # Client-side rate limiting (sliding window)
        async def wait_for_rate_limit():
            """Wait if rate limit is reached (sliding window)."""
            if self._rate_limit_lock:
                async with self._rate_limit_lock:
                    now = asyncio.get_event_loop().time()
                    # Remove timestamps outside the window
                    self._request_timestamps = [
                        ts for ts in self._request_timestamps 
                        if now - ts < self._rate_limit_window
                    ]
                    
                    # If we're at the limit, wait until oldest request expires
                    if len(self._request_timestamps) >= self._rate_limit_max_requests:
                        oldest_ts = min(self._request_timestamps)
                        wait_time = self._rate_limit_window - (now - oldest_ts) + 0.1  # Add small buffer
                        if wait_time > 0:
                            logger.info(f"Rate limit reached ({len(self._request_timestamps)}/{self._rate_limit_max_requests}). Waiting {wait_time:.2f} seconds...")
                            await asyncio.sleep(wait_time)
                            # Clean up again after waiting
                            now = asyncio.get_event_loop().time()
                            self._request_timestamps = [
                                ts for ts in self._request_timestamps 
                                if now - ts < self._rate_limit_window
                            ]
                    
                    # Record this request
                    self._request_timestamps.append(asyncio.get_event_loop().time())
            else:
                # Fallback if lock is not available
                now = asyncio.get_event_loop().time()
                self._request_timestamps = [
                    ts for ts in self._request_timestamps 
                    if now - ts < self._rate_limit_window
                ]
                if len(self._request_timestamps) >= self._rate_limit_max_requests:
                    oldest_ts = min(self._request_timestamps)
                    wait_time = self._rate_limit_window - (now - oldest_ts) + 0.1
                    if wait_time > 0:
                        await asyncio.sleep(wait_time)
                self._request_timestamps.append(asyncio.get_event_loop().time())
        
        last_exception = None
        for attempt in range(retries):
            try:
                # Wait for rate limit before making request
                await wait_for_rate_limit()
                
                # Use reusable client with connection pooling
                client = self._get_client()
                response = await client.get(url, headers=headers, params=query_params)
                
                # Check rate limit before processing
                if response.status_code == 200:
                    try:
                        data = response.json()
                        # Check rate limit in response
                        rate_limit_info = data.get("rate_limit", {})
                        remaining = rate_limit_info.get("remaining", 0)
                        
                        if remaining < 5:
                            logger.warning(
                                f"Rate limit low: {remaining} remaining. Waiting 0.5 seconds before retry."
                            )
                            if attempt < retries - 1:
                                await asyncio.sleep(0.5)
                                continue
                    except (ValueError, KeyError):
                        pass  # If JSON parsing fails, continue with response
                    
                    # Handle rate limiting (429)
                    if response.status_code == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        if attempt < retries - 1:
                            wait_time = retry_after * (backoff_factor ** attempt)
                            # Add jitter (random delay between 0-30% of wait_time) to prevent synchronized retries
                            jitter = random.uniform(0, wait_time * 0.3)
                            wait_time_with_jitter = wait_time + jitter
                            logger.warning(
                                f"Rate limited. Waiting {wait_time_with_jitter:.2f} seconds (base: {wait_time:.2f}, jitter: {jitter:.2f}) before retry {attempt + 1}/{retries}"
                            )
                            await asyncio.sleep(wait_time_with_jitter)
                            continue
                    
                    # Handle other HTTP errors
                    if response.status_code >= 400:
                        error_text = response.text[:200] if response.text else "Unknown error"
                        if attempt < retries - 1:
                            wait_time = (backoff_factor ** attempt)
                            # Add jitter (random delay between 0-30% of wait_time) to prevent synchronized retries
                            jitter = random.uniform(0, wait_time * 0.3)
                            wait_time_with_jitter = wait_time + jitter
                            logger.warning(
                                f"HTTP {response.status_code} error: {error_text}. "
                                f"Retrying in {wait_time_with_jitter:.2f} seconds (base: {wait_time:.2f}, jitter: {jitter:.2f})..."
                            )
                            await asyncio.sleep(wait_time_with_jitter)
                            continue
                        else:
                            from fastapi import HTTPException
                            raise HTTPException(
                                status_code=response.status_code,
                                detail=f"API request failed: {error_text}"
                            )
                    
                    # Success - parse and return JSON
                    return response.json()
                    
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
            raise last_exception
        raise Exception("Request failed after all retries")

    async def get_livescores(
        self,
        include: str = "participants;scores;events;league;odds"
    ) -> List[Dict[str, Any]]:
        """
        Get live football matches.
        
        Args:
            include: Comma-separated list of relations to include
            
        Returns:
            List of live match data
        """
        try:
            params = {"include": include} if include else {}
            response = await self._get("livescores", params=params)
            
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
        include: str = "participants;scores;events;league;odds"
    ) -> List[Dict[str, Any]]:
        """
        Get fixtures for a specific date using Sportmonks V3 /fixtures/date/{date} endpoint.
        
        Args:
            date: Date in YYYY-MM-DD format
            include: Comma-separated list of relations to include
            
        Returns:
            List of fixture data for the specified date
        """
        try:
            params = {}
            if include:
                params["include"] = include
            
            # Use Sportmonks V3 fixtures/date/{date} endpoint
            response = await self._get(f"fixtures/date/{date}", params=params)
            
            # Extract fixtures from response
            fixtures_list = []
            if isinstance(response, dict) and "data" in response:
                fixtures_list = response["data"]
            elif isinstance(response, list):
                fixtures_list = response
            
            return fixtures_list
        except Exception as e:
            logger.error(f"Error fetching fixtures for date {date}: {e}")
            return []

    async def get_fixtures(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        league_id: Optional[int] = None,
        include: str = "participants;scores;events;league;odds"
    ) -> List[Dict[str, Any]]:
        """
        Get fixtures (matches) for a date range or specific league.
        Uses /fixtures/date/{date} endpoint for each day in the range.
        
        Args:
            date_from: Start date (YYYY-MM-DD format)
            date_to: End date (YYYY-MM-DD format)
            league_id: Optional league ID to filter by
            include: Comma-separated list of relations to include
            
        Returns:
            List of fixture data
        """
        try:
            from datetime import datetime, timedelta
            
            # If date range specified, fetch fixtures for each day in parallel
            if date_from and date_to:
                start_date = datetime.strptime(date_from, "%Y-%m-%d")
                end_date = datetime.strptime(date_to, "%Y-%m-%d")
                
                # Generate all dates in range
                date_list = []
                current_date = start_date
                while current_date <= end_date:
                    date_list.append(current_date.strftime("%Y-%m-%d"))
                    current_date += timedelta(days=1)
                
                # Fetch fixtures for all dates in parallel (with rate limiting protection)
                # Limit to 25 concurrent requests to avoid rate limits (optimized from 10)
                import asyncio
                all_fixtures = []
                batch_size = 25  # Optimized batch size for better performance
                
                for i in range(0, len(date_list), batch_size):
                    batch = date_list[i:i + batch_size]
                    # Fetch batch in parallel
                    batch_results = await asyncio.gather(
                        *[self.get_fixtures_by_date(date_str, include=include) for date_str in batch],
                        return_exceptions=True
                    )
                    
                    # Process results and handle exceptions
                    for result in batch_results:
                        if isinstance(result, Exception):
                            logger.warning(f"Error fetching fixtures for date: {result}")
                            continue
                        if isinstance(result, list):
                            all_fixtures.extend(result)
                    
                    # Minimal delay between batches to respect rate limits
                    if i + batch_size < len(date_list):
                        await asyncio.sleep(0.05)  # Optimized delay for rate limit protection
                
                fixtures_list = all_fixtures
            elif date_from:
                # Single date
                fixtures_list = await self.get_fixtures_by_date(date_from, include=include)
            else:
                # No date specified, use today + 7 days
                today = datetime.now().strftime("%Y-%m-%d")
                fixtures_list = await self.get_fixtures_by_date(today, include=include)
            
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

    async def get_fixture(
        self,
        fixture_id: int,
        include: str = "participants;scores;statistics;lineups;events;odds;venue;season"
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed fixture information.
        
        Args:
            fixture_id: Sportmonks fixture ID
            include: Comma-separated list of relations to include
            
        Returns:
            Fixture data dictionary or None if not found
        """
        try:
            params = {"include": include} if include else {}
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

    def _extract_and_normalize_odds(self, odds_data: Any) -> List[Dict[str, Any]]:
        """
        Extract and normalize odds from Sportmonks V3 format.
        Handles both formats:
        1. Direct list format (already normalized): list of odds with label, value, market_description
        2. Nested format: odds -> data -> array with bookmaker, market, values structure
        
        Args:
            odds_data: Raw odds data from Sportmonks V3 (can be dict, list, or None)
            
        Returns:
            Normalized list of odds objects with flattened structure
        """
        if not odds_data:
            return []
        
        # Handle nested format: odds.data
        if isinstance(odds_data, dict):
            if "data" in odds_data:
                odds_data = odds_data["data"]
            else:
                # If it's a dict but no "data" key, try to extract odds from it
                return []
        
        if not isinstance(odds_data, list):
            return []
        
        normalized_odds = []
        
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
                
                # Build normalized odd object from already-normalized data
                normalized_odd = {
                    "bookmaker_id": odd_item.get("bookmaker_id"),
                    "bookmaker_name": odd_item.get("bookmaker_name"),
                    "market_id": odd_item.get("market_id"),
                    "market_name": odd_item.get("market_description") or odd_item.get("market_name"),
                    "market_description": odd_item.get("market_description"),
                    "label": odd_item.get("label") or odd_item.get("name") or "",
                    "name": odd_item.get("name") or odd_item.get("label") or "",
                    "value": value_odd_float,
                    "odd": value_odd_float,
                    "price": value_odd_float,
                    "stopped": odd_item.get("stopped", False),
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
                
                # Skip if no valid value
                if not value_name or value_odd is None:
                    continue
                
                # Extract line (for Over/Under and Handicap markets)
                line = value_item.get("line")
                if line is not None:
                    try:
                        line = float(line)
                    except (ValueError, TypeError):
                        line = None
                
                # Extract participant (for Handicap and Team Total markets)
                participant = value_item.get("participant")
                participant_id = None
                participant_name = None
                if participant:
                    if isinstance(participant, dict):
                        if "data" in participant:
                            participant = participant["data"]
                        participant_id = participant.get("id")
                        participant_name = participant.get("name")
                    elif isinstance(participant, (int, str)):
                        participant_id = participant
                
                # Extract direction from label (Over/Under markets)
                direction = None
                label_lower = value_name.lower()
                if "over" in label_lower or "üst" in label_lower:
                    direction = "over"
                elif "under" in label_lower or "alt" in label_lower:
                    direction = "under"
                
                # Get market_id for selection_key
                market_id = market.get("id") if isinstance(market, dict) else odd_item.get("market_id")
                
                # Build selection_key
                selection_key_parts = [str(market_id) if market_id else ""]
                if line is not None:
                    selection_key_parts.append(str(line))
                if direction:
                    selection_key_parts.append(direction)
                if participant_id:
                    selection_key_parts.append(str(participant_id))
                elif not line and not direction:  # Simple market
                    selection_key_parts.append(value_name)
                
                selection_key = "|".join(selection_key_parts)
                
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
                
                # Build normalized odd object
                normalized_odd = {
                    "bookmaker_id": bookmaker.get("id") if isinstance(bookmaker, dict) else None,
                    "bookmaker_name": bookmaker.get("name") if isinstance(bookmaker, dict) else None,
                    "market_id": market_id,
                    "market_name": market.get("name") if isinstance(market, dict) else odd_item.get("market_description"),
                    "market_description": market.get("description") if isinstance(market, dict) else odd_item.get("market_description"),
                    "label": value_name,
                    "name": value_name,
                    "value": value_odd_float,
                    "odd": value_odd_float,
                    "price": value_odd_float,
                    "stopped": odd_item.get("stopped", False),
                    "line": line,
                    "participant_id": participant_id,
                    "participant_name": participant_name,
                    "direction": direction,
                    "selection_key": selection_key,
                }
                
                normalized_odds.append(normalized_odd)
        
        return normalized_odds

    def _format_time_status(self, time_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format time status and minute from Sportmonks V3 time object.
        
        Args:
            time_data: Time object from Sportmonks V3 (contains status, minute, etc.)
            
        Returns:
            Dictionary with formatted status, minute, is_live, is_finished
        """
        if not isinstance(time_data, dict):
            time_data = {}
        
        status = time_data.get("status", "")
        if status:
            status = status.upper()
        
        # Extract minute and ensure it's an integer (handle string, float, or None)
        minute_raw = time_data.get("minute")
        minute = None
        if minute_raw is not None:
            try:
                # Convert to int (handles string "45", float 45.0, etc.)
                minute = int(float(str(minute_raw)))
                # Validate minute is reasonable (0-120 for soccer)
                if minute < 0 or minute > 120:
                    minute = None
            except (ValueError, TypeError):
                minute = None
        
        # Extract second and ensure it's an integer (handle string, float, or None)
        second_raw = time_data.get("second")
        second = None
        if second_raw is not None:
            try:
                # Convert to int (handles string "30", float 30.0, etc.)
                second = int(float(str(second_raw)))
                # Validate second is reasonable (0-59)
                if second < 0 or second > 59:
                    second = None
            except (ValueError, TypeError):
                second = None
        
        # If time_data is empty, check if we can infer from other fields
        # Sportmonks V3 might not always provide time object for livescores
        # In that case, we'll use default values and let frontend handle it
        
        # Determine match state based on status
        is_live = False
        is_finished = False
        is_postponed = False
        
        if status:
            # HT (Half Time) and BREAK are not live - match is paused
            # Only actively playing statuses are considered live
            is_live = status in ["LIVE", "ET", "PEN", "1ST_HALF", "2ND_HALF", "INPLAY", "IN_PLAY"]
            # Finished statuses: FT, FINISHED, AET, FT_PEN (HT is NOT finished, it's just a break)
            is_finished = status in ["FT", "AET", "FT_PEN", "FINISHED", "AWARDED"]
            is_postponed = status in ["POSTP", "CANCL", "CANCELED", "CANCELLED"]
        
        # Smart minute-based status detection for 45+ and 90+
        if minute is not None:
            if minute >= 45 and minute < 50 and status == "LIVE":
                status = "45+"
            elif minute >= 90 and minute < 95 and status == "LIVE":
                status = "90+"
        
        # If match is finished, don't show minute/second (set to None)
        # This prevents showing stale minute/second values (e.g., 78) for finished matches
        if is_finished:
            minute = None
            second = None
        
        return {
            "status": status,
            "minute": minute,
            "second": second,
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
        
        # Extract time status - handle nested format
        time_data = livescore.get("time", {})
        if isinstance(time_data, dict) and "data" in time_data:
            time_data = time_data["data"]
        if not isinstance(time_data, dict):
            time_data = {}
        
        # Extract state_id for status determination
        state_id = livescore.get("state_id")
        
        # Determine status from state_id if time_data is empty or doesn't have status
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
        
        time_status = self._format_time_status(time_data)
        
        # Override is_live for Period Break (state_id == 3) - match is not live during break
        if state_id == 3:
            time_status["is_live"] = False
            time_status["status"] = "HT"  # Ensure status is HT for half-time
            time_status["is_finished"] = False  # HT is not finished
        
        # State ID 4 and 5 are Finished states
        if state_id in [4, 5]:
            time_status["is_finished"] = True
            time_status["is_live"] = False  # Ensure it's not live if finished
            time_status["status"] = "FT"  # Ensure status is FT
        
        # Double-check: if match is finished, ensure is_live is False
        if time_status.get("is_finished", False):
            time_status["is_live"] = False
        
        # Ensure minute is None if match is finished (prevent showing stale minute values)
        final_minute = time_status.get("minute")
        if time_status.get("is_finished", False):
            final_minute = None
        
        # Extract league info - handle nested format
        league_data = livescore.get("league", {})
        if isinstance(league_data, dict) and "data" in league_data:
            league_data = league_data["data"]
        
        # Extract and normalize odds - handle nested format
        raw_odds_data = livescore.get("odds", {})
        odds_data = self._extract_and_normalize_odds(raw_odds_data)
        
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
            "second": time_status.get("second"),
            "is_live": time_status.get("is_live", False),
            "is_finished": time_status.get("is_finished", False),
            "is_postponed": time_status.get("is_postponed", False),
            "commence_time": commence_time_turkey or livescore.get("starting_at"),
            "events": events_data if isinstance(events_data, list) else [],
            "odds": odds_data,
            "participants": participants,  # Keep for reference
            "scores": scores_data,  # Keep for reference
            "time": time_data,  # Keep for reference
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
        
        time_status = self._format_time_status(time_data)
        
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
                # If stat has type_id but no type name, try to get type name from type object
                if stat.get("type_id") and not stat.get("type_name"):
                    stat_type = stat.get("type", {})
                    if isinstance(stat_type, dict):
                        if "data" in stat_type:
                            stat_type = stat_type["data"]
                        type_name = stat_type.get("name") if isinstance(stat_type, dict) else None
                        if type_name:
                            stat["type_name"] = type_name
                
                # Extract value from data.value if needed
                if "data" in stat and isinstance(stat["data"], dict) and "value" in stat["data"]:
                    stat["value"] = stat["data"]["value"]
                
                normalized_stats.append(stat)
            statistics_data = normalized_stats
        
        # Extract lineups
        lineups_data = fixture.get("lineups", [])
        if isinstance(lineups_data, dict) and "data" in lineups_data:
            lineups_data = lineups_data["data"]
        
        # Extract events
        events_data = fixture.get("events", [])
        if isinstance(events_data, dict) and "data" in events_data:
            events_data = events_data["data"]
        
        # Extract and normalize odds
        raw_odds_data = fixture.get("odds", {})
        odds_data = self._extract_and_normalize_odds(raw_odds_data)
        
        # Extract venue
        venue_data = fixture.get("venue", {})
        if isinstance(venue_data, dict) and "data" in venue_data:
            venue_data = venue_data["data"]
        
        # Ensure minute is None if match is finished (prevent showing stale minute values)
        final_minute = time_status.get("minute")
        if time_status.get("is_finished", False):
            final_minute = None
        
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
            "is_live": time_status.get("is_live", False),
            "is_finished": time_status.get("is_finished", False),
            "is_postponed": time_status.get("is_postponed", False),
            "commence_time": commence_time_turkey or fixture.get("starting_at"),  # Use Turkey timezone if available
            "commence_time_utc": fixture.get("starting_at"),  # Keep original UTC time
            "events": events_data if isinstance(events_data, list) else [],
            "statistics": statistics_data if isinstance(statistics_data, list) else [],
            "lineups": lineups_data if isinstance(lineups_data, list) else [],
            "odds": odds_data if isinstance(odds_data, list) else [],
            "venue": venue_data,
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

