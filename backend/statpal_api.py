"""
StatPal API Service Module
Fetches live soccer match data from StatPal API.
"""
import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

import httpx
import logging


logger = logging.getLogger(__name__)

STATPAL_API_BASE_URL = "https://statpal.io/api/v2"
STATPAL_ACCESS_KEY = os.environ.get("STATPAL_ACCESS_KEY", "75d51040-917d-4a51-a957-4fa2222cc9f3")

# League mapping for Turkish names and flags
LEAGUE_MAP = {
    "Premier League": {"id": 2, "name": "Premier League", "country": "İngiltere", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "sport_key": "soccer_epl"},
    "La Liga": {"id": 3, "name": "La Liga", "country": "İspanya", "flag": "🇪🇸", "sport_key": "soccer_spain_la_liga"},
    "Serie A": {"id": 4, "name": "Serie A", "country": "İtalya", "flag": "🇮🇹", "sport_key": "soccer_italy_serie_a"},
    "Bundesliga": {"id": 5, "name": "Bundesliga", "country": "Almanya", "flag": "🇩🇪", "sport_key": "soccer_germany_bundesliga"},
    "Ligue 1": {"id": 6, "name": "Ligue 1", "country": "Fransa", "flag": "🇫🇷", "sport_key": "soccer_france_ligue_one"},
    "Süper Lig": {"id": 1, "name": "Süper Lig", "country": "Türkiye", "flag": "🇹🇷", "sport_key": "soccer_turkey_super_league"},
    "Super Lig": {"id": 1, "name": "Süper Lig", "country": "Türkiye", "flag": "🇹🇷", "sport_key": "soccer_turkey_super_league"},
    "Turkish Super League": {"id": 1, "name": "Süper Lig", "country": "Türkiye", "flag": "🇹🇷", "sport_key": "soccer_turkey_super_league"},
}

