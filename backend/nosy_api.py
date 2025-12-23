"""
NosyAPI Service Module
Handles all interactions with NosyAPI for betting matches data
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

NOSY_API_BASE_URL = "https://www.nosyapi.com/apiv2/service"
NOSY_API_TOKEN = os.environ.get("NOSY_API_TOKEN", "")


class NosyAPIService:
    """Service class for interacting with NosyAPI"""
    
    def __init__(self):
        self.base_url = NOSY_API_BASE_URL
        self.token = NOSY_API_TOKEN
        # NosyAPI might use different auth methods, we'll try Bearer token first
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }
    
    async def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make a GET request to NosyAPI
        
        Args:
            endpoint: API endpoint path (e.g., 'bettable-matches')
            params: Query parameters
            
        Returns:
            JSON response as dictionary
            
        Raises:
            Exception: If request fails
        """
        url = f"{self.base_url}/{endpoint}"
        
        # Prepare headers - try different authentication methods
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers, params=params)
                
                # Log request details for debugging (commented out to reduce noise)
                # logger.info(f"Request URL: {url}")
                # logger.info(f"Response status: {response.status_code}")
                
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            # More detailed error logging
            error_detail = f"Status: {e.response.status_code}, Response: {e.response.text}"
            logger.error(f"NosyAPI request failed: {error_detail}")
            raise Exception(f"API request failed: {error_detail}")
        except httpx.HTTPError as e:
            logger.error(f"NosyAPI request failed: {e}")
            raise Exception(f"API request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in NosyAPI request: {e}")
            raise
    
    async def get_match_types(self) -> List[Dict[str, Any]]:
        """Get available match types (Futbol, Basketbol, etc.)"""
        return await self._make_request("bettable-matches/type")
    
    async def get_countries(self, match_type: int = 1) -> List[Dict[str, Any]]:
        """Get active countries for a match type"""
        return await self._make_request("bettable-matches/country", {"type": match_type})
    
    async def get_leagues(self, match_type: int = 1, country: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get active leagues for a match type and optionally filtered by country"""
        params = {"type": match_type}
        if country:
            params["country"] = country
        return await self._make_request("bettable-matches/league", params)
    
    async def get_dates(self, match_type: int = 1, league: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available dates for matches"""
        params = {"type": match_type}
        if league:
            params["league"] = league
        return await self._make_request("bettable-matches/date", params)
    
    async def get_matches(
        self, 
        match_type: int = 1,
        league: Optional[str] = None,
        date: Optional[str] = None,
        country: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get betting program matches
        
        Args:
            match_type: Type of match (1=Futbol, 2=Basketbol, etc.)
            league: League name filter (optional)
            date: Date filter in YYYY-MM-DD format (optional)
            country: Country filter (optional)
            
        Returns:
            List of matches
        """
        params = {"type": match_type}
        if league:
            params["league"] = league
        if date:
            params["date"] = date
        if country:
            params["country"] = country
            
        return await self._make_request("bettable-matches", params)
    
    async def get_match_details(self, match_id: str) -> Dict[str, Any]:
        """Get detailed information for a specific match including all odds"""
        return await self._make_request("bettable-matches/details", {"matchID": match_id})
    
    async def get_popular_matches(self, match_type: int = 1) -> List[Dict[str, Any]]:
        """Get popular matches"""
        return await self._make_request("bettable-matches/popular", {"type": match_type})
    
    async def get_opening_odds(self, match_id: str) -> Dict[str, Any]:
        """Get opening odds for a match"""
        return await self._make_request("bettable-matches/opening-odds", {"matchID": match_id})


# Global instance
nosy_api_service = NosyAPIService()

