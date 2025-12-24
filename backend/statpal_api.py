"""
StatPal API Service Module
Handles all interactions with StatPal API for soccer livescores and match data
"""
import os
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

STATPAL_API_BASE_URL = "https://statpal.io/api/v2"
STATPAL_API_KEY = os.environ.get("STATPAL_API_KEY", "")


class StatPalAPIService:
    """Service class for interacting with StatPal API"""
    
    def __init__(self):
        self.base_url = STATPAL_API_BASE_URL
        self.api_key = STATPAL_API_KEY
        if not self.api_key:
            logger.warning("STATPAL_API_KEY is not set. Requests will fail.")
    
    async def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make a GET request to StatPal API
        
        Args:
            endpoint: API endpoint path (e.g., 'soccer/matches/live')
            params: Query parameters (access_key will be added automatically)
            
        Returns:
            JSON response as dictionary
            
        Raises:
            Exception: If request fails
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Add access_key to params
        request_params = {"access_key": self.api_key}
        if params:
            request_params.update(params)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=request_params)
                
                logger.debug(f"StatPal API Request: {url}")
                logger.debug(f"Response status: {response.status_code}")
                
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = f"Status: {e.response.status_code}, Response: {e.response.text}"
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
        
        Returns:
            List of live matches in flattened format
        """
        try:
            result = await self._make_request("soccer/matches/live")
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
            result = await self._make_request("soccer/matches/live")
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
            match_id: Match ID
            
        Returns:
            Match details
        """
        try:
            result = await self._make_request(f"soccer/matches/{match_id}")
            if isinstance(result, dict):
                return result.get("data", result)
            return result
        except Exception as e:
            logger.error(f"Error fetching match details: {e}")
            return {}
    
    async def get_leagues(self) -> List[Dict[str, Any]]:
        """
        Get available leagues
        
        Returns:
            List of leagues
        """
        try:
            result = await self._make_request("soccer/leagues")
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
        
        Args:
            league_id: League ID filter (optional)
            
        Returns:
            List of teams
        """
        params = {}
        if league_id:
            params["league_id"] = league_id
        
        try:
            result = await self._make_request("soccer/teams", params)
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
        
        Args:
            league_id: League ID
            
        Returns:
            League standings
        """
        try:
            result = await self._make_request(f"soccer/standings/{league_id}")
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

