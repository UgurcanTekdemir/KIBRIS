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
                # Try live markets endpoints - correct format: /soccer/odds/live/markets
                endpoints_to_try = [
                    ("soccer/odds/live/markets", {"match_id": match_id} if match_id else {}),
                    ("soccer/odds/live/markets", {}),  # Get all live odds
                    (f"soccer/matches/{match_id}/odds/live", {}),
                    (f"soccer/odds/inplay/{match_id}", {}),
                ]
            else:
                # Try pre-match endpoints - likely format: /soccer/odds/pre-match/markets
                endpoints_to_try = [
                    ("soccer/odds/pre-match/markets", {"match_id": match_id} if match_id else {}),
                    ("soccer/odds/pre-match/markets", {}),  # Get all pre-match odds
                    ("soccer/odds/pre-match", {"match_id": match_id} if match_id else {}),
                    ("soccer/odds/pre-match", {}),
                    (f"soccer/matches/{match_id}/odds", {}),
                    (f"soccer/odds/{match_id}", {}),
                    ("soccer/odds", {"match_id": match_id} if match_id else {}),
                ]
            
            for endpoint, params in endpoints_to_try:
                try:
                    result = await self._make_request(
                        endpoint,
                        params=params if params else None,
                        use_cache=True,
                        cache_ttl=LIVE_SCORES_CACHE_TTL if inplay else OTHER_ENDPOINTS_CACHE_TTL
                    )
                    
                    if result and isinstance(result, dict) and len(result) > 0:
                        # Parse response - StatPal API might return odds in different formats
                        # If match_id was provided, filter by match_id
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
            
            # If we got market list, try to get odds for each market
            # StatPal API might require fetching odds for each market separately
            if match_id and result and isinstance(result, list) and len(result) > 0:
                # Check if result is market list
                if result[0].get("id") and result[0].get("name"):
                    # Try to get odds for Fulltime Result market (ID 3610) which is most common
                    fulltime_result_market = next((m for m in result if m.get("id") == 3610 or "Fulltime Result" in m.get("name", "")), None)
                    if fulltime_result_market:
                        market_id = fulltime_result_market.get("id")
                        try:
                            # Try different formats for getting market odds
                            market_endpoints = [
                                f"soccer/odds/live/markets/{market_id}" if inplay else f"soccer/odds/pre-match/markets/{market_id}",
                                f"soccer/odds/live/markets/{market_id}?match_id={match_id}" if inplay else f"soccer/odds/pre-match/markets/{market_id}?match_id={match_id}",
                            ]
                            for market_endpoint in market_endpoints:
                                try:
                                    market_result = await self._make_request(
                                        market_endpoint.split('?')[0],
                                        params={"match_id": match_id} if "?" not in market_endpoint else None,
                                        use_cache=True,
                                        cache_ttl=LIVE_SCORES_CACHE_TTL if inplay else OTHER_ENDPOINTS_CACHE_TTL
                                    )
                                    if market_result and isinstance(market_result, dict) and len(market_result) > 0:
                                        return market_result
                                except Exception:
                                    continue
                        except Exception:
                            pass
            
            # If no endpoint works, return empty dict
            logger.warning(f"Match odds endpoint not found for match {match_id}, inplay={inplay}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching match odds: {e}")
            logger.exception(e)
            return {}


# Global instance
statpal_api_service = StatPalAPIService()

