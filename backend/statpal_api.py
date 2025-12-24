"""
StatPal API Service Module
Handles all interactions with StatPal API for soccer livescores and match data
Following StatPal API documentation: https://statpal.io/quick-start-tutorial/
"""
import os
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import logging
from pathlib import Path
from dotenv import load_dotenv
import time

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

STATPAL_API_BASE_URL = "https://statpal.io/api/v2"
STATPAL_API_KEY = os.environ.get("STATPAL_API_KEY", "")

# Rate limits per StatPal documentation:
# - Live Scores & Play-by-Play: Refreshed every 30 seconds (don't exceed this frequency)
# - Other Endpoints: Updated several times per hour (can access ~10+ times per hour)
LIVE_SCORES_CACHE_TTL = 30  # 30 seconds for live scores
OTHER_ENDPOINTS_CACHE_TTL = 300  # 5 minutes for other endpoints


class StatPalAPIService:
    """
    Service class for interacting with StatPal API
    Implements caching and rate limiting per StatPal documentation
    """
    
    def __init__(self):
        self.base_url = STATPAL_API_BASE_URL
        self.api_key = STATPAL_API_KEY
        if not self.api_key:
            logger.warning("STATPAL_API_KEY is not set. Requests will fail.")
        
        # Simple in-memory cache: {endpoint: (data, timestamp)}
        self._cache: Dict[str, tuple] = {}
        
        # Track last request time per endpoint to respect rate limits
        self._last_request_time: Dict[str, float] = {}
    
    def _get_cache_key(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> str:
        """Generate cache key from endpoint and params"""
        if params:
            sorted_params = sorted(params.items())
            param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
            return f"{endpoint}?{param_str}"
        return endpoint
    
    def _get_from_cache(self, cache_key: str, ttl: int) -> Optional[Dict[str, Any]]:
        """Get data from cache if still valid"""
        if cache_key in self._cache:
            data, timestamp = self._cache[cache_key]
            if time.time() - timestamp < ttl:
                logger.debug(f"Cache hit for {cache_key}")
                return data
            else:
                # Cache expired, remove it
                del self._cache[cache_key]
        return None
    
    def _set_cache(self, cache_key: str, data: Dict[str, Any]):
        """Store data in cache"""
        self._cache[cache_key] = (data, time.time())
    
    async def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        use_cache: bool = True,
        cache_ttl: int = OTHER_ENDPOINTS_CACHE_TTL
    ) -> Dict[str, Any]:
        """
        Make a GET request to StatPal API with caching and rate limiting
        
        Args:
            endpoint: API endpoint path (e.g., 'soccer/matches/live')
            params: Query parameters (access_key will be added automatically)
            use_cache: Whether to use caching (default: True)
            cache_ttl: Cache TTL in seconds (default: OTHER_ENDPOINTS_CACHE_TTL)
            
        Returns:
            JSON response as dictionary
            
        Raises:
            Exception: If request fails
        """
        cache_key = self._get_cache_key(endpoint, params)
        
        # Check cache first
        if use_cache:
            cached_data = self._get_from_cache(cache_key, cache_ttl)
            if cached_data is not None:
                return cached_data
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Add access_key to params
        request_params = {"access_key": self.api_key}
        if params:
            request_params.update(params)
        
        # Rate limiting: Check last request time
        current_time = time.time()
        if endpoint in self._last_request_time:
            time_since_last = current_time - self._last_request_time[endpoint]
            # For live scores, ensure at least 30 seconds between requests
            if "live" in endpoint.lower() and time_since_last < LIVE_SCORES_CACHE_TTL:
                logger.warning(f"Rate limit: Too soon to request {endpoint}. Waiting...")
                # Return cached data if available, otherwise wait
                cached_data = self._get_from_cache(cache_key, cache_ttl)
                if cached_data is not None:
                    return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=request_params)
                
                logger.debug(f"StatPal API Request: {url}")
                logger.debug(f"Response status: {response.status_code}")
                
                # Handle HTTP 200 with 'invalid-request' per documentation
                if response.status_code == 200:
                    try:
                        data = response.json()
                        # Check for invalid-request in response
                        if isinstance(data, dict) and data.get("status") == "invalid-request":
                            error_msg = data.get("message", "Invalid request")
                            logger.error(f"StatPal API invalid request: {error_msg}")
                            raise Exception(f"Invalid request: {error_msg}")
                        # Update cache and last request time
                        if use_cache:
                            self._set_cache(cache_key, data)
                        self._last_request_time[endpoint] = current_time
                        return data
                    except ValueError:
                        # Not JSON response
                        logger.error(f"StatPal API returned non-JSON response: {response.text[:200]}")
                        raise Exception("Invalid JSON response from API")
                
                # For non-200 status codes, raise exception
                response.raise_for_status()
                return response.json()
                
        except httpx.HTTPStatusError as e:
            error_detail = f"Status: {e.response.status_code}, Response: {e.response.text[:200]}"
            logger.error(f"StatPal API request failed: {error_detail}")
            raise Exception(f"API request failed: {error_detail}")
        except httpx.HTTPError as e:
            logger.error(f"StatPal API request failed: {e}")
            raise Exception(f"API request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in StatPal API request: {e}")
            raise
    
    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """
        Get live soccer matches with scores
        Uses 30-second cache per StatPal documentation
        
        Returns:
            List of live matches in flattened format
        """
        try:
            result = await self._make_request(
                "soccer/matches/live",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            # StatPal API returns: {"live_matches": {"league": [{"id": ..., "name": ..., "match": [...]}]}}
            matches = []
            
            # Handle live_matches wrapper
            if isinstance(result, dict) and "live_matches" in result:
                result = result["live_matches"]
            
            if isinstance(result, dict) and "league" in result:
                # Parse league structure
                for league_data in result.get("league", []):
                    league_name = league_data.get("name", "Unknown League")
                    league_id = league_data.get("id")
                    country = league_data.get("country", "")
                    
                    # Get matches from this league
                    league_matches = league_data.get("match", [])
                    if not isinstance(league_matches, list):
                        league_matches = [league_matches] if league_matches else []
                    
                    # Flatten matches and add league info
                    for match in league_matches:
                        if isinstance(match, dict):
                            match["league_name"] = league_name
                            match["league_id"] = league_id
                            match["country"] = country
                            matches.append(match)
            
            return matches
        except Exception as e:
            logger.error(f"Error fetching live matches: {e}")
            logger.exception(e)  # Log full traceback
            return []
    
    async def get_matches(
        self,
        date: Optional[str] = None,
        league_id: Optional[int] = None,
        team_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get soccer matches - uses live matches endpoint as StatPal doesn't have a general matches endpoint
        Uses 30-second cache per StatPal documentation
        
        Args:
            date: Date filter in YYYY-MM-DD format (optional, not used for live matches)
            league_id: League ID filter (optional)
            team_id: Team ID filter (optional)
            
        Returns:
            List of matches in flattened format
        """
        try:
            # StatPal API doesn't have a general /matches endpoint, use live matches
            # which includes both live and recent matches
            result = await self._make_request(
                "soccer/matches/live",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            matches = []
            
            # Handle live_matches wrapper
            if isinstance(result, dict) and "live_matches" in result:
                result = result["live_matches"]
            
            # StatPal API returns: {"league": [{"id": ..., "name": ..., "match": [...]}]}
            if isinstance(result, dict) and "league" in result:
                for league_data in result.get("league", []):
                    league_name = league_data.get("name", "Unknown League")
                    league_id_data = league_data.get("id")
                    country = league_data.get("country", "")
                    
                    # Filter by league_id if provided
                    if league_id and str(league_id_data) != str(league_id):
                        continue
                    
                    league_matches = league_data.get("match", [])
                    if not isinstance(league_matches, list):
                        league_matches = [league_matches] if league_matches else []
                    
                    for match in league_matches:
                        if isinstance(match, dict):
                            # Filter by team_id if provided
                            if team_id:
                                home_id = match.get("home", {}).get("id")
                                away_id = match.get("away", {}).get("id")
                                if str(home_id) != str(team_id) and str(away_id) != str(team_id):
                                    continue
                            
                            match["league_name"] = league_name
                            match["league_id"] = league_id_data
                            match["country"] = country
                            matches.append(match)
            
            return matches
        except Exception as e:
            logger.error(f"Error fetching matches: {e}")
            logger.exception(e)  # Log full traceback
            return []
    
    async def get_match_details(self, match_id: str) -> Dict[str, Any]:
        """
        Get detailed information for a specific match
        
        Args:
            match_id: Match ID (main_id, fallback_id_1, fallback_id_2, or fallback_id_3)
            
        Returns:
            Match details
        """
        try:
            # StatPal API doesn't have a direct match details endpoint
            # So we fetch all live matches and find the one with matching ID
            all_matches = await self.get_live_matches()
            
            # Search for match by main_id or any fallback_id
            for match in all_matches:
                if (match.get("main_id") == match_id or
                    match.get("fallback_id_1") == match_id or
                    match.get("fallback_id_2") == match_id or
                    match.get("fallback_id_3") == match_id):
                    return match
            
            # If not found in live matches, try regular matches
            all_matches = await self.get_matches()
            for match in all_matches:
                if (match.get("main_id") == match_id or
                    match.get("fallback_id_1") == match_id or
                    match.get("fallback_id_2") == match_id or
                    match.get("fallback_id_3") == match_id):
                    return match
            
            return {}
        except Exception as e:
            logger.error(f"Error fetching match details: {e}")
            logger.exception(e)
            return {}
    
    async def get_results(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get match results (finished matches)
        Per StatPal documentation: /results/ endpoint
        
        Args:
            date: Date filter in YYYY-MM-DD format (optional)
            
        Returns:
            List of finished matches
        """
        params = {}
        if date:
            params["date"] = date
        
        try:
            result = await self._make_request(
                "soccer/results",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            # Parse similar to live matches structure
            matches = []
            if isinstance(result, dict):
                # Handle different response structures
                if "results" in result:
                    result = result["results"]
                if "league" in result:
                    for league_data in result.get("league", []):
                        league_name = league_data.get("name", "Unknown League")
                        league_id = league_data.get("id")
                        country = league_data.get("country", "")
                        
                        league_matches = league_data.get("match", [])
                        if not isinstance(league_matches, list):
                            league_matches = [league_matches] if league_matches else []
                        
                        for match in league_matches:
                            if isinstance(match, dict):
                                match["league_name"] = league_name
                                match["league_id"] = league_id
                                match["country"] = country
                                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error fetching results: {e}")
            return []
    
    async def get_leagues(self) -> List[Dict[str, Any]]:
        """
        Get available leagues
        Uses 5-minute cache per StatPal documentation
        
        Returns:
            List of leagues
        """
        try:
            result = await self._make_request(
                "soccer/leagues",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("leagues", []))
            elif isinstance(result, list):
                return result
            else:
                logger.warning(f"Unexpected response format: {type(result)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching leagues: {e}")
            return []
    
    async def get_teams(self, league_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get teams
        Uses 5-minute cache per StatPal documentation
        
        Args:
            league_id: League ID filter (optional)
            
        Returns:
            List of teams
        """
        params = {}
        if league_id:
            params["league_id"] = league_id
        
        try:
            result = await self._make_request(
                "soccer/teams",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("teams", []))
            elif isinstance(result, list):
                return result
            else:
                logger.warning(f"Unexpected response format: {type(result)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching teams: {e}")
            return []
    
    async def get_standings(self, league_id: int) -> List[Dict[str, Any]]:
        """
        Get league standings
        Uses 5-minute cache per StatPal documentation
        
        Args:
            league_id: League ID
            
        Returns:
            League standings
        """
        try:
            result = await self._make_request(
                f"soccer/standings/{league_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("standings", []))
            elif isinstance(result, list):
                return result
            else:
                logger.warning(f"Unexpected response format: {type(result)}")
                return []
        except Exception as e:
            logger.error(f"Error fetching standings: {e}")
            return []


# Global instance
statpal_api_service = StatPalAPIService()

