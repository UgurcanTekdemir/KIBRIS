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
        else:
            logger.info(f"StatPal API key configured: {self.api_key[:8]}...{self.api_key[-4:] if len(self.api_key) > 12 else '***'}")
        
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
        
        # Add access_key to params (StatPal API uses 'access_key' parameter)
        request_params = {}
        if self.api_key:
            request_params["access_key"] = self.api_key
        else:
            logger.error("STATPAL_API_KEY is not set! Cannot make request.")
            raise Exception("STATPAL_API_KEY is not configured")
        
        if params:
            request_params.update(params)
        
        logger.info(f"Making request to: {url}")
        logger.info(f"Request params (key masked): {list(request_params.keys())}")
        
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
                
                logger.info(f"StatPal API Request: {url}")
                logger.info(f"StatPal API Request params (key only): access_key={'*' * 10 if self.api_key else 'NOT SET'}")
                logger.info(f"Response status: {response.status_code}")
                
                # Handle HTTP 200 with 'invalid-request' per documentation
                if response.status_code == 200:
                    try:
                        data = response.json()
                        logger.info(f"StatPal API Response type: {type(data)}")
                        if isinstance(data, dict):
                            logger.info(f"StatPal API Response keys: {list(data.keys())}")
                            logger.info(f"StatPal API Response preview: {str(data)[:500]}")
                        elif isinstance(data, list):
                            logger.info(f"StatPal API Response is list with {len(data)} items")
                            if data and len(data) > 0:
                                logger.info(f"First item keys: {list(data[0].keys()) if isinstance(data[0], dict) else 'Not a dict'}")
                        
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
        Per StatPal API: GET /soccer/matches/live
        Returns matches for today and live matches
        Uses 30-second cache per StatPal documentation
        
        Returns:
            List of live matches in flattened format
        """
        try:
            logger.info("Fetching live matches from StatPal API: soccer/matches/live")
            result = await self._make_request(
                "soccer/matches/live",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            
            logger.info(f"StatPal API response type: {type(result)}")
            if isinstance(result, dict):
                logger.info(f"StatPal API response keys: {list(result.keys())}")
                logger.info(f"StatPal API response preview: {str(result)[:1000]}")
            
            # StatPal API returns: {"live_matches": {"league": [{"id": ..., "name": ..., "match": [...]}]}}
            # Or might return directly: {"league": [...]}
            matches = []
            
            # Handle live_matches wrapper
            if isinstance(result, dict) and "live_matches" in result:
                result = result["live_matches"]
                logger.info("Found 'live_matches' wrapper, extracted inner structure")
            
            if isinstance(result, dict):
                # Check for "league" key (nested structure)
                if "league" in result:
                    logger.info(f"Found 'league' key with {len(result.get('league', []))} leagues")
                    # Parse league structure
                    for league_data in result.get("league", []):
                        league_name = league_data.get("name", "Unknown League")
                        league_id = league_data.get("id")
                        country = league_data.get("country", "")
                        
                        # Get matches from this league
                        league_matches = league_data.get("match", [])
                        if not isinstance(league_matches, list):
                            league_matches = [league_matches] if league_matches else []
                        
                        logger.info(f"League '{league_name}' has {len(league_matches)} matches")
                        
                        # Flatten matches and add league info
                        for match in league_matches:
                            if isinstance(match, dict):
                                match["league_name"] = league_name
                                match["league_id"] = league_id
                                match["country"] = country
                                match["is_live"] = True  # Mark as live match
                                matches.append(match)
                # Check if result has direct "match" key
                elif "match" in result:
                    league_matches = result.get("match", [])
                    if not isinstance(league_matches, list):
                        league_matches = [league_matches] if league_matches else []
                    logger.info(f"Found direct 'match' key with {len(league_matches)} matches")
                    for match in league_matches:
                        if isinstance(match, dict):
                            match["is_live"] = True
                            matches.append(match)
                # Check if result is a list of matches
                elif isinstance(result, list):
                    logger.info(f"Response is direct list with {len(result)} matches")
                    matches = result
                # Try to find any list in the result
                else:
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0:
                            # Check if first item looks like a match
                            if isinstance(value[0], dict) and any(k in value[0] for k in ["home", "away", "match_id", "id"]):
                                logger.info(f"Found matches in field '{key}': {len(value)}")
                                matches = value
                                for match in matches:
                                    if isinstance(match, dict):
                                        match["is_live"] = True
                                break
            elif isinstance(result, list):
                logger.info(f"Response is list with {len(result)} matches")
                matches = result
                for match in matches:
                    if isinstance(match, dict):
                        match["is_live"] = True
            
            logger.info(f"Extracted {len(matches)} live matches")
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
        Get available leagues from StatPal API
        Per StatPal API: GET /soccer/leagues
        Returns list of soccer leagues with details including id, country, season, and date ranges.
        This endpoint data is updated every 12 hours.
        
        Returns:
            List of leagues with id, country, season, start_date, end_date
        """
        try:
            logger.info("Making request to StatPal API: soccer/leagues")
            result = await self._make_request(
                "soccer/leagues",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL  # 5 minutes cache
            )
            logger.info(f"StatPal API response type: {type(result)}")
            
            # Log full response structure for debugging
            if isinstance(result, dict):
                logger.info(f"StatPal API response keys: {list(result.keys())}")
                logger.info(f"StatPal API response preview: {str(result)[:1000]}")
            elif isinstance(result, list):
                logger.info(f"StatPal API response is list with {len(result)} items")
                if result and len(result) > 0:
                    logger.info(f"First item: {result[0]}")
            
            # Check for error responses
            if isinstance(result, dict):
                # Check for error status
                if result.get("status") == "error" or result.get("status") == "invalid-request":
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"StatPal API error response: {error_msg}")
                    return []
                
                # StatPal API returns: {"leagues": {"sport": "soccer", "league": [...]}}
                # Check for nested structure first
                leagues = None
                
                # Check if "leagues" key exists and contains "league" array
                if "leagues" in result:
                    leagues_obj = result["leagues"]
                    if isinstance(leagues_obj, dict) and "league" in leagues_obj:
                        leagues = leagues_obj["league"]
                        logger.info(f"Found leagues in nested structure 'leagues.league': {len(leagues) if isinstance(leagues, list) else 'Not a list'}")
                
                # If not found, try direct field names
                if leagues is None:
                    for field_name in ["data", "league", "results", "items", "response"]:
                        if field_name in result:
                            leagues = result[field_name]
                            logger.info(f"Found leagues in field '{field_name}': {len(leagues) if isinstance(leagues, list) else 'Not a list'}")
                            break
                
                # If still not found, check if all values are lists
                if leagues is None:
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0:
                            # Check if first item looks like a league (has id, name, country, etc.)
                            if isinstance(value[0], dict):
                                # Check for league-like fields
                                first_item = value[0]
                                if any(k in first_item for k in ["id", "league_id", "name", "league_name", "country", "season"]):
                                    leagues = value
                                    logger.info(f"Found leagues in field '{key}': {len(leagues)}")
                                    break
                
                if leagues is None:
                    logger.warning(f"No leagues found in response. Available keys: {list(result.keys())}")
                    if "leagues" in result:
                        logger.warning(f"Leagues object keys: {list(result['leagues'].keys()) if isinstance(result['leagues'], dict) else 'Not a dict'}")
                    return []
                
                if isinstance(leagues, list):
                    logger.info(f"Extracted {len(leagues)} leagues from dict response")
                    if leagues and len(leagues) > 0:
                        sample_league = leagues[0]
                        logger.info(f"Sample league structure: {list(sample_league.keys()) if isinstance(sample_league, dict) else 'Not a dict'}")
                        logger.info(f"Sample league data: {sample_league}")
                    return leagues
                else:
                    logger.warning(f"Leagues field is not a list: {type(leagues)}, value: {leagues}")
                    return []
            elif isinstance(result, list):
                logger.info(f"Received list response with {len(result)} leagues")
                if result and len(result) > 0:
                    sample_league = result[0]
                    logger.info(f"Sample league keys: {list(sample_league.keys()) if isinstance(sample_league, dict) else 'Not a dict'}")
                    logger.info(f"Sample league data: {sample_league}")
                return result
            else:
                logger.warning(f"Unexpected response format: {type(result)}, value: {str(result)[:500]}")
                return []
        except Exception as e:
            logger.error(f"Error fetching leagues: {e}")
            logger.exception(e)
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
    
    async def get_match_stats(self, match_id: str) -> Dict[str, Any]:
        """
        Get live in-depth match stats (possession, shots, fouls, corners, etc.)
        Per StatPal documentation: Live In-Depth Match Stats
        
        Args:
            match_id: Match ID
            
        Returns:
            Detailed match statistics
        """
        try:
            # Try different possible endpoints
            endpoints_to_try = [
                f"soccer/matches/{match_id}/stats",
                f"soccer/matches/{match_id}/live-stats",
                f"soccer/live-match-stats/{match_id}",
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        use_cache=True,
                        cache_ttl=LIVE_SCORES_CACHE_TTL  # Live stats update frequently
                    )
                    if result:
                        return result
                except Exception:
                    continue
            
            # If no endpoint works, return empty dict
            logger.warning(f"Match stats endpoint not found for match {match_id}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching match stats: {e}")
            return {}
    
    async def get_upcoming_schedules(
        self,
        league_id: Optional[int] = None,
        date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get upcoming match schedules
        Per StatPal documentation: Upcoming Schedules
        
        Args:
            league_id: League ID filter (optional)
            date: Date filter in YYYY-MM-DD format (optional)
            
        Returns:
            List of upcoming matches
        """
        params = {}
        if league_id:
            params["league_id"] = league_id
        if date:
            params["date"] = date
        
        try:
            # Try different possible endpoints
            endpoints_to_try = [
                "soccer/matches/upcoming",
                "soccer/schedules",
                "soccer/upcoming-schedule",
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        params=params if params else None,
                        use_cache=True,
                        cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
                    )
                    if result:
                        # Parse similar to live matches structure
                        matches = []
                        if isinstance(result, dict):
                            if "upcoming" in result:
                                result = result["upcoming"]
                            if "schedules" in result:
                                result = result["schedules"]
                            if "league" in result:
                                for league_data in result.get("league", []):
                                    league_name = league_data.get("name", "Unknown League")
                                    league_id_data = league_data.get("id")
                                    country = league_data.get("country", "")
                                    
                                    league_matches = league_data.get("match", [])
                                    if not isinstance(league_matches, list):
                                        league_matches = [league_matches] if league_matches else []
                                    
                                    for match in league_matches:
                                        if isinstance(match, dict):
                                            match["league_name"] = league_name
                                            match["league_id"] = league_id_data
                                            match["country"] = country
                                            matches.append(match)
                        return matches
                except Exception:
                    continue
            
            logger.warning("Upcoming schedules endpoint not found")
            return []
        except Exception as e:
            logger.error(f"Error fetching upcoming schedules: {e}")
            return []
    
    async def get_top_scorers(self, league_id: int) -> List[Dict[str, Any]]:
        """
        Get league top scorers
        Per StatPal documentation: League Top Scorers
        
        Args:
            league_id: League ID
            
        Returns:
            List of top scorers
        """
        try:
            # Try different possible endpoints
            endpoints_to_try = [
                f"soccer/leagues/{league_id}/top-scorers",
                f"soccer/top-scorers/{league_id}",
                f"soccer/scoring-leaders/{league_id}",
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        use_cache=True,
                        cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
                    )
                    if result:
                        if isinstance(result, dict):
                            return result.get("data", result.get("scorers", result.get("players", [])))
                        elif isinstance(result, list):
                            return result
                        return []
                except Exception:
                    continue
            
            logger.warning(f"Top scorers endpoint not found for league {league_id}")
            return []
        except Exception as e:
            logger.error(f"Error fetching top scorers: {e}")
            return []
    
    async def get_injuries(self, team_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get player injuries and suspensions
        Per StatPal documentation: Injuries and Suspensions
        
        Args:
            team_id: Team ID filter (optional)
            
        Returns:
            List of injured/suspended players
        """
        params = {}
        if team_id:
            params["team_id"] = team_id
        
        try:
            result = await self._make_request(
                "soccer/injuries",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("injuries", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching injuries: {e}")
            return []
    
    async def get_head_to_head(
        self,
        team1_id: int,
        team2_id: int
    ) -> Dict[str, Any]:
        """
        Get head-to-head statistics between two teams
        Per StatPal documentation: Head To Head Stats
        
        Args:
            team1_id: First team ID
            team2_id: Second team ID
            
        Returns:
            Head-to-head statistics
        """
        try:
            # Try different possible endpoints
            endpoints_to_try = [
                f"soccer/teams/{team1_id}/vs/{team2_id}",
                f"soccer/head-to-head/{team1_id}/{team2_id}",
                f"soccer/h2h/{team1_id}/{team2_id}",
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        use_cache=True,
                        cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
                    )
                    if result:
                        return result
                except Exception:
                    continue
            
            logger.warning(f"Head-to-head endpoint not found for teams {team1_id} vs {team2_id}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching head-to-head stats: {e}")
            return {}
    
    async def get_team_stats(self, team_id: int) -> Dict[str, Any]:
        """
        Get detailed team statistics
        Per StatPal documentation: Detailed Team Stats
        
        Args:
            team_id: Team ID
            
        Returns:
            Team statistics
        """
        try:
            result = await self._make_request(
                f"soccer/teams/{team_id}/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching team stats: {e}")
            return {}
    
    async def get_player_stats(self, player_id: int) -> Dict[str, Any]:
        """
        Get detailed player statistics
        Per StatPal documentation: Detailed Player Stats
        
        Args:
            player_id: Player ID
            
        Returns:
            Player statistics
        """
        try:
            result = await self._make_request(
                f"soccer/players/{player_id}/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching player stats: {e}")
            return {}
    
    async def get_team_transfers(self, team_id: int) -> List[Dict[str, Any]]:
        """
        Get team transfer history
        Per StatPal documentation: Team Transfer History
        
        Args:
            team_id: Team ID
            
        Returns:
            List of transfers
        """
        try:
            result = await self._make_request(
                f"soccer/teams/{team_id}/transfers",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("transfers", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching team transfers: {e}")
            return []
    
    async def get_match_odds(
        self,
        match_id: str,
        inplay: bool = False
    ) -> Dict[str, Any]:
        """
        Get pre-match or inplay odds markets
        Per StatPal documentation: https://statpal.io/docs/#/paths/soccer-odds-live-markets/get
        
        Args:
            match_id: Match ID
            inplay: If True, get inplay odds; if False, get pre-match odds
            
        Returns:
            Odds markets data
        """
        try:
            # Try different endpoint formats based on StatPal API documentation
            endpoints_to_try = []
            
            if inplay:
                # Per StatPal API documentation: /soccer/odds/live returns odds for a match
                # /soccer/odds/live/markets returns market list
                # For specific match odds, try different endpoints
                endpoints_to_try = [
                    # First try to get odds directly for the match (this is the correct endpoint)
                    ("soccer/odds/live", {"match_id": match_id} if match_id else {}),
                    (f"soccer/odds/live/{match_id}", {}),
                    (f"soccer/matches/{match_id}/odds/live", {}),
                ]
            else:
                # Pre-match endpoints
                endpoints_to_try = [
                    # First try to get odds directly for the match
                    (f"soccer/odds/pre-match", {"match_id": match_id} if match_id else {}),
                    (f"soccer/odds/pre-match/{match_id}", {}),
                    (f"soccer/matches/{match_id}/odds", {}),
                    # Then try market list
                    ("soccer/odds/pre-match/markets", {"match_id": match_id} if match_id else {}),
                    ("soccer/odds/pre-match/markets", {}),  # Get all pre-match markets
                    ("soccer/odds", {"match_id": match_id} if match_id else {}),
                ]
            
            result = None
            for endpoint, params in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        params=params if params else None,
                        use_cache=True,
                        cache_ttl=LIVE_SCORES_CACHE_TTL if inplay else OTHER_ENDPOINTS_CACHE_TTL
                    )
                    
                    # Check for error response
                    if result and isinstance(result, dict) and "error" in result:
                        logger.debug(f"StatPal API error for {endpoint}: {result.get('error')}")
                        result = None
                        continue
                    
                    if result and isinstance(result, dict) and len(result) > 0:
                        # Check if this is the live_match format with odds (for inplay)
                        if "live_match" in result:
                            live_match = result.get("live_match", {})
                            # Verify match_id matches
                            match_info = live_match.get("match_info", {})
                            if (match_id and 
                                (match_info.get("main_id") == match_id or
                                 match_info.get("fallback_id_1") == match_id or
                                 match_info.get("fallback_id_2") == match_id or
                                 match_info.get("fallback_id_3") == match_id)):
                                # Return the odds data
                                return {
                                    "match_info": match_info,
                                    "odds": live_match.get("odds", []),
                                    "stats": live_match.get("stats", {}),
                                    "team_info": live_match.get("team_info", {}),
                                }
                            elif not match_id:
                                # No match_id filter, return the whole result
                                return result
                        # Check if this is pre_match format (for pre-match)
                        elif "pre_match" in result or "match" in result:
                            pre_match = result.get("pre_match") or result.get("match", {})
                            match_info = pre_match.get("match_info", {}) if isinstance(pre_match, dict) else {}
                            if (match_id and 
                                (match_info.get("main_id") == match_id or
                                 match_info.get("fallback_id_1") == match_id or
                                 match_info.get("fallback_id_2") == match_id or
                                 match_info.get("fallback_id_3") == match_id)):
                                # Return the odds data
                                return {
                                    "match_info": match_info,
                                    "odds": pre_match.get("odds", []) if isinstance(pre_match, dict) else [],
                                    "stats": pre_match.get("stats", {}) if isinstance(pre_match, dict) else {},
                                    "team_info": pre_match.get("team_info", {}) if isinstance(pre_match, dict) else {},
                                }
                            elif not match_id:
                                return result
                        # Parse other response formats
                        if match_id:
                            # Check if result has matches/odds array
                            if "matches" in result:
                                matches = result.get("matches", [])
                                if isinstance(matches, list):
                                    for match_odds in matches:
                                        if (match_odds.get("match_id") == match_id or
                                            match_odds.get("main_id") == match_id or
                                            match_odds.get("id") == match_id):
                                            return match_odds
                            elif "odds" in result:
                                odds_list = result.get("odds", [])
                                if isinstance(odds_list, list):
                                    for odds_data in odds_list:
                                        if (odds_data.get("match_id") == match_id or
                                            odds_data.get("main_id") == match_id or
                                            odds_data.get("id") == match_id):
                                            return odds_data
                            # If structure is different, return the whole result
                            return result
                        else:
                            # No match_id filter, return all odds
                            return result
                    elif result and isinstance(result, list) and len(result) > 0:
                        # If result is a list, it might be a list of markets
                        # Check if it's market list (has 'id' and 'name' fields)
                        if result and isinstance(result[0], dict) and "id" in result[0] and "name" in result[0]:
                            # This is a list of available markets
                            # Return the market list - we'll need to fetch odds for each market separately
                            return {
                                "markets": result,
                                "match_id": match_id,
                                "is_market_list": True
                            }
                        # Otherwise, try to find match by ID
                        if match_id:
                            for odds_data in result:
                                if (odds_data.get("match_id") == match_id or
                                    odds_data.get("main_id") == match_id or
                                    odds_data.get("id") == match_id):
                                    return odds_data
                        return result[0] if result else {}
                except Exception as e:
                    logger.debug(f"Odds endpoint {endpoint} failed: {e}")
                    continue
            
            # If no odds data found, try to get market list as fallback
            # This should only happen if the direct odds endpoint doesn't work
            if not result or (isinstance(result, dict) and (len(result) == 0 or "error" in result)):
                try:
                    # Try market list endpoint as fallback
                    market_list_endpoint = "soccer/odds/live/markets" if inplay else "soccer/odds/pre-match/markets"
                    market_list_result = await self._make_request(
                        market_list_endpoint,
                        params={},  # Market list doesn't need match_id
                        use_cache=True,
                        cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
                    )
                    if market_list_result and isinstance(market_list_result, list) and len(market_list_result) > 0:
                        # Check if it's a market list
                        if market_list_result[0].get("id") and market_list_result[0].get("name"):
                            return {
                                "markets": market_list_result,
                                "match_id": match_id,
                                "is_market_list": True
                            }
                except Exception as e:
                    logger.debug(f"Failed to get market list: {e}")
                    pass
            
            # If no endpoint works, return empty dict
            logger.warning(f"Match odds endpoint not found for match {match_id}, inplay={inplay}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching match odds: {e}")
            logger.exception(e)
            return {}
    
    async def get_live_odds(self) -> List[Dict[str, Any]]:
        """
        Get all live matches with live odds available
        Per StatPal API: GET /soccer/odds/live
        This endpoint returns all live matches with live odds available.
        
        Returns:
            List of live matches with odds data
        """
        try:
            logger.info("Fetching all live odds from StatPal API: soccer/odds/live")
            result = await self._make_request(
                "soccer/odds/live",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL  # Use live cache TTL (30 seconds)
            )
            
            logger.info(f"StatPal live odds response type: {type(result)}")
            
            # Handle different response formats
            if isinstance(result, dict):
                # Check for error responses
                if result.get("status") == "error" or result.get("status") == "invalid-request":
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"StatPal API error response: {error_msg}")
                    return []
                
                # Try different possible field names
                matches = None
                for field_name in ["data", "matches", "live_matches", "odds", "results", "items"]:
                    if field_name in result:
                        matches = result[field_name]
                        logger.info(f"Found live odds in field '{field_name}': {len(matches) if isinstance(matches, list) else 'Not a list'}")
                        break
                
                if matches is None:
                    # If no known field, check if all values are lists
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0:
                            # Check if first item looks like a match with odds
                            if isinstance(value[0], dict):
                                matches = value
                                logger.info(f"Found live odds in field '{key}': {len(matches)}")
                                break
                
                if matches is None:
                    logger.warning(f"No live odds found in response. Available keys: {list(result.keys())}")
                    return []
                
                if isinstance(matches, list):
                    logger.info(f"Extracted {len(matches)} live matches with odds")
                    return matches
                else:
                    logger.warning(f"Live odds field is not a list: {type(matches)}")
                    return []
            elif isinstance(result, list):
                logger.info(f"Received list response with {len(result)} live matches with odds")
                return result
            else:
                logger.warning(f"Unexpected response format: {type(result)}, value: {str(result)[:200]}")
                return []
        except Exception as e:
            logger.error(f"Error fetching live odds: {e}")
            logger.exception(e)
            return []
    
    async def get_seasons(self) -> List[Dict[str, Any]]:
        """
        Get available seasons
        Per StatPal API: GET /soccer/leagues/seasons
        
        Returns:
            List of seasons
        """
        try:
            result = await self._make_request(
                "soccer/leagues/seasons",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("seasons", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching seasons: {e}")
            return []
    
    async def get_matches_daily(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get matches for today or specific date (recent/upcoming)
        Per StatPal API: GET /soccer/matches/daily
        
        Args:
            date: Date filter in YYYY-MM-DD format (optional, defaults to today)
            
        Returns:
            List of matches
        """
        params = {}
        if date:
            params["date"] = date
        
        try:
            result = await self._make_request(
                "soccer/matches/daily",
                params=params if params else None,
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            # Parse similar to live matches structure
            matches = []
            if isinstance(result, dict):
                if "daily" in result:
                    result = result["daily"]
                if "matches" in result:
                    result = result["matches"]
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
            elif isinstance(result, list):
                matches = result
            return matches
        except Exception as e:
            logger.error(f"Error fetching daily matches: {e}")
            return []
    
    async def get_league_matches(self, league_id: int, season: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get matches by league and season
        Per StatPal API: GET /soccer/leagues/{league-id}/matches
        
        Args:
            league_id: League ID
            season: Season filter (optional)
            
        Returns:
            List of matches
        """
        params = {}
        if season:
            params["season"] = season
        
        try:
            # Convert league_id to string for URL (StatPal API accepts both)
            league_id_str = str(league_id)
            logger.info(f"Fetching matches for league ID: {league_id_str}")
            
            result = await self._make_request(
                f"soccer/leagues/{league_id_str}/matches",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            
            logger.info(f"StatPal API response type: {type(result)}")
            if isinstance(result, dict):
                logger.info(f"StatPal API response keys: {list(result.keys())}")
                logger.info(f"StatPal API response preview: {str(result)[:500]}")
            
            # Parse similar to live matches structure
            matches = []
            if isinstance(result, dict):
                # Check for nested structure: {"matches": {...}} or {"league": [...]}
                if "matches" in result:
                    result = result["matches"]
                
                # Check if result is a dict with "league" key (nested structure)
                if "league" in result:
                    for league_data in result.get("league", []):
                        league_matches = league_data.get("match", [])
                        if not isinstance(league_matches, list):
                            league_matches = [league_matches] if league_matches else []
                        for match in league_matches:
                            if isinstance(match, dict):
                                match["league_id"] = league_id_str
                                match["league_name"] = league_data.get("name", "")
                                match["country"] = league_data.get("country", "")
                                matches.append(match)
                # Check if result has direct "match" key
                elif "match" in result:
                    league_matches = result.get("match", [])
                    if not isinstance(league_matches, list):
                        league_matches = [league_matches] if league_matches else []
                    matches.extend(league_matches)
                # Check if result has direct array of matches
                elif isinstance(result, list):
                    matches = result
                # Try to find any list in the result
                else:
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0:
                            # Check if first item looks like a match
                            if isinstance(value[0], dict) and any(k in value[0] for k in ["home", "away", "match_id", "id"]):
                                matches = value
                                logger.info(f"Found matches in field '{key}': {len(matches)}")
                                break
            elif isinstance(result, list):
                logger.info(f"Received list response with {len(result)} matches")
                matches = result
            
            logger.info(f"Extracted {len(matches)} matches for league {league_id_str}")
            return matches
        except Exception as e:
            logger.error(f"Error fetching league matches: {e}")
            logger.exception(e)
            return []
    
    async def get_league_match_stats(self, league_id: int) -> Dict[str, Any]:
        """
        Get match details/stats by league
        Per StatPal API: GET /soccer/leagues/{league-id}/matches/stats
        
        Args:
            league_id: League ID
            
        Returns:
            League match statistics
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/matches/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching league match stats: {e}")
            return {}
    
    async def get_league_stats(self, league_id: int) -> Dict[str, Any]:
        """
        Get league statistics
        Per StatPal API: GET /soccer/leagues/{league-id}/stats
        
        Args:
            league_id: League ID
            
        Returns:
            League statistics
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching league stats: {e}")
            return {}
    
    async def get_coach(self, coach_id: int) -> Dict[str, Any]:
        """
        Get coach information
        Per StatPal API: GET /soccer/coaches/{coach_id}
        
        Args:
            coach_id: Coach ID
            
        Returns:
            Coach information
        """
        try:
            result = await self._make_request(
                f"soccer/coaches/{coach_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching coach: {e}")
            return {}
    
    async def get_image(self, image_type: Optional[str] = None, image_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get image data
        Per StatPal API: GET /soccer/images
        
        Args:
            image_type: Type of image (optional)
            image_id: Image ID (optional)
            
        Returns:
            Image data
        """
        params = {}
        if image_type:
            params["type"] = image_type
        if image_id:
            params["id"] = image_id
        
        try:
            result = await self._make_request(
                "soccer/images",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching image: {e}")
            return {}
    
    async def get_league_prematch_odds(self, league_id: int) -> List[Dict[str, Any]]:
        """
        Get pre-match odds by league
        Per StatPal API: GET /soccer/leagues/{league-id}/odds/prematch
        
        Args:
            league_id: League ID
            
        Returns:
            List of pre-match odds
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/odds/prematch",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("odds", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching league prematch odds: {e}")
            return []
    
    async def get_live_odds_match_states(self) -> List[Dict[str, Any]]:
        """
        Get live odds match states
        Per StatPal API: GET /soccer/odds/live/match-states
        
        Returns:
            List of match states with odds
        """
        try:
            result = await self._make_request(
                "soccer/odds/live/match-states",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("states", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching live odds match states: {e}")
            return []
    
    async def get_team(self, team_id: int) -> Dict[str, Any]:
        """
        Get team information
        Per StatPal API: GET /soccer/teams/{team_id}
        
        Args:
            team_id: Team ID
            
        Returns:
            Team information
        """
        try:
            result = await self._make_request(
                f"soccer/teams/{team_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching team: {e}")
            return {}
    
    async def get_player(self, player_id: int) -> Dict[str, Any]:
        """
        Get player information
        Per StatPal API: GET /soccer/players/{player_id}
        
        Args:
            player_id: Player ID
            
        Returns:
            Player information
        """
        try:
            result = await self._make_request(
                f"soccer/players/{player_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching player: {e}")
            return {}
    
    async def get_seasons(self) -> List[Dict[str, Any]]:
        """
        Get available seasons
        Per StatPal API: GET /soccer/leagues/seasons
        
        Returns:
            List of seasons
        """
        try:
            result = await self._make_request(
                "soccer/leagues/seasons",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("seasons", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching seasons: {e}")
            return []
    
    async def get_matches_daily(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get matches for today or specific date (recent/upcoming)
        Per StatPal API: GET /soccer/matches/daily
        
        Args:
            date: Date filter in YYYY-MM-DD format (optional, defaults to today)
            
        Returns:
            List of matches
        """
        params = {}
        if date:
            params["date"] = date
        
        try:
            result = await self._make_request(
                "soccer/matches/daily",
                params=params if params else None,
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            # Parse similar to live matches structure
            matches = []
            if isinstance(result, dict):
                if "daily" in result:
                    result = result["daily"]
                if "matches" in result:
                    result = result["matches"]
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
            elif isinstance(result, list):
                matches = result
            return matches
        except Exception as e:
            logger.error(f"Error fetching daily matches: {e}")
            return []
    
    async def get_league_matches(self, league_id: int, season: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get matches by league and season
        Per StatPal API: GET /soccer/leagues/{league-id}/matches
        
        Args:
            league_id: League ID
            season: Season filter (optional)
            
        Returns:
            List of matches
        """
        params = {}
        if season:
            params["season"] = season
        
        try:
            # Convert league_id to string for URL (StatPal API accepts both)
            league_id_str = str(league_id)
            logger.info(f"Fetching matches for league ID: {league_id_str}")
            
            result = await self._make_request(
                f"soccer/leagues/{league_id_str}/matches",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            
            logger.info(f"StatPal API response type: {type(result)}")
            if isinstance(result, dict):
                logger.info(f"StatPal API response keys: {list(result.keys())}")
                logger.info(f"StatPal API response preview: {str(result)[:500]}")
            
            # Parse similar to live matches structure
            matches = []
            if isinstance(result, dict):
                # Check for nested structure: {"matches": {...}} or {"league": [...]}
                if "matches" in result:
                    result = result["matches"]
                
                # Check if result is a dict with "league" key (nested structure)
                if "league" in result:
                    for league_data in result.get("league", []):
                        league_matches = league_data.get("match", [])
                        if not isinstance(league_matches, list):
                            league_matches = [league_matches] if league_matches else []
                        for match in league_matches:
                            if isinstance(match, dict):
                                match["league_id"] = league_id_str
                                match["league_name"] = league_data.get("name", "")
                                match["country"] = league_data.get("country", "")
                                matches.append(match)
                # Check if result has direct "match" key
                elif "match" in result:
                    league_matches = result.get("match", [])
                    if not isinstance(league_matches, list):
                        league_matches = [league_matches] if league_matches else []
                    matches.extend(league_matches)
                # Check if result has direct array of matches
                elif isinstance(result, list):
                    matches = result
                # Try to find any list in the result
                else:
                    for key, value in result.items():
                        if isinstance(value, list) and len(value) > 0:
                            # Check if first item looks like a match
                            if isinstance(value[0], dict) and any(k in value[0] for k in ["home", "away", "match_id", "id"]):
                                matches = value
                                logger.info(f"Found matches in field '{key}': {len(matches)}")
                                break
            elif isinstance(result, list):
                logger.info(f"Received list response with {len(result)} matches")
                matches = result
            
            logger.info(f"Extracted {len(matches)} matches for league {league_id_str}")
            return matches
        except Exception as e:
            logger.error(f"Error fetching league matches: {e}")
            logger.exception(e)
            return []
    
    async def get_league_match_stats(self, league_id: int) -> Dict[str, Any]:
        """
        Get match details/stats by league
        Per StatPal API: GET /soccer/leagues/{league-id}/matches/stats
        
        Args:
            league_id: League ID
            
        Returns:
            League match statistics
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/matches/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching league match stats: {e}")
            return {}
    
    async def get_league_stats(self, league_id: int) -> Dict[str, Any]:
        """
        Get league statistics
        Per StatPal API: GET /soccer/leagues/{league-id}/stats
        
        Args:
            league_id: League ID
            
        Returns:
            League statistics
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/stats",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching league stats: {e}")
            return {}
    
    async def get_coach(self, coach_id: int) -> Dict[str, Any]:
        """
        Get coach information
        Per StatPal API: GET /soccer/coaches/{coach_id}
        
        Args:
            coach_id: Coach ID
            
        Returns:
            Coach information
        """
        try:
            result = await self._make_request(
                f"soccer/coaches/{coach_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching coach: {e}")
            return {}
    
    async def get_image(self, image_type: Optional[str] = None, image_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get image data
        Per StatPal API: GET /soccer/images
        
        Args:
            image_type: Type of image (optional)
            image_id: Image ID (optional)
            
        Returns:
            Image data
        """
        params = {}
        if image_type:
            params["type"] = image_type
        if image_id:
            params["id"] = image_id
        
        try:
            result = await self._make_request(
                "soccer/images",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching image: {e}")
            return {}
    
    async def get_league_prematch_odds(self, league_id: int) -> List[Dict[str, Any]]:
        """
        Get pre-match odds by league
        Per StatPal API: GET /soccer/leagues/{league-id}/odds/prematch
        
        Args:
            league_id: League ID
            
        Returns:
            List of pre-match odds
        """
        try:
            result = await self._make_request(
                f"soccer/leagues/{league_id}/odds/prematch",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("odds", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching league prematch odds: {e}")
            return []
    
    async def get_live_odds_match_states(self) -> List[Dict[str, Any]]:
        """
        Get live odds match states
        Per StatPal API: GET /soccer/odds/live/match-states
        
        Returns:
            List of match states with odds
        """
        try:
            result = await self._make_request(
                "soccer/odds/live/match-states",
                use_cache=True,
                cache_ttl=LIVE_SCORES_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("states", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching live odds match states: {e}")
            return []
    
    async def get_team(self, team_id: int) -> Dict[str, Any]:
        """
        Get team information
        Per StatPal API: GET /soccer/teams/{team_id}
        
        Args:
            team_id: Team ID
            
        Returns:
            Team information
        """
        try:
            result = await self._make_request(
                f"soccer/teams/{team_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching team: {e}")
            return {}
    
    async def get_player(self, player_id: int) -> Dict[str, Any]:
        """
        Get player information
        Per StatPal API: GET /soccer/players/{player_id}
        
        Args:
            player_id: Player ID
            
        Returns:
            Player information
        """
        try:
            result = await self._make_request(
                f"soccer/players/{player_id}",
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            return result if isinstance(result, dict) else {}
        except Exception as e:
            logger.error(f"Error fetching player: {e}")
            return {}
    
    async def get_injuries_suspensions(self, team_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get injuries and suspensions
        Per StatPal API: GET /soccer/injuries-suspensions
        
        Args:
            team_id: Team ID filter (optional)
            
        Returns:
            List of injuries and suspensions
        """
        params = {}
        if team_id:
            params["team_id"] = team_id
        
        try:
            result = await self._make_request(
                "soccer/injuries-suspensions",
                params=params if params else None,
                use_cache=True,
                cache_ttl=OTHER_ENDPOINTS_CACHE_TTL
            )
            if isinstance(result, dict):
                return result.get("data", result.get("injuries", []))
            elif isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error(f"Error fetching injuries-suspensions: {e}")
            return []


# Global instance
statpal_api_service = StatPalAPIService()