# Country mapping
COUNTRY_MAP = {
    "İngiltere": {"name": "İngiltere", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "England": {"name": "İngiltere", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "İspanya": {"name": "İspanya", "flag": "🇪🇸"},
    "Spain": {"name": "İspanya", "flag": "🇪🇸"},
    "İtalya": {"name": "İtalya", "flag": "🇮🇹"},
    "Italy": {"name": "İtalya", "flag": "🇮🇹"},
    "Almanya": {"name": "Almanya", "flag": "🇩🇪"},
    "Germany": {"name": "Almanya", "flag": "🇩🇪"},
    "Fransa": {"name": "Fransa", "flag": "🇫🇷"},
    "France": {"name": "Fransa", "flag": "🇫🇷"},
    "Türkiye": {"name": "Türkiye", "flag": "🇹🇷"},
    "Turkey": {"name": "Türkiye", "flag": "🇹🇷"},
}


class StatPalApiService:
    """Service class for interacting with StatPal API."""

    def __init__(self) -> None:
        if not STATPAL_ACCESS_KEY:
            logger.warning("STATPAL_ACCESS_KEY is not set. Requests will fail.")
        self.access_key = STATPAL_ACCESS_KEY
        self.base_url = STATPAL_API_BASE_URL
        self.timeout = 30.0
        self._cache = {}
        self._cache_ttl = 30  # 30 seconds cache for live matches

    async def _get(
        self, 
        path: str, 
        params: Optional[Dict[str, Any]] = None,
        retries: int = 3,
        backoff_factor: float = 1.0
    ) -> Any:
        """
        Generic GET request handler with retry logic.
        
        Args:
            path: API endpoint path
            params: Additional query parameters
            retries: Number of retry attempts
            backoff_factor: Exponential backoff multiplier
            
        Returns:
            JSON response data
        """
        url = f"{self.base_url}/{path.lstrip('/')}"
        query_params = {"access_key": self.access_key}
        if params:
            query_params.update(params)
        
        last_exception = None
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url, params=query_params)
                    
                    # Handle rate limiting
                    if response.status_code == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        if attempt < retries - 1:
                            wait_time = retry_after * (backoff_factor ** attempt)
                            logger.warning(
                                "Rate limit exceeded. Waiting %s seconds before retry %s/%s",
                                wait_time, attempt + 1, retries
                            )
                            await asyncio.sleep(wait_time)
                            continue
                    
                    response.raise_for_status()
                    return response.json()
                    
            except httpx.HTTPStatusError as exc:
                last_exception = exc
                status_code = exc.response.status_code
                
                if status_code == 401:
                    logger.error("StatPal API: Invalid access key")
                    raise Exception("Invalid StatPal API access key") from exc
                elif status_code == 403:
                    logger.error("StatPal API: Access forbidden")
                    raise Exception("StatPal API access forbidden") from exc
                elif status_code == 404:
                    logger.error("StatPal API: Endpoint not found - %s", url)
                    raise Exception(f"StatPal API endpoint not found: {path}") from exc
                elif status_code == 429:
                    # Rate limit - handled above, but if all retries fail
                    if attempt == retries - 1:
                        logger.error("StatPal API: Rate limit exceeded after %s retries", retries)
                        raise Exception("StatPal API rate limit exceeded") from exc
                    continue
                elif status_code >= 500:
                    # Server error - retry
                    if attempt < retries - 1:
                        wait_time = backoff_factor ** attempt
                        logger.warning(
                            "StatPal API server error %s. Retrying in %s seconds...",
                            status_code, wait_time
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        logger.error(
                            "StatPal API request failed: %s %s",
                            status_code,
                            exc.response.text,
                        )
                        raise Exception(f"StatPal API server error: {status_code}") from exc
                else:
                    logger.error(
                        "StatPal API request failed: %s %s",
                        status_code,
                        exc.response.text,
                    )
                    raise Exception(f"StatPal API request failed: {status_code}") from exc
                    
            except httpx.TimeoutException as exc:
                last_exception = exc
                if attempt < retries - 1:
                    wait_time = backoff_factor ** attempt
                    logger.warning(
                        "StatPal API request timeout. Retrying in %s seconds...",
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error("StatPal API request timeout after %s retries", retries)
                    raise Exception("StatPal API request timeout") from exc
                    
            except httpx.RequestError as exc:
                last_exception = exc
                if attempt < retries - 1:
                    wait_time = backoff_factor ** attempt
                    logger.warning(
                        "StatPal API connection error. Retrying in %s seconds...",
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error("StatPal API connection error: %s", exc)
                    raise Exception(f"StatPal API connection error: {str(exc)}") from exc
        
        # If we get here, all retries failed
        if last_exception:
            raise last_exception
        raise Exception("StatPal API request failed after retries")

    def _is_upcoming_match(self, match: Dict[str, Any]) -> bool:
        """
        Check if a match is upcoming (not yet started or finished).
        
        Args:
            match: Match data dictionary
            
        Returns:
            True if match is upcoming, False otherwise
        """
        # Check if match is live (live matches are not "upcoming" in the prematch sense)
        if match.get("is_live") is True:
            return False
        
        # Check status - finished matches are not upcoming
        # Note: "Postp." (Postponed) matches might be rescheduled, so we check by date
        status = match.get("status", "").upper()
        if status in ["FT", "FINISHED", "CANCELED", "CANCELLED"]:
            return False
        # Don't exclude "POSTPONED" or "Postp." - they might be rescheduled for future
        
        # Check commence_time
        commence_time = match.get("commence_time")
        if not commence_time:
            # If no commence_time, check date field
            date_str = match.get("date", "")
            if date_str:
                try:
                    # Try YYYY-MM-DD format first
                    try:
                        match_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    except ValueError:
                        # Try StatPal format: DD.MM.YYYY
                        try:
                            match_date = datetime.strptime(date_str, "%d.%m.%Y").date()
                        except ValueError:
                            return False
                    today = datetime.now(timezone.utc).date()
                    return match_date >= today
                except (ValueError, TypeError):
                    pass
            return False
        
        try:
            # Parse commence_time (ISO 8601 format)
            if isinstance(commence_time, str):
                match_time = datetime.fromisoformat(commence_time.replace('Z', '+00:00'))
            elif isinstance(commence_time, datetime):
                match_time = commence_time
            else:
                return False
            
            # Ensure match_time is timezone-aware
            if match_time.tzinfo is None:
                match_time = match_time.replace(tzinfo=timezone.utc)
            
            # Compare with current time
            current_time = datetime.now(timezone.utc)
            return match_time >= current_time
        except (ValueError, TypeError, AttributeError):
            # If parsing fails, assume it's not upcoming
            return False

    def _transform_match_data(self, statpal_match: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StatPal API response format to The Odds API-like format.
        
        Args:
            statpal_match: Match data from StatPal API
            
        Returns:
            Transformed match data in The Odds API-like format
        """
        # Extract match ID (StatPal uses main_id, fallback_id_1, etc.)
        # Also preserve all IDs for odds matching
        main_id = statpal_match.get("main_id")
        fallback_id_1 = statpal_match.get("fallback_id_1")
        fallback_id_2 = statpal_match.get("fallback_id_2")
        fallback_id_3 = statpal_match.get("fallback_id_3")
        
        match_id = str(
            main_id or 
            fallback_id_1 or 
            statpal_match.get("match_id") or 
            statpal_match.get("id", "")
        )
        
        # Extract team names (StatPal uses "home" and "away" objects with "name" field)
        home_obj = statpal_match.get("home", {})
        away_obj = statpal_match.get("away", {})
        
        # Extract team names and logos
        home_team_logo = None
        away_team_logo = None
        
        if isinstance(home_obj, dict):
            home_team = home_obj.get("name", "")
            # Try to extract logo from various possible fields
            home_team_logo = (
                home_obj.get("logo") or 
                home_obj.get("image") or 
                home_obj.get("logo_url") or 
                home_obj.get("image_url") or
                None
            )
        else:
            home_team = statpal_match.get("home_team") or statpal_match.get("homeTeam", "")
        
        if isinstance(away_obj, dict):
            away_team = away_obj.get("name", "")
            # Try to extract logo from various possible fields
            away_team_logo = (
                away_obj.get("logo") or 
                away_obj.get("image") or 
                away_obj.get("logo_url") or 
                away_obj.get("image_url") or
                None
            )
        else:
            away_team = statpal_match.get("away_team") or statpal_match.get("awayTeam", "")
        
        # Extract league information
        league_name = statpal_match.get("league") or statpal_match.get("league_name", "")
        country = statpal_match.get("country") or statpal_match.get("country_name", "")
        
        # Extract league_id (StatPal uses "league_id" or nested league object with "id")
        league_id = None
        if "league_id" in statpal_match:
            league_id = str(statpal_match.get("league_id", ""))
        elif "league" in statpal_match and isinstance(statpal_match.get("league"), dict):
            league_obj = statpal_match.get("league")
            if "id" in league_obj:
                league_id = str(league_obj.get("id", ""))
        # Also check parent context (if match is nested in league data)
        if not league_id:
            # Try to get from parent league context if available
            parent_league = statpal_match.get("_league_context", {})
            if isinstance(parent_league, dict) and "id" in parent_league:
                league_id = str(parent_league.get("id", ""))
        
        # Get sport_key from league mapping
        sport_key = "soccer_unknown"
        if league_name in LEAGUE_MAP:
            sport_key = LEAGUE_MAP[league_name]["sport_key"]
        else:
            # Try to infer from league name
            league_lower = league_name.lower()
            if "premier" in league_lower or "epl" in league_lower:
                sport_key = "soccer_epl"
            elif "la liga" in league_lower or "spain" in league_lower:
                sport_key = "soccer_spain_la_liga"
            elif "serie a" in league_lower or "italy" in league_lower:
                sport_key = "soccer_italy_serie_a"
            elif "bundesliga" in league_lower or "germany" in league_lower:
                sport_key = "soccer_germany_bundesliga"
            elif "ligue" in league_lower or "france" in league_lower:
                sport_key = "soccer_france_ligue_one"
            elif "super lig" in league_lower or "turkey" in league_lower or "türkiye" in league_lower:
                sport_key = "soccer_turkey_super_league"
        
        # Extract scores (StatPal uses "home" and "away" objects with "goals" field)
        home_score = 0
        away_score = 0
        
        if isinstance(home_obj, dict):
            goals_str = home_obj.get("goals", "")
            try:
                home_score = int(goals_str) if goals_str else 0
            except (ValueError, TypeError):
                home_score = 0
        
        if isinstance(away_obj, dict):
            goals_str = away_obj.get("goals", "")
            try:
                away_score = int(goals_str) if goals_str else 0
            except (ValueError, TypeError):
                away_score = 0
        
        # Fallback to other score formats
        if home_score == 0 and away_score == 0:
            score_data = statpal_match.get("score") or statpal_match.get("scores", {})
            
            if isinstance(score_data, dict):
                home_score = score_data.get("home") or score_data.get("home_score", 0)
                away_score = score_data.get("away") or score_data.get("away_score", 0)
            elif isinstance(score_data, list):
                # Handle list format: [{"name": "Team A", "score": 1}, ...]
                for score_item in score_data:
                    if isinstance(score_item, dict):
                        team_name = score_item.get("name", "").lower()
                        score = score_item.get("score", 0)
                        if home_team.lower() in team_name or team_name in home_team.lower():
                            home_score = score
                        elif away_team.lower() in team_name or team_name in away_team.lower():
                            away_score = score
        
        # Extract status and live information
        # StatPal status values: "FT" (Finished), "NS" (Not Started), "LIVE", "HT" (Half Time), "1H" (First Half), "2H" (Second Half), etc.
        status = statpal_match.get("status") or statpal_match.get("match_status", "")
        status_upper = status.upper()
        
        # Determine if match is live
        # Live statuses: LIVE, HT, 1H, 2H, INPLAY, IN_PLAY, etc.
        # Finished statuses: FT, FINISHED, CANCELED, CANCELLED, POSTPONED, POSTP., etc.
        # Not started: NS, NOT_STARTED, SCHEDULED, etc.
        
        # First check if status indicates finished/postponed/canceled
        finished_statuses = ["FT", "FINISHED", "CANCELED", "CANCELLED", "POSTPONED", "POSTP.", "POSTP", "CANCEL", "SUSPENDED", "ABANDONED"]
        is_finished = status_upper in finished_statuses or status_upper.startswith("POSTP") or status_upper.startswith("CANCEL")
        
        is_live = (
            not is_finished and (
                status_upper == "LIVE" or 
                status_upper == "HT" or  # Half time is still live
                status_upper == "1H" or  # First half
                status_upper == "2H" or  # Second half
                status_upper == "INPLAY" or
                status_upper == "IN_PLAY" or
                status_upper == "IN PLAY" or
                statpal_match.get("is_live") is True or
                statpal_match.get("isLive") is True
            )
        )
        
        # If we're in get_live_matches(), assume matches are live unless explicitly finished
        # This handles cases where StatPal returns matches from /live endpoint but status might not be set correctly
        if not is_live and status_upper not in ["FT", "FINISHED", "CANCELED", "CANCELLED", "POSTPONED", "NS", "NOT_STARTED", "SCHEDULED"]:
            # If status is ambiguous and we have scores, it might be live
            if home_score is not None or away_score is not None:
                # Check if match has recent activity (has events or scores)
                has_events = statpal_match.get("events") is not None
                if has_events or (home_score is not None and away_score is not None):
                    # If status is empty or unknown but has scores/events, might be live
                    # But be conservative - only mark as live if we're sure
                    pass
        
        # Extract minute (StatPal uses "inj_minute" for injury time, regular minute might be in status or separate field)
        minute = None
        inj_minute = statpal_match.get("inj_minute", "")
        if inj_minute:
            try:
                minute = int(inj_minute)
            except (ValueError, TypeError):
                pass
        
        # Try other minute fields
        if minute is None:
            minute_str = statpal_match.get("minute") or statpal_match.get("elapsed", "")
            if minute_str:
                try:
                    minute = int(minute_str)
                except (ValueError, TypeError):
                    minute = None
        
        # If status is HT, set minute to 45
        if minute is None and status_upper == "HT":
            minute = 45
        
        # Extract date and time (StatPal uses "DD.MM.YYYY" format for date and "HH:MM" for time)
        commence_time = None
        date_str = statpal_match.get("date") or statpal_match.get("match_date", "")
        time_str = statpal_match.get("time") or statpal_match.get("match_time", "")
        
        # Try to parse datetime
        # StatPal API provides dates/times in local timezone (likely Turkey time, UTC+3)
        # We need to parse as local time first, then convert to UTC for storage
        if date_str:
            try:
                if time_str:
                    # Combine date and time
                    datetime_str = f"{date_str} {time_str}"
                    # Try StatPal format first: "DD.MM.YYYY HH:MM"
                    try:
                        # Parse as naive datetime (local time, likely Turkey time UTC+3)
                        commence_time = datetime.strptime(datetime_str, "%d.%m.%Y %H:%M")
                        # Assume StatPal times are in Turkey timezone (UTC+3)
                        # Convert to UTC by subtracting 3 hours
                        turkey_tz = timezone(timedelta(hours=3))
                        commence_time = commence_time.replace(tzinfo=turkey_tz)
                        commence_time = commence_time.astimezone(timezone.utc)
                    except ValueError:
                        # Try other formats
                        for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%d/%m/%Y %H:%M"]:
                            try:
                                commence_time = datetime.strptime(datetime_str, fmt)
                                # If format doesn't include timezone, assume Turkey time (UTC+3)
                                if commence_time.tzinfo is None:
                                    turkey_tz = timezone(timedelta(hours=3))
                                    commence_time = commence_time.replace(tzinfo=turkey_tz)
                                    commence_time = commence_time.astimezone(timezone.utc)
                                break
                            except ValueError:
                                continue
                else:
                    # Just date - try StatPal format first
                    try:
                        commence_time = datetime.strptime(date_str, "%d.%m.%Y")
                        # Set to midnight in Turkey time, then convert to UTC
                        turkey_tz = timezone(timedelta(hours=3))
                        commence_time = commence_time.replace(tzinfo=turkey_tz)
                        commence_time = commence_time.astimezone(timezone.utc)
                    except ValueError:
                        try:
                            commence_time = datetime.strptime(date_str, "%Y-%m-%d")
                            # Set to midnight in Turkey time, then convert to UTC
                            turkey_tz = timezone(timedelta(hours=3))
                            commence_time = commence_time.replace(tzinfo=turkey_tz)
                            commence_time = commence_time.astimezone(timezone.utc)
                        except ValueError:
                            pass
            except (ValueError, TypeError) as e:
                logger.debug("Failed to parse date/time: %s - %s", datetime_str if 'datetime_str' in locals() else date_str, e)
                pass
        
        # If no commence_time, use current time for live matches
        if not commence_time and is_live:
            commence_time = datetime.now(timezone.utc)
        elif not commence_time:
            commence_time = datetime.now(timezone.utc)
        
        # Format as ISO 8601
        if commence_time:
            if commence_time.tzinfo is None:
                commence_time = commence_time.replace(tzinfo=timezone.utc)
            commence_time_str = commence_time.isoformat()
        else:
            commence_time_str = datetime.now(timezone.utc).isoformat()
        
        # Build scores array in The Odds API format
        scores = []
        if home_score is not None or away_score is not None:
            if home_team:
                scores.append({"name": home_team, "score": home_score or 0})
            if away_team:
                scores.append({"name": away_team, "score": away_score or 0})
        
        # Extract date in YYYY-MM-DD format for frontend
        date_formatted = None
        if commence_time:
            date_formatted = commence_time.strftime("%Y-%m-%d")
        elif date_str:
            # Try to parse date_str and convert to YYYY-MM-DD
            try:
                # Try StatPal format first: "DD.MM.YYYY"
                try:
                    parsed_date = datetime.strptime(date_str, "%d.%m.%Y")
                    date_formatted = parsed_date.strftime("%Y-%m-%d")
                except ValueError:
                    # Try ISO format: "YYYY-MM-DD"
                    try:
                        parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
                        date_formatted = parsed_date.strftime("%Y-%m-%d")
                    except ValueError:
                        pass
            except (ValueError, TypeError):
                pass
        
        # Build transformed match data
        transformed = {
            "id": match_id,
            "sport_key": sport_key,
            "home_team": home_team,
            "away_team": away_team,
            "commence_time": commence_time_str,
            "date": date_formatted,  # Add date field for frontend filtering
            "scores": scores,
            "is_live": is_live,
            "bookmakers": [],  # Will be populated if odds are available
        }
        
        # Add team logos if available
        if home_team_logo:
            transformed["home_team_logo"] = home_team_logo
        if away_team_logo:
            transformed["away_team_logo"] = away_team_logo
        
        # Preserve all match IDs for odds matching
        if main_id:
            transformed["main_id"] = str(main_id)
        if fallback_id_1:
            transformed["fallback_id_1"] = str(fallback_id_1)
        if fallback_id_2:
            transformed["fallback_id_2"] = str(fallback_id_2)
        if fallback_id_3:
            transformed["fallback_id_3"] = str(fallback_id_3)
        
        # Add league information if available
        if league_name:
            transformed["league"] = league_name
        if country:
            transformed["country"] = country
        if league_id:
            transformed["league_id"] = league_id
        
        # Add minute if available
        if minute is not None:
            transformed["minute"] = minute
        
        # Add status
        if status:
            transformed["status"] = status
        
        return transformed

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """
        Get live soccer matches from StatPal API.
        
        Returns:
            List of live matches in The Odds API-like format
        """
        try:
            # Check cache first
            cache_key = "live_matches"
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                if (datetime.now() - cached_time).total_seconds() < self._cache_ttl:
                    logger.debug("Returning cached live matches")
                    return cached_data
            
            # Fetch from API
            response = await self._get("soccer/matches/live")
            
            # StatPal API response format:
            # {
            #   "live_matches": {
            #     "league": [
            #       {
            #         "id": "...",
            #         "name": "...",
            #         "country": "...",
            #         "match": [...]
            #       }
            #     ]
            #   }
            # }
            
            matches_data = []
            if isinstance(response, dict):
                # Check for live_matches wrapper
                if "live_matches" in response:
                    live_matches = response["live_matches"]
                    if "league" in live_matches:
                        # Extract matches from all leagues
                        for league_data in live_matches["league"]:
                            league_name = league_data.get("name", "")
                            country = league_data.get("country", "")
                            league_id = str(league_data.get("id", "")) if league_data.get("id") else None
                            matches = league_data.get("match", [])
                            
                            # Flatten matches and add league/country info
                            for match in matches:
                                if isinstance(match, dict):
                                    # Add league and country info to match
                                    match["league"] = league_name
                                    match["country"] = country
                                    if league_id:
                                        match["league_id"] = league_id
                                    matches_data.append(match)
                # Check for other common response wrapper formats
                elif "data" in response:
                    matches_data = response["data"] if isinstance(response["data"], list) else []
                elif "matches" in response:
                    matches_data = response["matches"] if isinstance(response["matches"], list) else []
                elif "results" in response:
                    matches_data = response["results"] if isinstance(response["results"], list) else []
            elif isinstance(response, list):
                matches_data = response
            else:
                logger.warning("Unexpected StatPal API response format: %s", type(response))
                matches_data = []
            
            # Get live odds if available
            live_odds_map = {}
            if matches_data:
                try:
                    live_odds_map = await self.get_live_odds()
                except Exception as exc:
                    logger.debug("Failed to get live odds: %s", exc)
                    live_odds_map = {}
            
            # Transform matches
            transformed_matches = []
            for match in matches_data:
                try:
                    status = match.get("status", "").upper()
                    
                    # For /live endpoint, trust the endpoint - if it returns a match, consider it live
                    # Only skip explicitly postponed/canceled/suspended matches
                    # StatPal /live endpoint returns matches that are currently live OR recently finished
                    # We want to show all of them as "live" since they're from the live endpoint
                    postponed_statuses = ["POSTPONED", "POSTP.", "POSTP", "CANCEL", "CANCELED", "CANCELLED", "SUSPENDED", "ABANDONED"]
                    is_postponed = status in postponed_statuses or status.startswith("POSTP") or status.startswith("CANCEL")
                    
                    if is_postponed:
                        logger.debug(f"Skipping postponed/canceled match: {match.get('main_id')} - Status: {status}")
                        continue
                    
                    transformed = self._transform_match_data(match)
                    
                    # Force is_live to True for ALL matches from /live endpoint (except postponed/canceled)
                    # The endpoint itself indicates these are live or recently live matches
                    # This is the correct behavior - if StatPal returns it from /live, we show it as live
                    transformed["is_live"] = True
                    
                    # Also set minute if available (for display purposes)
                    if not transformed.get("minute") and status == "FT":
                        # For finished matches, we can set minute to 90+ for display
                        transformed["minute"] = 90
                    
                    logger.debug(f"Marking match from /live endpoint as live: {transformed.get('id')} - Status: {status}")
                    
                    # Fetch logos if not already present
                    if not transformed.get("home_team_logo") and transformed.get("home_team"):
                        try:
                            home_logo = await self.get_team_logo(transformed.get("home_team"))
                            if home_logo:
                                transformed["home_team_logo"] = home_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch home team logo: {e}")
                    
                    if not transformed.get("away_team_logo") and transformed.get("away_team"):
                        try:
                            away_logo = await self.get_team_logo(transformed.get("away_team"))
                            if away_logo:
                                transformed["away_team_logo"] = away_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch away team logo: {e}")
                    
                    # Add odds if available
                    match_id_str = transformed.get("id", "")
                    if match_id_str and match_id_str in live_odds_map:
                        transformed["bookmakers"] = live_odds_map[match_id_str]
                    
                    transformed_matches.append(transformed)
                except Exception as exc:
                    logger.warning("Failed to transform match data: %s - %s", match, exc)
                    continue
            
            # Cache the results
            self._cache[cache_key] = (transformed_matches, datetime.now())
            
            return transformed_matches
            
        except Exception as exc:
            logger.error("Failed to get live matches from StatPal API: %s", exc)
            # Return empty list on error
            return []

    async def get_matches(
        self,
        sports: Optional[List[str]] = None,
        date: Optional[str] = None,
        league: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all matches from StatPal API (live + daily + fixtures).
        
        Args:
            sports: Not used (kept for compatibility)
            date: Date in YYYY-MM-DD format. If None, gets today's matches.
            league: Optional league name or ID filter
            
        Returns:
            List of matches in The Odds API-like format
        """
        try:
            all_matches = []
            existing_ids = set()
            
            # 1. Get live matches
            try:
                live_matches = await self.get_live_matches()
                for match in live_matches:
                    match_id = match.get("id")
                    if match_id:
                        existing_ids.add(match_id)
                all_matches.extend(live_matches)
            except Exception as e:
                logger.warning(f"Failed to get live matches: {e}")
            
            # 2. Get daily matches for today, tomorrow, and past 2 weeks (to get both upcoming and past matches)
            try:
                # Get today's matches
                today_matches = await self.get_daily_matches(date=None)
                # Also get tomorrow's matches for more upcoming matches
                tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
                tomorrow_matches = await self.get_daily_matches(date=tomorrow)
                # Get past matches from last 14 days
                past_daily_matches = []
                for days_ago in range(1, 15):  # Last 14 days (excluding today)
                    past_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                    try:
                        past_matches = await self.get_daily_matches(date=past_date)
                        past_daily_matches.extend(past_matches)
                        # Small delay to avoid rate limiting
                        await asyncio.sleep(0.05)
                    except Exception as e:
                        logger.debug(f"Failed to get daily matches for {past_date}: {e}")
                        continue
                # Combine today, tomorrow, and past matches
                daily_matches = today_matches + tomorrow_matches + past_daily_matches
                
                # Remove duplicates (matches that are already in live_matches)
                unique_daily = []
                for match in daily_matches:
                    match_id = match.get("id")
                    if match_id and match_id not in existing_ids:
                        existing_ids.add(match_id)
                        unique_daily.append(match)
                all_matches.extend(unique_daily)
            except Exception as e:
                logger.warning(f"Failed to get daily matches: {e}")
            
            # 3. Always try to get matches from popular leagues (both upcoming and finished from last 2 weeks)
            # This ensures we have upcoming matches for prematch odds and past matches for history
            try:
                # Get popular league IDs and fetch their matches
                popular_league_ids = ["3037", "3258", "3232", "3102", "3054", "3062"]  # Premier League, Super Lig, La Liga, Serie A, Ligue 1, Bundesliga
                for league_id in popular_league_ids:  # Get from all 6 popular leagues
                    try:
                        league_matches = await self.get_league_matches(league_id)
                        # Get both upcoming and finished matches (for past matches display)
                        for match in league_matches:
                            match_id = match.get("id")
                            # Check if match is within last 2 weeks (for finished matches)
                            match_date = match.get("commence_time") or match.get("date")
                            if match_date:
                                try:
                                    if isinstance(match_date, str):
                                        match_datetime = datetime.fromisoformat(match_date.replace('Z', '+00:00'))
                                    else:
                                        match_datetime = match_date
                                    if match_datetime.tzinfo is None:
                                        match_datetime = match_datetime.replace(tzinfo=timezone.utc)
                                    
                                    two_weeks_ago = datetime.now(timezone.utc) - timedelta(days=14)
                                    # Include if upcoming OR if finished within last 2 weeks
                                    status = match.get("status", "").upper()
                                    is_finished = status in ["FT", "FINISHED", "CANCELED", "CANCELLED"]
                                    is_within_2_weeks = match_datetime >= two_weeks_ago
                                    
                                    if (not is_finished) or (is_finished and is_within_2_weeks):
                                        if match_id and match_id not in existing_ids:
                                            existing_ids.add(match_id)
                                            all_matches.append(match)
                                except (ValueError, TypeError, AttributeError):
                                    # If date parsing fails, include if not finished (safer)
                                    status = match.get("status", "").upper()
                                    if status not in ["FT", "FINISHED", "CANCELED", "CANCELLED"]:
                                        if match_id and match_id not in existing_ids:
                                            existing_ids.add(match_id)
                                            all_matches.append(match)
                            else:
                                # No date, include if not finished
                                status = match.get("status", "").upper()
                                if status not in ["FT", "FINISHED", "CANCELED", "CANCELLED"]:
                                    if match_id and match_id not in existing_ids:
                                        existing_ids.add(match_id)
                                        all_matches.append(match)
                    except Exception as e:
                        logger.debug(f"Failed to get matches for league {league_id}: {e}")
                        continue
            except Exception as e:
                logger.debug(f"Failed to get popular league matches: {e}")
            
            # 4. If league ID provided, get league matches
            if league:
                try:
                    # Try to parse as league ID (numeric)
                    if league.isdigit():
                        league_matches = await self.get_league_matches(league)
                        # Remove duplicates
                        unique_league = []
                        for match in league_matches:
                            match_id = match.get("id")
                            if match_id and match_id not in existing_ids:
                                existing_ids.add(match_id)
                                unique_league.append(match)
                        all_matches.extend(unique_league)
                except Exception as e:
                    logger.warning(f"Failed to get league matches: {e}")
            
            # 5. Separate upcoming vs past matches
            upcoming_matches = []
            past_matches = []
            
            for match in all_matches:
                if self._is_upcoming_match(match):
                    upcoming_matches.append(match)
                else:
                    past_matches.append(match)
            
            # 6. Get live odds for all matches (always try, not just if live matches exist)
            # This ensures we get odds for any live matches in the list
            live_odds_map = {}
            try:
                # Always try to get live odds (it's fast and cached)
                live_odds_map = await self.get_live_odds()
            except Exception as e:
                logger.debug(f"Failed to get live odds in get_matches: {e}")
                live_odds_map = {}
            
            # 7. Extract unique league IDs from upcoming matches
            unique_league_ids = set()
            for match in upcoming_matches:
                league_id = match.get("league_id")
                if league_id:
                    unique_league_ids.add(str(league_id))
            
            # 8. Get prematch odds for all unique leagues (for upcoming matches only)
            prematch_odds_map = {}
            if unique_league_ids:
                try:
                    # Limit concurrent requests to avoid rate limiting (max 10 at a time)
                    league_ids_list = list(unique_league_ids)[:10]  # Limit to 10 leagues
                    for league_id in league_ids_list:
                        try:
                            league_prematch_odds = await self.get_prematch_odds(league_id)
                            prematch_odds_map.update(league_prematch_odds)
                            # Small delay to avoid rate limiting
                            await asyncio.sleep(0.1)
                        except Exception as e:
                            logger.debug(f"Failed to get prematch odds for league {league_id}: {e}")
                            continue
                except Exception as e:
                    logger.debug(f"Failed to get prematch odds in get_matches: {e}")
            
            # 9. Add odds to matches that have them (prioritize live odds over prematch)
            # For upcoming matches, try both live and prematch odds
            for match in upcoming_matches:
                # Try all possible match IDs for matching
                match_ids_to_try = [
                    match.get("id"),
                    match.get("main_id"),
                    match.get("fallback_id_1"),
                    match.get("fallback_id_2"),
                    match.get("fallback_id_3"),
                ]
                # Filter out None/empty values
                match_ids_to_try = [str(mid) for mid in match_ids_to_try if mid]
                
                odds_found = False
                # First try live odds (for live matches)
                for match_id_str in match_ids_to_try:
                    if match_id_str in live_odds_map:
                        match["bookmakers"] = live_odds_map[match_id_str]
                        odds_found = True
                        break
                
                # Then try prematch odds (for upcoming non-live matches)
                if not odds_found:
                    for match_id_str in match_ids_to_try:
                        if match_id_str in prematch_odds_map:
                            match["bookmakers"] = prematch_odds_map[match_id_str]
                            odds_found = True
                            logger.debug(f"Matched prematch odds for match {match_id_str} ({match.get('home_team')} vs {match.get('away_team')})")
                            break
                    if not odds_found:
                        logger.debug(f"No odds found for match {match.get('id')} ({match.get('home_team')} vs {match.get('away_team')}). Tried IDs: {match_ids_to_try}")
            
            # Past matches don't get prematch odds, but can have live odds if they were live
            for match in past_matches:
                match_ids_to_try = [
                    match.get("id"),
                    match.get("main_id"),
                    match.get("fallback_id_1"),
                    match.get("fallback_id_2"),
                    match.get("fallback_id_3"),
                ]
                match_ids_to_try = [str(mid) for mid in match_ids_to_try if mid]
                
                for match_id_str in match_ids_to_try:
                    if match_id_str in live_odds_map:
                        match["bookmakers"] = live_odds_map[match_id_str]
                        break
            
            # Combine upcoming and past matches (upcoming first)
            all_matches = upcoming_matches + past_matches
            
            # 7. Filter by league name if provided (and not league ID)
            if league and not league.isdigit():
                filtered_matches = []
                for match in all_matches:
                    match_league = match.get("league", "")
                    match_sport_key = match.get("sport_key", "")
                    
                    # Check if league matches
                    if (league.lower() in match_league.lower() or 
                        match_league.lower() in league.lower() or
                        league.lower() in match_sport_key.lower()):
                        filtered_matches.append(match)
                
                return filtered_matches
            
            return all_matches
            
        except Exception as exc:
            logger.error("Failed to get matches from StatPal API: %s", exc)
            return []

    async def get_match_by_id(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific match by ID.
        Searches in live matches, daily matches (today, tomorrow, and past 2 weeks), and popular league matches.
        
        Args:
            match_id: Match ID to search for (can be main_id, fallback_id_1, etc.)
            
        Returns:
            Match data if found, None otherwise
        """
        try:
            # Helper function to check if match ID matches
            def match_id_matches(match, search_id):
                return (str(match.get("id", "")) == str(search_id) or
                        str(match.get("main_id", "")) == str(search_id) or
                        str(match.get("fallback_id_1", "")) == str(search_id) or
                        str(match.get("fallback_id_2", "")) == str(search_id) or
                        str(match.get("fallback_id_3", "")) == str(search_id))
            
            # 1. Search in live matches
            try:
                live_matches = await self.get_live_matches()
                for match in live_matches:
                    if match_id_matches(match, match_id):
                        return match
            except Exception as e:
                logger.debug(f"Failed to search in live matches: {e}")
            
            # 2. Search in daily matches (today and tomorrow)
            try:
                today_matches = await self.get_daily_matches(date=None)
                tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
                tomorrow_matches = await self.get_daily_matches(date=tomorrow)
                all_daily = today_matches + tomorrow_matches
                
                for match in all_daily:
                    if match_id_matches(match, match_id):
                        return match
            except Exception as e:
                logger.debug(f"Failed to search in daily matches: {e}")
            
            # 3. Search in past matches (last 2 weeks) - for finished matches
            try:
                now = datetime.now(timezone.utc)
                for days_ago in range(1, 15):  # Search last 14 days
                    past_date = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                    try:
                        past_matches = await self.get_daily_matches(date=past_date)
                        for match in past_matches:
                            if match_id_matches(match, match_id):
                                # Check if match is finished
                                status = (match.get("status", "") or "").upper()
                                finished_statuses = ["FT", "FINISHED", "CANCELED", "CANCELLED"]
                                if status in finished_statuses:
                                    logger.debug(f"Found finished match {match_id} from {past_date}")
                                    return match
                    except Exception as e:
                        logger.debug(f"Failed to search in past matches for date {past_date}: {e}")
                        continue
            except Exception as e:
                logger.debug(f"Failed to search in past matches: {e}")
            
            # 4. Search in popular league matches
            try:
                popular_league_ids = ["3037", "3258", "3232", "3231", "3054", "3062"]
                for league_id in popular_league_ids:
                    try:
                        league_matches = await self.get_league_matches(league_id)
                        for match in league_matches:
                            if match_id_matches(match, match_id):
                                return match
                    except Exception as e:
                        logger.debug(f"Failed to search in league {league_id}: {e}")
                        continue
            except Exception as e:
                logger.debug(f"Failed to search in popular leagues: {e}")
            
            return None
            
        except Exception as exc:
            logger.error("Failed to get match by ID from StatPal API: %s - %s", match_id, exc)
            return None

    async def get_popular_matches(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get popular matches (currently returns live matches, prioritized).
        
        Args:
            limit: Maximum number of matches to return
            
        Returns:
            List of popular matches
        """
        try:
            # Get live matches (they are considered popular)
            matches = await self.get_live_matches()
            
            # Sort by is_live first, then by league importance
            def sort_key(match):
                is_live = match.get("is_live", False)
                league = match.get("league", "").lower()
                
                # Priority: live matches first, then major leagues
                priority = 0
                if is_live:
                    priority += 1000
                
                # Major leagues get higher priority
                if "premier" in league or "epl" in league:
                    priority += 100
                elif "la liga" in league:
                    priority += 90
                elif "serie a" in league:
                    priority += 80
                elif "bundesliga" in league:
                    priority += 70
                elif "super lig" in league or "turkey" in league:
                    priority += 60
                
                return priority
            
            sorted_matches = sorted(matches, key=sort_key, reverse=True)
            return sorted_matches[:limit]
            
        except Exception as exc:
            logger.error("Failed to get popular matches from StatPal API: %s", exc)
            return []

    async def get_available_leagues(self) -> List[Dict[str, Any]]:
        """
        Get available leagues from StatPal API response.
        Extracts leagues from both match data and league array in API response.
        
        Returns:
            List of leagues with metadata
        """
        try:
            # First, try to get leagues from API response directly
            response = await self._get("soccer/matches/live")
            
            leagues_map = {}
            
            # Extract leagues from API response league array
            if isinstance(response, dict) and "live_matches" in response:
                live_matches = response["live_matches"]
                if "league" in live_matches:
                    for league_data in live_matches["league"]:
                        league_name = league_data.get("name", "")
                        country = league_data.get("country", "")
                        league_id = league_data.get("id", "")
                        matches = league_data.get("match", [])
                        match_count = len(matches) if isinstance(matches, list) else 0
                        
                        if not league_name:
                            continue
                        
                        # Try to get league info from mapping
                        league_info = LEAGUE_MAP.get(league_name, {})
                        
                        # Determine sport_key from league name
                        sport_key = league_info.get("sport_key", "soccer_unknown")
                        league_lower = league_name.lower()
                        if sport_key == "soccer_unknown":
                            if "premier" in league_lower or "epl" in league_lower:
                                sport_key = "soccer_epl"
                            elif "la liga" in league_lower or "spain" in league_lower:
                                sport_key = "soccer_spain_la_liga"
                            elif "serie a" in league_lower or "italy" in league_lower:
                                sport_key = "soccer_italy_serie_a"
                            elif "bundesliga" in league_lower or "germany" in league_lower:
                                sport_key = "soccer_germany_bundesliga"
                            elif "ligue" in league_lower or "france" in league_lower:
                                sport_key = "soccer_france_ligue_one"
                            elif "super lig" in league_lower or "turkey" in league_lower or "türkiye" in league_lower:
                                sport_key = "soccer_turkey_super_league"
                        
                        # Get country name and flag
                        country_name = league_info.get("country", country.capitalize() if country else "Unknown")
                        country_flag = league_info.get("flag", "🏆")
                        
                        # Map country name if needed
                        if country:
                            country_lower = country.lower()
                            if country_lower in COUNTRY_MAP:
                                country_info = COUNTRY_MAP[country_lower]
                                country_name = country_info.get("name", country_name)
                                country_flag = country_info.get("flag", country_flag)
                        
                        leagues_map[league_name] = {
                            "id": league_info.get("id", int(league_id) if league_id.isdigit() else 0),
                            "name": league_info.get("name", league_name),
                            "country": country_name,
                            "flag": country_flag,
                            "sport_key": sport_key,
                            "match_count": match_count,
                        }
            
            # Also extract from match data (if any matches exist)
            matches = await self.get_live_matches()
            for match in matches:
                league_name = match.get("league", "")
                sport_key = match.get("sport_key", "")
                
                if not league_name:
                    continue
                
                if league_name not in leagues_map:
                    league_info = LEAGUE_MAP.get(league_name, {})
                    leagues_map[league_name] = {
                        "id": league_info.get("id", 0),
                        "name": league_info.get("name", league_name),
                        "country": league_info.get("country", match.get("country", "Unknown")),
                        "flag": league_info.get("flag", "🏆"),
                        "sport_key": sport_key,
                        "match_count": 0,
                    }
                
                leagues_map[league_name]["match_count"] += 1
            
            # Convert to list and sort by match count, then by name
            leagues = list(leagues_map.values())
            leagues.sort(key=lambda x: (x["match_count"], x["name"]), reverse=True)
            
            return leagues
            
        except Exception as exc:
            logger.error("Failed to get available leagues from StatPal API: %s", exc)
            # Return empty list if API fails - no mock data
            return []

    async def get_available_countries(self) -> List[Dict[str, Any]]:
        """
        Get available countries from league data.
        Extracts countries from both league data and StatPal API response.
        
        Returns:
            List of countries with metadata
        """
        try:
            # Get leagues (which now extracts from API response)
            leagues = await self.get_available_leagues()
            
            # Extract unique countries
            countries_map = {}
            for league in leagues:
                country = league.get("country", "Unknown")
                
                if country and country != "Unknown":
                    if country not in countries_map:
                        # Get country info from mapping
                        country_info = COUNTRY_MAP.get(country, {})
                        
                        countries_map[country] = {
                            "name": country_info.get("name", country),
                            "flag": country_info.get("flag", league.get("flag", "🏆")),
                            "league_count": 0,
                        }
                    
                    countries_map[country]["league_count"] += 1
            
            # Also extract from API response directly
            try:
                response = await self._get("soccer/matches/live")
                if isinstance(response, dict) and "live_matches" in response:
                    live_matches = response["live_matches"]
                    if "league" in live_matches:
                        for league_data in live_matches["league"]:
                            country = league_data.get("country", "")
                            if country:
                                country_lower = country.lower()
                                # Map country name
                                if country_lower in COUNTRY_MAP:
                                    country_info = COUNTRY_MAP[country_lower]
                                    country_name = country_info.get("name", country.capitalize())
                                    country_flag = country_info.get("flag", "🏆")
                                else:
                                    country_name = country.capitalize()
                                    country_flag = "🏆"
                                
                                if country_name not in countries_map:
                                    countries_map[country_name] = {
                                        "name": country_name,
                                        "flag": country_flag,
                                        "league_count": 0,
                                    }
                                countries_map[country_name]["league_count"] += 1
            except Exception as e:
                logger.debug("Failed to extract countries from API response: %s", e)
            
            # Convert to list and sort by league count
            countries = list(countries_map.values())
            countries.sort(key=lambda x: x["league_count"], reverse=True)
            
            return countries
            
        except Exception as exc:
            logger.error("Failed to get available countries from StatPal API: %s", exc)
            return []

    async def get_daily_matches(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get daily matches from StatPal API.
        
        Args:
            date: Date in YYYY-MM-DD format. If None, uses today's date.
            
        Returns:
            List of daily matches in The Odds API-like format
        """
        try:
            # Check cache first
            cache_key = f"daily_matches_{date or 'today'}"
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                # Cache daily matches for 5 minutes
                if (datetime.now() - cached_time).total_seconds() < 300:
                    logger.debug("Returning cached daily matches")
                    return cached_data
            
            # Prepare date parameter
            params = {}
            if date:
                # Convert YYYY-MM-DD to StatPal format if needed
                params["date"] = date
            else:
                # Use today's date
                today = datetime.now().strftime("%Y-%m-%d")
                params["date"] = today
            
            # Fetch from API
            response = await self._get("soccer/matches/daily", params=params)
            
            # Process response
            matches_data = self._process_daily_matches_response(response)
            
            # Transform matches
            transformed_matches = []
            for match in matches_data:
                try:
                    transformed = self._transform_match_data(match)
                    
                    # Fetch logos if not already present
                    if not transformed.get("home_team_logo") and transformed.get("home_team"):
                        try:
                            home_logo = await self.get_team_logo(transformed.get("home_team"))
                            if home_logo:
                                transformed["home_team_logo"] = home_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch home team logo: {e}")
                    
                    if not transformed.get("away_team_logo") and transformed.get("away_team"):
                        try:
                            away_logo = await self.get_team_logo(transformed.get("away_team"))
                            if away_logo:
                                transformed["away_team_logo"] = away_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch away team logo: {e}")
                    
                    transformed_matches.append(transformed)
                except Exception as exc:
                    logger.warning("Failed to transform daily match data: %s - %s", match, exc)
                    continue
            
            # Cache the results
            self._cache[cache_key] = (transformed_matches, datetime.now())
            
            return transformed_matches
            
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                # Endpoint not available, return empty list
                logger.debug("Daily matches endpoint not available (404)")
                return []
            logger.error("Failed to get daily matches from StatPal API: %s", exc)
            return []
        except Exception as exc:
            logger.error("Failed to get daily matches from StatPal API: %s", exc)
            return []

    async def get_league_matches(self, league_id: str, season: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all matches for a specific league from StatPal API.
        
        Args:
            league_id: League ID
            season: Optional season filter (e.g., "2025/2026")
            
        Returns:
            List of league matches in The Odds API-like format
        """
        try:
            # Check cache first
            cache_key = f"league_matches_{league_id}_{season or 'current'}"
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                # Cache league matches for 10 minutes
                if (datetime.now() - cached_time).total_seconds() < 600:
                    logger.debug("Returning cached league matches")
                    return cached_data
            
            # Prepare params
            params = {}
            if season:
                params["season"] = season
            
            # Fetch from API
            response = await self._get(f"soccer/leagues/{league_id}/matches", params=params)
            
            # Process response
            matches_data = self._process_league_matches_response(response)
            
            # Transform matches
            transformed_matches = []
            for match in matches_data:
                try:
                    transformed = self._transform_match_data(match)
                    
                    # Fetch logos if not already present
                    if not transformed.get("home_team_logo") and transformed.get("home_team"):
                        try:
                            home_logo = await self.get_team_logo(transformed.get("home_team"))
                            if home_logo:
                                transformed["home_team_logo"] = home_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch home team logo: {e}")
                    
                    if not transformed.get("away_team_logo") and transformed.get("away_team"):
                        try:
                            away_logo = await self.get_team_logo(transformed.get("away_team"))
                            if away_logo:
                                transformed["away_team_logo"] = away_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch away team logo: {e}")
                    
                    transformed_matches.append(transformed)
                except Exception as exc:
                    logger.warning("Failed to transform league match data: %s - %s", match, exc)
                    continue
            
            # Cache the results
            self._cache[cache_key] = (transformed_matches, datetime.now())
            
            return transformed_matches
            
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                # Endpoint not available, return empty list
                logger.debug("League matches endpoint not available (404)")
                return []
            logger.error("Failed to get league matches from StatPal API: %s", exc)
            return []
        except Exception as exc:
            logger.error("Failed to get league matches from StatPal API: %s", exc)
            return []

    async def get_match_details(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information for a specific match.
        First tries to get from get_match_by_id, then tries direct API call.
        
        Args:
            match_id: Match ID
            
        Returns:
            Match details if found, None otherwise
        """
        try:
            # First, try to get from get_match_by_id (searches in all matches)
            match_data = await self.get_match_by_id(match_id)
            if match_data:
                # Add odds if not already present
                if not match_data.get("bookmakers"):
                    # Try to get live odds
                    if match_data.get("is_live"):
                        try:
                            live_odds_map = await self.get_live_odds()
                            # Try all possible match IDs
                            for check_id in [match_id, match_data.get("id"), match_data.get("main_id"), 
                                            match_data.get("fallback_id_1"), match_data.get("fallback_id_2"), 
                                            match_data.get("fallback_id_3")]:
                                if check_id and str(check_id) in live_odds_map:
                                    match_data["bookmakers"] = live_odds_map[str(check_id)]
                                    break
                        except Exception as exc:
                            logger.debug("Failed to get live odds for match %s: %s", match_id, exc)
                    
                    # If not live or no live odds, try prematch odds (for upcoming matches)
                    if not match_data.get("bookmakers") and match_data.get("league_id"):
                        try:
                            prematch_odds_map = await self.get_prematch_odds(str(match_data.get("league_id")))
                            # Try all possible match IDs
                            for check_id in [match_id, match_data.get("id"), match_data.get("main_id"), 
                                            match_data.get("fallback_id_1"), match_data.get("fallback_id_2"), 
                                            match_data.get("fallback_id_3")]:
                                if check_id and str(check_id) in prematch_odds_map:
                                    match_data["bookmakers"] = prematch_odds_map[str(check_id)]
                                    logger.debug(f"Matched prematch odds for match {check_id} in get_match_details")
                                    break
                        except Exception as exc:
                            logger.debug("Failed to get prematch odds for match %s: %s", match_id, exc)
                    
                    # If still no odds, try to get from all popular leagues
                    if not match_data.get("bookmakers"):
                        try:
                            popular_league_ids = ["3037", "3258", "3232", "3239", "3054", "3062"]
                            for league_id in popular_league_ids:
                                try:
                                    prematch_odds_map = await self.get_prematch_odds(league_id)
                                    for check_id in [match_id, match_data.get("id"), match_data.get("main_id"), 
                                                    match_data.get("fallback_id_1"), match_data.get("fallback_id_2"), 
                                                    match_data.get("fallback_id_3")]:
                                        if check_id and str(check_id) in prematch_odds_map:
                                            match_data["bookmakers"] = prematch_odds_map[str(check_id)]
                                            logger.debug(f"Matched prematch odds from league {league_id} for match {check_id}")
                                            break
                                    if match_data.get("bookmakers"):
                                        break
                                except Exception as e:
                                    continue
                        except Exception as exc:
                            logger.debug("Failed to search prematch odds in popular leagues: %s", exc)
                
                return match_data
            
            # Fallback: Try direct API call (if endpoint exists)
            # This is especially important for finished matches that might not be in daily matches
            try:
                response = await self._get(f"soccer/matches/{match_id}")
                if isinstance(response, dict):
                    transformed = self._transform_match_data(response)
                    
                    # Fetch logos if not already present
                    if not transformed.get("home_team_logo") and transformed.get("home_team"):
                        try:
                            home_logo = await self.get_team_logo(transformed.get("home_team"))
                            if home_logo:
                                transformed["home_team_logo"] = home_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch home team logo: {e}")
                    
                    if not transformed.get("away_team_logo") and transformed.get("away_team"):
                        try:
                            away_logo = await self.get_team_logo(transformed.get("away_team"))
                            if away_logo:
                                transformed["away_team_logo"] = away_logo
                        except Exception as e:
                            logger.debug(f"Failed to fetch away team logo: {e}")
                    
                    logger.debug(f"Found match {match_id} via direct API call")
                    return transformed
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 404:
                    logger.debug("Direct API call failed for match %s: %s", match_id, exc)
                else:
                    logger.debug("Match %s not found via direct API call (404)", match_id)
            
            return None
            
        except Exception as exc:
            logger.error("Failed to get match details from StatPal API: %s", exc)
            return None

    async def get_match_lineups(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get match lineups (starting XI and substitutes).
        
        Args:
            match_id: Match ID
            
        Returns:
            Match lineups if found, None otherwise
        """
        try:
            response = await self._get(f"soccer/matches/{match_id}/lineups")
            return response if isinstance(response, dict) else None
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug("Match lineups not found for ID: %s", match_id)
                return None
            logger.error("Failed to get match lineups from StatPal API: %s", exc)
            return None
        except Exception as exc:
            logger.error("Failed to get match lineups from StatPal API: %s", exc)
            return None

    async def get_match_events(self, match_id: str) -> List[Dict[str, Any]]:
        """
        Get match events (goals, cards, substitutions).
        
        Args:
            match_id: Match ID
            
        Returns:
            List of match events
        """
        try:
            response = await self._get(f"soccer/matches/{match_id}/events")
            
            if isinstance(response, list):
                return response
            elif isinstance(response, dict):
                # Check for common response wrapper formats
                if "events" in response:
                    return response["events"] if isinstance(response["events"], list) else []
                elif "data" in response:
                    return response["data"] if isinstance(response["data"], list) else []
                return []
            return []
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug("Match events not found for ID: %s", match_id)
                return []
            logger.error("Failed to get match events from StatPal API: %s", exc)
            return []
        except Exception as exc:
            logger.error("Failed to get match events from StatPal API: %s", exc)
            return []

    async def get_match_statistics(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get match statistics (possession, shots, etc.).
        
        Args:
            match_id: Match ID
            
        Returns:
            Match statistics if found, None otherwise
        """
        try:
            response = await self._get(f"soccer/matches/{match_id}/statistics")
            return response if isinstance(response, dict) else None
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug("Match statistics not found for ID: %s", match_id)
                return None
            logger.error("Failed to get match statistics from StatPal API: %s", exc)
            return None
        except Exception as exc:
            logger.error("Failed to get match statistics from StatPal API: %s", exc)
            return None

    async def get_countries(self) -> List[Dict[str, Any]]:
        """
        Get available countries from StatPal API.
        
        Returns:
            List of countries with metadata
        """
        try:
            response = await self._get("soccer/countries")
            
            if isinstance(response, list):
                return response
            elif isinstance(response, dict):
                # Check for common response wrapper formats
                if "countries" in response:
                    return response["countries"] if isinstance(response["countries"], list) else []
                elif "data" in response:
                    return response["data"] if isinstance(response["data"], list) else []
                return []
            return []
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug("Countries endpoint not available (404)")
                # Fallback to extracting from leagues
                return await self.get_available_countries()
            logger.error("Failed to get countries from StatPal API: %s", exc)
            return []
        except Exception as exc:
            logger.error("Failed to get countries from StatPal API: %s", exc)
            return []

    def _process_daily_matches_response(self, response: Any) -> List[Dict[str, Any]]:
        """
        Process daily matches API response.
        
        Args:
            response: Raw API response
            
        Returns:
            List of match dictionaries
        """
        matches_data = []
        
        if isinstance(response, dict):
            # Check for live_matches format (StatPal API uses same format for daily)
            if "live_matches" in response:
                live_matches = response["live_matches"]
                if "league" in live_matches:
                    for league_data in live_matches["league"]:
                        if isinstance(league_data, dict):
                            league_name = league_data.get("name", "")
                            country = league_data.get("country", "")
                            league_id = str(league_data.get("id", "")) if league_data.get("id") else None
                            matches = league_data.get("match", [])
                            
                            for match in matches:
                                if isinstance(match, dict):
                                    match["league"] = league_name
                                    match["country"] = country
                                    if league_id:
                                        match["league_id"] = league_id
                                    matches_data.append(match)
            # Check for common response wrapper formats
            elif "matches" in response:
                matches_data = response["matches"] if isinstance(response["matches"], list) else []
            elif "data" in response:
                matches_data = response["data"] if isinstance(response["data"], list) else []
            elif "daily_matches" in response:
                daily_matches = response["daily_matches"]
                if isinstance(daily_matches, dict) and "matches" in daily_matches:
                    matches_data = daily_matches["matches"] if isinstance(daily_matches["matches"], list) else []
                elif isinstance(daily_matches, list):
                    matches_data = daily_matches
            elif "league" in response:
                # Similar structure to live_matches
                for league_data in response["league"]:
                    if isinstance(league_data, dict):
                        league_name = league_data.get("name", "")
                        country = league_data.get("country", "")
                        league_id = str(league_data.get("id", "")) if league_data.get("id") else None
                        matches = league_data.get("match", [])
                        
                        for match in matches:
                            if isinstance(match, dict):
                                match["league"] = league_name
                                match["country"] = country
                                if league_id:
                                    match["league_id"] = league_id
                                matches_data.append(match)
        elif isinstance(response, list):
            matches_data = response
        
        return matches_data

    def _process_league_matches_response(self, response: Any) -> List[Dict[str, Any]]:
        """
        Process league matches API response.
        
        Args:
            response: Raw API response
            
        Returns:
            List of match dictionaries
        """
        matches_data = []
        
        # League ID to name mapping (for proper league name assignment)
        LEAGUE_ID_TO_NAME = {
            "3037": "Premier League",
            "3258": "Süper Lig",
            "3232": "La Liga",  # Primera División
            "3102": "Serie A",  # Serie A (Italy)
            "3054": "Ligue 1",
            "3062": "Bundesliga",
        }
        
        if isinstance(response, dict):
            # StatPal API format: {"matches": {"tournament": {"week": [{"match": [...]}]}}}
            if "matches" in response:
                matches_obj = response["matches"]
                if isinstance(matches_obj, dict):
                    # Extract tournament info
                    tournament = matches_obj.get("tournament", {})
                    league_name_raw = tournament.get("league", "")
                    country = matches_obj.get("country", "")
                    league_id = str(tournament.get("id", "")) if tournament.get("id") else None
                    
                    # Map league name from ID if available, otherwise use raw name
                    league_name = LEAGUE_ID_TO_NAME.get(league_id, league_name_raw)
                    
                    # Map league names based on country and raw name
                    if league_name_raw.lower() == "primera" and country.lower() == "spain":
                        league_name = "La Liga"
                    elif country.lower() == "italy" and ("serie a" in league_name_raw.lower() or "serie" in league_name_raw.lower()):
                        league_name = "Serie A"
                    elif league_id in LEAGUE_ID_TO_NAME:
                        # Use mapping if available
                        league_name = LEAGUE_ID_TO_NAME[league_id]
                    # Fallback: if country is Italy and league name contains "serie", it's Serie A
                    elif country.lower() == "italy" and "serie" in league_name_raw.lower():
                        league_name = "Serie A"
                    
                    # Extract matches from weeks
                    weeks = tournament.get("week", [])
                    if isinstance(weeks, list):
                        for week in weeks:
                            if isinstance(week, dict):
                                week_matches = week.get("match", [])
                                if isinstance(week_matches, list):
                                    for match in week_matches:
                                        if isinstance(match, dict):
                                            # Add league and country info
                                            match["league"] = league_name
                                            match["country"] = country
                                            if league_id:
                                                match["league_id"] = league_id
                                            matches_data.append(match)
                    # Also check if matches is directly a list
                    elif isinstance(matches_obj, list):
                        matches_data = matches_obj
            # Check for common response wrapper formats
            elif "data" in response:
                matches_data = response["data"] if isinstance(response["data"], list) else []
            elif "fixtures" in response:
                matches_data = response["fixtures"] if isinstance(response["fixtures"], list) else []
            elif "league" in response:
                league_data = response["league"]
                if isinstance(league_data, dict) and "matches" in league_data:
                    matches_data = league_data["matches"] if isinstance(league_data["matches"], list) else []
        elif isinstance(response, list):
            matches_data = response
        
        return matches_data

    async def get_prematch_odds(self, league_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get prematch odds for a specific league from StatPal API.
        
        Args:
            league_id: League ID (e.g., "3037" for Premier League)
            
        Returns:
            Dictionary mapping match_id to list of bookmakers with odds
        """
        try:
            # Check cache first
            cache_key = f"prematch_odds_{league_id}"
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                # Cache prematch odds for 5 minutes (they change less frequently)
                if (datetime.now() - cached_time).total_seconds() < 300:
                    logger.debug(f"Returning cached prematch odds for league {league_id}")
                    return cached_data
            
            # Fetch from API
            response = await self._get(f"soccer/leagues/{league_id}/odds/prematch")
            
            # Process response
            odds_map = {}
            if isinstance(response, dict) and "prematch_odds" in response:
                prematch_data = response["prematch_odds"]
                league_data = prematch_data.get("league", {})
                matches = league_data.get("match", [])
                
                if isinstance(matches, list):
                    for match_data in matches:
                        # Extract all possible IDs
                        main_id = str(match_data.get("main_id", "") or "")
                        fallback_id_1 = str(match_data.get("fallback_id_1", "") or "")
                        fallback_id_2 = str(match_data.get("fallback_id_2", "") or "")
                        fallback_id_3 = str(match_data.get("fallback_id_3", "") or "")
                        
                        # Use main_id as primary, or first available fallback
                        match_id = main_id or fallback_id_1 or fallback_id_2 or fallback_id_3
                        
                        if match_id and "odds" in match_data:
                            # Get team names
                            home_obj = match_data.get("home", {})
                            away_obj = match_data.get("away", {})
                            home_team = home_obj.get("name", "") if isinstance(home_obj, dict) else ""
                            away_team = away_obj.get("name", "") if isinstance(away_obj, dict) else ""
                            
                            # Transform prematch odds format to our format
                            bookmakers = self._transform_prematch_odds_data(
                                match_data.get("odds", []),
                                home_team=home_team,
                                away_team=away_team
                            )
                            if bookmakers:
                                # Store odds with all possible IDs for better matching
                                if main_id:
                                    odds_map[main_id] = bookmakers
                                if fallback_id_1:
                                    odds_map[fallback_id_1] = bookmakers
                                if fallback_id_2:
                                    odds_map[fallback_id_2] = bookmakers
                                if fallback_id_3:
                                    odds_map[fallback_id_3] = bookmakers
            
            # Cache the results
            self._cache[cache_key] = (odds_map, datetime.now())
            
            return odds_map
            
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug(f"Prematch odds endpoint not available for league {league_id} (404)")
                return {}
            logger.error(f"Failed to get prematch odds from StatPal API for league {league_id}: {exc}")
            return {}
        except Exception as exc:
            logger.error(f"Failed to get prematch odds from StatPal API for league {league_id}: {exc}")
            return {}

    async def get_live_odds(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get live odds for all live matches from StatPal API.
        
        Returns:
            Dictionary mapping match_id to list of bookmakers with odds
        """
        try:
            # Check cache first
            cache_key = "live_odds"
            if cache_key in self._cache:
                cached_data, cached_time = self._cache[cache_key]
                # Cache odds for 30 seconds (odds change frequently)
                if (datetime.now() - cached_time).total_seconds() < 30:
                    logger.debug("Returning cached live odds")
                    return cached_data
            
            # Fetch from API
            response = await self._get("soccer/odds/live")
            
            # Process response
            odds_map = {}
            if isinstance(response, dict) and "live_matches" in response:
                live_matches = response["live_matches"]
                if isinstance(live_matches, list):
                    for match_data in live_matches:
                        match_info = match_data.get("match_info", {})
                        match_id = str(
                            match_info.get("main_id") or 
                            match_info.get("fallback_id_1") or 
                            match_info.get("match_id") or 
                            ""
                        )
                        
                        if match_id and "odds" in match_data:
                            # Get team names from match_info for odds transformation
                            team_info = match_data.get("team_info", {})
                            home_team = ""
                            away_team = ""
                            if isinstance(team_info, dict):
                                home_obj = team_info.get("home", {})
                                away_obj = team_info.get("away", {})
                                if isinstance(home_obj, dict):
                                    home_team = home_obj.get("name", "")
                                if isinstance(away_obj, dict):
                                    away_team = away_obj.get("name", "")
                            
                            # Transform odds for this match
                            bookmakers = self._transform_odds_data(
                                match_data.get("odds", []),
                                home_team=home_team,
                                away_team=away_team
                            )
                            if bookmakers:
                                odds_map[match_id] = bookmakers
            
            # Cache the results
            self._cache[cache_key] = (odds_map, datetime.now())
            
            return odds_map
            
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.debug("Live odds endpoint not available (404)")
                return {}
            logger.error("Failed to get live odds from StatPal API: %s", exc)
            return {}
        except Exception as exc:
            logger.error("Failed to get live odds from StatPal API: %s", exc)
            return {}

    def _transform_odds_data(
        self, 
        odds_array: List[Dict[str, Any]], 
        home_team: str = "", 
        away_team: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Transform StatPal odds format to The Odds API bookmakers format.
        
        Args:
            odds_array: List of odds markets from StatPal API
            home_team: Home team name (for mapping "Home" outcome)
            away_team: Away team name (for mapping "Away" outcome)
            
        Returns:
            List of bookmakers in The Odds API format
        """
        if not isinstance(odds_array, list) or len(odds_array) == 0:
            return []
        
        # Market priority mapping (most important first)
        MARKET_PRIORITY = {
            "3610": 1,  # Fulltime Result (1X2)
            "2254": 2,  # Match Goals (Over/Under)
            "12398": 3,  # Both Teams to Score
            "1844": 4,  # 3-Way Handicap
            "1845": 5,  # Asian Handicap
            "11948": 6,  # Double Chance
            "12396": 7,  # Draw No Bet
        }
        
        # Sort markets by priority
        sorted_markets = sorted(
            odds_array,
            key=lambda m: MARKET_PRIORITY.get(str(m.get("market_id", "")), 999)
        )
        
        # Transform markets to The Odds API format
        markets = []
        for market_data in sorted_markets:
            market_id = str(market_data.get("market_id", ""))
            market_name = market_data.get("market_name", "")
            suspended = market_data.get("suspended", "0") == "1"
            
            if suspended:
                continue
            
            lines = market_data.get("lines", [])
            if not isinstance(lines, list) or len(lines) == 0:
                continue
            
            # Determine market key and name based on market_id
            # StatPal market IDs reference: https://statpal.io/docs/
            market_key = None
            market_display_name = market_name or "Unknown Market"
            
            if market_id == "3610":  # Fulltime Result (1X2)
                market_key = "h2h"
                market_display_name = "Maç Sonucu"
            elif market_id == "2254":  # Match Goals (Over/Under)
                market_key = "totals"
                market_display_name = "Toplam Gol"
            elif market_id == "12398":  # Both Teams to Score
                market_key = "btts"
                market_display_name = "Karşılıklı Gol"
            elif market_id == "1844":  # 3-Way Handicap
                market_key = "handicap_3way"
                market_display_name = "Handikap (3 Yönlü)"
            elif market_id == "1845":  # Asian Handicap
                market_key = "handicap_asian"
                market_display_name = "Asya Handikapı"
            elif market_id == "11948":  # Double Chance
                market_key = "double_chance"
                market_display_name = "Çifte Şans"
            elif market_id == "12396":  # Draw No Bet
                market_key = "draw_no_bet"
                market_display_name = "Beraberlik Yok"
            elif "first half" in market_name.lower() or "1st half" in market_name.lower() or market_id in ["3611", "3612"]:  # First Half markets
                if "result" in market_name.lower() or market_id == "3611":
                    market_key = "h2h_1h"
                    market_display_name = "İlk Yarı Sonucu"
                elif "goals" in market_name.lower() or market_id == "3612":
                    market_key = "totals_1h"
                    market_display_name = "İlk Yarı Toplam Gol"
                else:
                    market_key = f"1h_{market_id}"
                    market_display_name = f"İlk Yarı - {market_name}"
            elif "second half" in market_name.lower() or "2nd half" in market_name.lower():
                if "result" in market_name.lower():
                    market_key = "h2h_2h"
                    market_display_name = "İkinci Yarı Sonucu"
                elif "goals" in market_name.lower():
                    market_key = "totals_2h"
                    market_display_name = "İkinci Yarı Toplam Gol"
                else:
                    market_key = f"2h_{market_id}"
                    market_display_name = f"İkinci Yarı - {market_name}"
            elif "penalty" in market_name.lower() or "penaltı" in market_name.lower():
                market_key = "penalty"
                market_display_name = "Penaltı"
            elif "corner" in market_name.lower() or "korner" in market_name.lower():
                market_key = "corners"
                market_display_name = "Korner"
            elif "card" in market_name.lower() or "kart" in market_name.lower():
                market_key = "cards"
                market_display_name = "Kartlar"
            elif "player" in market_name.lower() or "oyuncu" in market_name.lower():
                market_key = "player"
                market_display_name = "Oyuncu Bahisleri"
            else:
                # Include other markets with generic key
                market_key = f"market_{market_id}"
                market_display_name = market_name
            
            if not market_key:
                continue
            
            # Transform outcomes
            outcomes = []
            for line in lines:
                if not isinstance(line, dict):
                    continue
                
                line_suspended = line.get("suspended", "0") == "1"
                if line_suspended:
                    continue
                
                name = line.get("name", "")
                odd_str = line.get("odd", "")
                
                if not name or not odd_str:
                    continue
                
                try:
                    price = float(odd_str)
                except (ValueError, TypeError):
                    continue
                
                # Map StatPal outcome names to The Odds API format
                outcome_name = name
                if market_id == "3610":  # Fulltime Result
                    # Map "Home", "Draw", "Away" to team names
                    if name == "Home" and home_team:
                        outcome_name = home_team
                    elif name == "Away" and away_team:
                        outcome_name = away_team
                    elif name == "Draw":
                        outcome_name = "Draw"
                    # Keep original name if mapping fails
                elif market_id == "2254":  # Match Goals
                    handicap = line.get("handicap", "")
                    if handicap:
                        outcome_name = f"{name} {handicap}"
                
                outcomes.append({
                    "name": outcome_name,
                    "price": price
                })
            
            if outcomes:
                markets.append({
                    "key": market_key,
                    "name": market_display_name,  # Add display name
                    "outcomes": outcomes
                })
        
        if not markets:
            return []
        
        # Return as bookmakers array (The Odds API format)
            return [{
                "key": "statpal",
                "title": "StatPal",
                "markets": markets
            }]
    
    def _transform_prematch_odds_data(
        self,
        odds_array: List[Dict[str, Any]],
        home_team: str = "",
        away_team: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Transform StatPal prematch odds format to The Odds API bookmakers format.
        
        Prematch format:
        {
          "odds": [
            {
              "id": "1834",
              "name": "1x2",
              "bookmaker": [
                {
                  "name": "10Bet",
                  "odd": [
                    {"name": "Home", "value": "2.48"},
                    {"name": "Draw", "value": "3.55"},
                    {"name": "Away", "value": "2.65"}
                  ]
                }
              ]
            }
          ]
        }
        
        Args:
            odds_array: List of odds markets from StatPal prematch API
            home_team: Home team name (for mapping "Home" outcome)
            away_team: Away team name (for mapping "Away" outcome)
            
        Returns:
            List of bookmakers in The Odds API format
        """
        if not isinstance(odds_array, list) or len(odds_array) == 0:
            return []
        
        # Market name to key mapping (prematch odds)
        MARKET_MAP = {
            "1x2": ("h2h", "Maç Sonucu"),
            "1X2": ("h2h", "Maç Sonucu"),
            "Match Goals": ("totals", "Toplam Gol"),
            "Over/Under": ("totals", "Toplam Gol"),
            "Both Teams to Score": ("btts", "Karşılıklı Gol"),
            "BTTS": ("btts", "Karşılıklı Gol"),
            "First Half Result": ("h2h_1h", "İlk Yarı Sonucu"),
            "1st Half Result": ("h2h_1h", "İlk Yarı Sonucu"),
            "First Half Goals": ("totals_1h", "İlk Yarı Toplam Gol"),
            "1st Half Goals": ("totals_1h", "İlk Yarı Toplam Gol"),
            "Second Half Result": ("h2h_2h", "İkinci Yarı Sonucu"),
            "2nd Half Result": ("h2h_2h", "İkinci Yarı Sonucu"),
            "Penalty": ("penalty", "Penaltı"),
            "Corners": ("corners", "Korner"),
            "Cards": ("cards", "Kartlar"),
        }
        
        # Collect all markets from all bookmakers
        markets_map = {}  # key -> outcomes list
        
        for market_data in odds_array:
            market_name = market_data.get("name", "")
            market_info = MARKET_MAP.get(market_name, None)
            
            if not market_info:
                # Try case-insensitive match
                market_name_lower = market_name.lower()
                for key, (m_key, m_name) in MARKET_MAP.items():
                    if key.lower() == market_name_lower:
                        market_info = (m_key, m_name)
                        break
                
                    # If still not found, create generic market
                if not market_info:
                    # Check for common patterns
                    if "first half" in market_name_lower or "1st half" in market_name_lower or "1h" in market_name_lower:
                        if "result" in market_name_lower or "1x2" in market_name_lower:
                            market_info = ("h2h_1h", "İlk Yarı Sonucu")
                        elif "goal" in market_name_lower or "total" in market_name_lower:
                            market_info = ("totals_1h", "İlk Yarı Toplam Gol")
                        elif "double chance" in market_name_lower:
                            market_info = ("double_chance_1h", "İlk Yarı Çifte Şans")
                        elif "both teams" in market_name_lower or "btts" in market_name_lower:
                            market_info = ("btts_1h", "İlk Yarı Karşılıklı Gol")
                        elif "odd" in market_name_lower or "even" in market_name_lower:
                            market_info = ("odd_even_1h", "İlk Yarı Tek/Çift")
                        elif "draw no bet" in market_name_lower or "dnb" in market_name_lower:
                            market_info = ("draw_no_bet_1h", "İlk Yarı Beraberlik Yok")
                        else:
                            market_info = (f"1h_{market_data.get('id', '')}", f"İlk Yarı - {market_name}")
                    elif "second half" in market_name_lower or "2nd half" in market_name_lower or "2h" in market_name_lower:
                        if "result" in market_name_lower or "1x2" in market_name_lower:
                            market_info = ("h2h_2h", "İkinci Yarı Sonucu")
                        elif "goal" in market_name_lower or "total" in market_name_lower:
                            market_info = ("totals_2h", "İkinci Yarı Toplam Gol")
                        elif "double chance" in market_name_lower:
                            market_info = ("double_chance_2h", "İkinci Yarı Çifte Şans")
                        elif "both teams" in market_name_lower or "btts" in market_name_lower:
                            market_info = ("btts_2h", "İkinci Yarı Karşılıklı Gol")
                        elif "odd" in market_name_lower or "even" in market_name_lower:
                            market_info = ("odd_even_2h", "İkinci Yarı Tek/Çift")
                        elif "draw no bet" in market_name_lower or "dnb" in market_name_lower:
                            market_info = ("draw_no_bet_2h", "İkinci Yarı Beraberlik Yok")
                        else:
                            market_info = (f"2h_{market_data.get('id', '')}", f"İkinci Yarı - {market_name}")
                    elif "penalty" in market_name_lower or "penaltı" in market_name_lower:
                        market_info = ("penalty", "Penaltı")
                    elif "corner" in market_name_lower or "korner" in market_name_lower:
                        market_info = ("corners", "Korner")
                    elif "card" in market_name_lower or "kart" in market_name_lower:
                        market_info = ("cards", "Kartlar")
                    elif "double chance" in market_name_lower:
                        market_info = ("double_chance", "Çifte Şans")
                    elif "draw no bet" in market_name_lower or "dnb" in market_name_lower:
                        market_info = ("draw_no_bet", "Beraberlik Yok")
                    elif "odd" in market_name_lower and "even" in market_name_lower:
                        market_info = ("odd_even", "Tek/Çift")
                    else:
                        # Include unknown markets with their original name
                        market_info = (f"market_{market_data.get('id', '')}", market_name)
            
            market_key, market_display_name = market_info
            
            # Get bookmakers for this market
            bookmakers_list = market_data.get("bookmaker", [])
            if not isinstance(bookmakers_list, list):
                continue
            
            # Use the first bookmaker's odds (or aggregate if needed)
            if len(bookmakers_list) > 0:
                first_bookmaker = bookmakers_list[0]
                odds_list = first_bookmaker.get("odd", [])
                
                if not isinstance(odds_list, list):
                    continue
                
                outcomes = []
                for odd_item in odds_list:
                    if not isinstance(odd_item, dict):
                        continue
                    
                    name = odd_item.get("name", "")
                    value_str = odd_item.get("value", "")
                    
                    if not name or not value_str:
                        continue
                    
                    try:
                        price = float(value_str)
                    except (ValueError, TypeError):
                        continue
                    
                    # Map outcome names
                    outcome_name = name
                    if market_key == "h2h":
                        if name == "Home" and home_team:
                            outcome_name = home_team
                        elif name == "Away" and away_team:
                            outcome_name = away_team
                        elif name == "Draw":
                            outcome_name = "Draw"
                    
                    outcomes.append({"name": outcome_name, "price": price})
                
                if outcomes:
                    if market_key not in markets_map:
                        markets_map[market_key] = {
                            "name": market_display_name,
                            "outcomes": []
                        }
                    markets_map[market_key]["outcomes"].extend(outcomes)
        
        # Convert to The Odds API format
        markets = []
        for market_key, market_data in markets_map.items():
            if isinstance(market_data, dict):
                outcomes = market_data.get("outcomes", [])
                market_display_name = market_data.get("name", market_key)
            else:
                # Fallback for old format
                outcomes = market_data if isinstance(market_data, list) else []
                market_display_name = market_key
            
            # Remove duplicates (keep first occurrence)
            seen = set()
            unique_outcomes = []
            for outcome in outcomes:
                outcome_id = f"{outcome['name']}_{market_key}"
                if outcome_id not in seen:
                    seen.add(outcome_id)
                    unique_outcomes.append(outcome)
            
            if unique_outcomes:
                markets.append({
                    "key": market_key,
                    "name": market_display_name,
                    "outcomes": unique_outcomes
                })
        
        if not markets:
            return []
        
        return [{
            "key": "statpal",
            "title": "StatPal",
            "markets": markets
        }]


# Global instance
statpal_service = StatPalApiService()

