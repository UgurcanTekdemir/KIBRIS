"""
The Odds API Service Module
Fetches real match odds from The Odds API.
"""
import os
from typing import List, Dict, Any, Optional

import httpx
import logging


logger = logging.getLogger(__name__)

THE_ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4"
THE_ODDS_API_KEY = os.environ.get("THE_ODDS_API_KEY", "")

# Default target leagues (can be extended)
DEFAULT_SPORT_KEYS = [
    "soccer_turkey_super_league",
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
]


class TheOddsApiService:
    """Service class for interacting with The Odds API."""

    def __init__(self) -> None:
        if not THE_ODDS_API_KEY:
            logger.warning("THE_ODDS_API_KEY is not set. Requests will fail.")
        self.api_key = THE_ODDS_API_KEY
        self.base_url = THE_ODDS_API_BASE_URL
        self.default_params = {
            "apiKey": self.api_key,
            "regions": "eu",
            "markets": "h2h",
            "oddsFormat": "decimal",
        }

    async def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        query = {**self.default_params, **(params or {})}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=query)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "The Odds API request failed: %s %s",
                    exc.response.status_code,
                    exc.response.text,
                )
                raise
            return response.json()

    async def get_odds_for_sport(self, sport_key: str) -> List[Dict[str, Any]]:
        """
        Fetch odds for a single sport.
        Returns list of events with bookmaker odds.
        """
        path = f"sports/{sport_key}/odds"
        return await self._get(path)

    async def get_matches(
        self,
        sports: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch odds for multiple sports and flatten into a single list.
        """
        sport_list = sports or DEFAULT_SPORT_KEYS
        results: List[Dict[str, Any]] = []
        for key in sport_list:
            try:
                events = await self.get_odds_for_sport(key)
                # annotate sport key for downstream mapping
                for event in events:
                    event["sport_key"] = key
                results.extend(events)
            except Exception as exc:  # pragma: no cover - logged for visibility
                logger.warning("Failed fetching odds for %s: %s", key, exc)
        return results

    async def get_match_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific match by event ID.
        Searches through all sports to find the match.
        """
        for sport_key in DEFAULT_SPORT_KEYS:
            try:
                events = await self.get_odds_for_sport(sport_key)
                for event in events:
                    if event.get("id") == event_id:
                        event["sport_key"] = sport_key
                        return event
            except Exception as exc:
                logger.warning("Failed searching for match %s in %s: %s", event_id, sport_key, exc)
        return None

    async def get_matches_by_sport(self, sport_key: str) -> List[Dict[str, Any]]:
        """
        Get matches for a specific sport/league.
        """
        try:
            events = await self.get_odds_for_sport(sport_key)
            for event in events:
                event["sport_key"] = sport_key
            return events
        except Exception as exc:
            logger.warning("Failed fetching matches for sport %s: %s", sport_key, exc)
            return []

    async def get_popular_matches(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get popular matches (matches with most bookmakers).
        """
        all_matches = await self.get_matches()
        # Sort by number of bookmakers (more bookmakers = more popular)
        sorted_matches = sorted(
            all_matches,
            key=lambda m: len(m.get("bookmakers", [])),
            reverse=True
        )
        return sorted_matches[:limit]

    async def get_available_leagues(self) -> List[Dict[str, Any]]:
        """
        Get available leagues from The Odds API sport keys.
        """
        league_map = {
            "soccer_turkey_super_league": {"id": 1, "name": "Süper Lig", "country": "Türkiye", "flag": "🇹🇷"},
            "soccer_epl": {"id": 2, "name": "Premier League", "country": "İngiltere", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
            "soccer_spain_la_liga": {"id": 3, "name": "La Liga", "country": "İspanya", "flag": "🇪🇸"},
            "soccer_italy_serie_a": {"id": 4, "name": "Serie A", "country": "İtalya", "flag": "🇮🇹"},
            "soccer_germany_bundesliga": {"id": 5, "name": "Bundesliga", "country": "Almanya", "flag": "🇩🇪"},
            "soccer_france_ligue_one": {"id": 6, "name": "Ligue 1", "country": "Fransa", "flag": "🇫🇷"},
        }
        
        # Get match counts for each league
        all_matches = await self.get_matches()
        league_counts = {}
        for match in all_matches:
            sport_key = match.get("sport_key")
            if sport_key:
                league_counts[sport_key] = league_counts.get(sport_key, 0) + 1
        
        leagues = []
        for sport_key, info in league_map.items():
            leagues.append({
                **info,
                "sport_key": sport_key,
                "match_count": league_counts.get(sport_key, 0),
            })
        
        return leagues

    async def get_available_countries(self) -> List[Dict[str, Any]]:
        """
        Get available countries from leagues.
        """
        leagues = await self.get_available_leagues()
        countries_map = {}
        
        for league in leagues:
            country = league.get("country", "Unknown")
            if country not in countries_map:
                countries_map[country] = {
                    "name": country,
                    "flag": league.get("flag", "🏆"),
                    "league_count": 0,
                }
            countries_map[country]["league_count"] += 1
        
        return list(countries_map.values())

    async def get_scores(
        self,
        sport_key: Optional[str] = None,
        days_from: int = 1,
        live: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Get live scores and results from The Odds API Scores endpoint.
        This endpoint is available in paid plans only.
        
        Args:
            sport_key: Optional sport key (e.g., 'soccer_epl'). If None, fetches all sports.
            days_from: Number of days to look back (default: 1)
            live: If True, only return live matches (default: True)
        
        Returns:
            List of match scores/results
        """
        if sport_key:
            path = f"sports/{sport_key}/scores"
        else:
            # Fetch scores for all default sports
            results = []
            for key in DEFAULT_SPORT_KEYS:
                try:
                    scores = await self.get_scores(sport_key=key, days_from=days_from, live=live)
                    results.extend(scores)
                except Exception as exc:
                    logger.warning("Failed fetching scores for %s: %s", key, exc)
            return results
        
        # Build query params for scores endpoint
        params = {
            "apiKey": self.api_key,
            "daysFrom": days_from,
        }
        if live:
            params["live"] = "true"
        
        url = f"{self.base_url}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "The Odds API Scores request failed: %s %s",
                    exc.response.status_code,
                    exc.response.text,
                )
                raise
            return response.json()

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """
        Get currently live matches with scores.
        Combines odds data with scores data for complete live match information.
        This requires a paid plan.
        """
        try:
            # Get live scores
            live_scores = await self.get_scores(live=True)
            
            # Get current odds for live matches
            all_odds = await self.get_matches()
            
            # Create a map of event IDs to odds data
            odds_map = {match.get("id"): match for match in all_odds}
            
            # Merge scores with odds
            live_matches = []
            for score_data in live_scores:
                event_id = score_data.get("id")
                odds_data = odds_map.get(event_id, {})
                
                # Merge score data with odds data
                merged_match = {
                    **odds_data,
                    **score_data,
                    "is_live": True,
                }
                live_matches.append(merged_match)
            
            return live_matches
        except Exception as exc:
            logger.error("Failed to get live matches: %s", exc)
            # If Scores API is not available (free plan), return empty list
            return []


# Global instance
the_odds_service = TheOddsApiService()

