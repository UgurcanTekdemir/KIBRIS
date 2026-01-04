from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from typing import Optional, List
import os
import logging
from pathlib import Path
from datetime import datetime, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app without a prefix
app = FastAPI()

# Create a router (no prefix - routes will be added directly to /api)
api_router = APIRouter()

# Import sportmonks service
from services.sportmonks_service import sportmonks_service
from services.cache import get_cached, set_cached, cache_key
from services.firebase_service import get_latest_odds_snapshot
from services.rate_limit_manager import get_rate_limit_manager

# Bookmaker ID constants
BOOKMAKER_BET365_ID = 2  # Bet365 bookmaker ID in Sportmonks API

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    from datetime import datetime, timezone
    return {
        "status": "healthy",
        "service": "KIBRIS API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/matches")
async def get_matches(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    league_id: Optional[int] = Query(None, description="Filter by league ID"),
    category: Optional[str] = Query(None, description="Filter by category: live, upcoming, finished, all")
):
    """
    Get matches (fixtures) for a date range.
    If no dates provided, returns 1 week ago to 7 days ahead (Turkey timezone).
    Categories: live, upcoming, finished, all
    Cached for 60-120 seconds to handle high traffic.
    """
    try:
        from datetime import timezone, timedelta
        
        # Turkey timezone (UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        now_turkey = datetime.now(turkey_tz)
        
        # Default to 1 week ago to 7 days ahead if no dates provided
        if not date_from:
            date_from = (now_turkey - timedelta(days=7)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = (now_turkey + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Generate cache key
        cache_key_str = cache_key("matches", date_from, date_to, league_id, category)
        
        # Try to get from cache (TTL: 60-120 seconds for fixtures list)
        cached_result = await get_cached(cache_key_str)
        if cached_result is not None:
            logger.debug(f"Cache HIT for matches: {cache_key_str}")
            return cached_result
        
        logger.debug(f"Cache MISS for matches: {cache_key_str}")
        
        # Include basic match data first (without complex odds to avoid API errors)
        # Include event types and players for proper event icon detection
        # Note: time object is included by default in fixtures, no need to add it to include
        include = "participants;scores;events.type;events.player;league;odds"
        # Don't filter by bookmaker for list endpoint to avoid API errors
        filters = None
        
        fixtures = await sportmonks_service.get_fixtures(
            date_from=date_from,
            date_to=date_to,
            league_id=league_id,
            include=include,
            filters=filters
        )
        
        # Transform fixtures to match format with Turkey timezone
        matches = []
        for fixture in fixtures:
            transformed = sportmonks_service._transform_fixture_to_match(fixture, timezone_offset=3)
            matches.append(transformed)
        
        # Categorize matches - prioritize live, then finished, then upcoming
        # A match can only be in one category
        live_matches = []
        upcoming_matches = []
        finished_matches = []
        
        for m in matches:
            if m.get("is_live", False):
                # Live matches should not appear in other categories
                live_matches.append(m)
            elif m.get("is_finished", False):
                # Finished matches
                finished_matches.append(m)
            else:
                # Upcoming matches (not live and not finished)
                upcoming_matches.append(m)
        
        # Filter by category if specified
        if category == "live":
            matches = live_matches
        elif category == "upcoming":
            matches = upcoming_matches
        elif category == "finished":
            matches = finished_matches
        # else "all" or None - return all matches
        
        result = {
            "success": True,
            "data": matches,
            "count": len(matches),
            "categories": {
                "live": len(live_matches),
                "upcoming": len(upcoming_matches),
                "finished": len(finished_matches),
                "total": len(matches)
            }
        }
        
        # Cache result (TTL: 60-120 seconds for fixtures list, use 90 seconds as average)
        await set_cached(cache_key_str, result, ttl_seconds=90)
        
        return result
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/live")
async def get_live_matches():
    """
    Get all live matches (excludes finished matches).
    Cached for 6-8 seconds (balances rate limit with data freshness).
    """
    try:
        # Generate cache key
        cache_key_str = cache_key("matches:live")
        
        # Try to get from cache (TTL: 6-8 seconds for live matches)
        cached_result = await get_cached(cache_key_str)
        if cached_result is not None:
            logger.debug(f"Cache HIT for live matches")
            return cached_result
        
        logger.debug(f"Cache MISS for live matches")
        
        # Include basic match data with periods and state for accurate live minutes
        # periods include provides minutes, seconds, ticking, time_added, has_timer
        # state include provides match phase information
        # Include event types and players for proper event icon detection
        # Note: time object is included by default in livescores, no need to add it to include
        include = "participants;scores;events.type;events.player;league;odds;periods;state"
        
        # Don't use filters or league_ids to get ALL live matches (not just popular leagues)
        # This ensures we get all live matches, not just filtered ones
        livescores = await sportmonks_service.get_livescores(include=include)
        
        # Transform livescores to match format and filter out finished matches
        matches = []
        for livescore in livescores:
            transformed = sportmonks_service._transform_livescore_to_match(livescore)
            # Include matches that are:
            # 1. Live (is_live = True) and not finished, OR
            # 2. In half-time break (HT status) and not finished (to show "DEVRE ARASI")
            # Note: HT matches should have is_live=False but still be included
            status = (transformed.get("status", "") or "").upper()
            is_live = transformed.get("is_live", False)
            is_finished = transformed.get("is_finished", False)
            state_id = transformed.get("state_id")
            is_ht = status in ["HT", "HALF_TIME"] or state_id == 3
            
            # Only include truly live matches (is_live=True) or HT matches (not finished)
            # Exclude finished, postponed, and cancelled matches
            if not is_finished and state_id not in [4, 5, 6, 7]:
                if is_live or is_ht:
                    matches.append(transformed)
        
        result = {
            "success": True,
            "data": matches,
            "count": len(matches)
        }
        
        # Cache result (TTL: 3-5 seconds for live matches, use 4 seconds for better freshness)
        await set_cached(cache_key_str, result, ttl_seconds=4)
        
        return result
    except Exception as e:
        error_detail = str(e)
        logger.error(f"Error fetching live matches: {error_detail}")
        logger.exception(e)  # Log full traceback for debugging
        raise HTTPException(status_code=500, detail=error_detail)

@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: int):
    """
    Get detailed match information including odds, statistics, lineups, events.
    If odds are not included in fixture response, fetch them separately.
    Cached based on match status: 5-10 seconds for in-play, 60-120 seconds for pre-match.
    """
    try:
        # Generate cache key
        cache_key_str = cache_key("match:details", match_id)
        
        # Try to get from cache first (we'll determine TTL after fetching match status)
        cached_result = await get_cached(cache_key_str)
        if cached_result is not None:
            logger.debug(f"Cache HIT for match details: {match_id}")
            return cached_result
        
        logger.debug(f"Cache MISS for match details: {match_id}")
        # First, fetch basic match data (without odds to avoid API errors with long include strings)
        # Include event types and players for proper event icon detection
        # Include league with nested structure
        # Include sidelined for match-specific injuries and suspensions
        # Include statistics.type to get developer_name and other type information
        include_basic = "participants;scores;statistics.type;lineups.player;lineups.position;lineups.type;events.type;events.player;venue;season;league;sidelined.player;sidelined.type;periods;state"
        
        fixture = await sportmonks_service.get_fixture(
            fixture_id=match_id,
            include=include_basic,
            filters=None  # Don't filter for basic data
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Transform fixture to match format with Turkey timezone
        match = sportmonks_service._transform_fixture_to_match(fixture, timezone_offset=3)
        
        # Now fetch odds separately with all market data from bet365
        logger.info(f"Fetching odds separately for match {match_id} from bookmaker {BOOKMAKER_BET365_ID} (Bet365)...")
        try:
            # Get all odds data - try simple format first
            # If simple doesn't work, we'll try nested format
            odds_include = "odds"
            odds_filters = None  # Get all bookmakers first, filter in code
            odds_fixture = await sportmonks_service.get_fixture(
                fixture_id=match_id,
                include=odds_include,
                filters=odds_filters
            )
            
            raw_odds_data = None
            if odds_fixture:
                raw_odds_data = odds_fixture.get("odds", {})
                logger.info(f"Fetched odds fixture for match {match_id}, raw_odds_data type: {type(raw_odds_data)}")
            else:
                logger.warning(f"Failed to fetch odds fixture for match {match_id}")
            
            if odds_fixture and raw_odds_data:
                logger.info(f"Raw odds data type for match {match_id}: {type(raw_odds_data)}, is dict: {isinstance(raw_odds_data, dict)}, is list: {isinstance(raw_odds_data, list)}")
                if isinstance(raw_odds_data, dict):
                    if "data" in raw_odds_data:
                        data_len = len(raw_odds_data.get("data", [])) if isinstance(raw_odds_data.get("data"), list) else 'not a list'
                        logger.info(f"Odds data has 'data' key, length: {data_len}")
                    else:
                        logger.info(f"Odds data dict keys: {list(raw_odds_data.keys())[:10]}")
                elif isinstance(raw_odds_data, list):
                    logger.info(f"Odds data is list, length: {len(raw_odds_data)}")
                
                # Extract odds and filter by bookmaker 1
                # Temporarily check all bookmakers to see if cards markets exist
                odds_data_all = sportmonks_service._extract_and_normalize_odds(raw_odds_data, bookmaker_id_filter=None)
                
                # Check for cards markets with various patterns
                cards_all = [o for o in odds_data_all if any(
                    keyword in (o.get('market_name','') or '').lower() 
                    for keyword in ['card', 'booking', 'yellow', 'red', 'kart', 'sending']
                )]
                
                if cards_all:
                    logger.info(f"Found {len(cards_all)} cards markets from ALL bookmakers for match {match_id}")
                    logger.info(f"Cards markets: {[c.get('market_name') for c in cards_all[:10]]}")
                    logger.info(f"Cards bookmakers: {set([c.get('bookmaker_id') for c in cards_all])}")
                else:
                    # Log all unique market names to see what we're getting
                    all_markets = set([o.get('market_name') for o in odds_data_all if o.get('market_name')])
                    logger.info(f"No cards markets found for match {match_id}. Total unique markets: {len(all_markets)}")
                    # Log first 20 market names for debugging
                    logger.info(f"Sample market names: {sorted(list(all_markets))[:20]}")
                
                # Now filter by bet365
                odds_data = sportmonks_service._extract_and_normalize_odds(raw_odds_data, bookmaker_id_filter=BOOKMAKER_BET365_ID)
                
                # Apply snapshot diff filter (Bet365 behavior)
                previous_snapshot = await get_latest_odds_snapshot(match_id)
                match_status = match.get("status", "LIVE")
                if previous_snapshot:
                    odds_data = sportmonks_service._filter_by_snapshot_diff(
                        odds_data,
                        previous_snapshot,
                        match_status
                    )
                    logger.info(f"Applied snapshot diff filter for match {match_id}, {len(odds_data)} odds remaining")
                
                if odds_data:
                    match["odds"] = odds_data
                    logger.info(f"Fetched {len(odds_data)} odds separately for match {match_id}")
                else:
                    logger.warning(f"No odds data extracted for match {match_id} after normalization")
                    logger.warning(f"Raw odds data sample: {str(raw_odds_data)[:500]}")
            else:
                logger.warning(f"Failed to fetch odds fixture for match {match_id} - odds_fixture: {bool(odds_fixture)}, raw_odds_data: {bool(raw_odds_data)}")
        except Exception as e:
            logger.warning(f"Failed to fetch odds separately for match {match_id}: {e}")
        
        result = {
            "success": True,
            "data": match
        }
        
        # Determine cache TTL based on match status
        # In-play matches: 10 seconds (odds update frequently)
        # Finished matches: 300 seconds (5 minutes - finished matches don't change)
        # Pre-match matches: 180 seconds (3 minutes - odds update less frequently)
        is_live = match.get("is_live", False)
        is_finished = match.get("is_finished", False)
        
        if is_live and not is_finished:
            # In-play match: cache for 10 seconds
            cache_ttl = 10
        elif is_finished:
            # Finished match: cache for 300 seconds (5 minutes)
            cache_ttl = 300
        else:
            # Pre-match (upcoming): cache for 180 seconds (3 minutes)
            cache_ttl = 180
        
        # Cache result
        await set_cached(cache_key_str, result, ttl_seconds=cache_ttl)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details {match_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/{match_id}/odds")
async def get_match_odds(match_id: int):
    """
    Get odds for a specific match using fixture-specific endpoint.
    This is the most stable endpoint for match detail pages (71 markets).
    Uses: GET /odds/inplay/fixtures/{fixture_id}/bookmakers/2
    Returns normalized odds data.
    """
    try:
        # Generate cache key
        cache_key_str = cache_key("match:odds", match_id)
        
        # Try to get from cache
        cached_result = await get_cached(cache_key_str)
        if cached_result is not None:
            logger.debug(f"Cache HIT for match odds: {match_id}")
            return cached_result
        
        logger.debug(f"Cache MISS for match odds: {match_id}")
        
        # Use fixture-specific odds endpoint (most stable for 71 markets)
        # This endpoint directly connects fixture + bookmaker, reducing mismatch risk
        odds_data = await sportmonks_service.get_inplay_odds_by_fixture(match_id, bookmaker_id=2)
        
        # Normalize odds
        normalized_odds = sportmonks_service._extract_and_normalize_odds(odds_data, bookmaker_id_filter=2)
        
        # Apply snapshot diff filter (Bet365 behavior)
        previous_snapshot = await get_latest_odds_snapshot(match_id)
        # Get match status from fixture if available, otherwise default to LIVE
        match_status = "LIVE"  # Default, could be improved by fetching match details
        if previous_snapshot:
            normalized_odds = sportmonks_service._filter_by_snapshot_diff(
                normalized_odds,
                previous_snapshot,
                match_status
            )
            logger.debug(f"Applied snapshot diff filter for match {match_id} odds, {len(normalized_odds)} odds remaining")
        
        result = {
            "success": True,
            "data": normalized_odds,
            "count": len(normalized_odds)
        }
        
        # Cache result (TTL: 3-5 seconds for live matches, 60 seconds for pre-match)
        await set_cached(cache_key_str, result, ttl_seconds=4)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching odds for match {match_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/{match_id}/lineups")
async def get_match_lineups(match_id: int):
    """
    Get lineups for a specific match.
    Returns lineups data from match details.
    """
    try:
        # Get match details which includes lineups with type information
        include = "participants;lineups.player;lineups.position;lineups.type"
        
        fixture = await sportmonks_service.get_fixture(
            fixture_id=match_id,
            include=include
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract lineups from fixture
        lineups_data = fixture.get("lineups", [])
        if isinstance(lineups_data, dict) and "data" in lineups_data:
            lineups_data = lineups_data["data"]
        
        # Get participants to identify home/away teams
        participants = fixture.get("participants", [])
        if isinstance(participants, dict) and "data" in participants:
            participants = participants["data"]
        
        home_team_id = None
        away_team_id = None
        
        for participant in participants:
            if participant.get("meta", {}).get("location") == "home":
                home_team_id = participant.get("id")
            elif participant.get("meta", {}).get("location") == "away":
                away_team_id = participant.get("id")
        
        # Transform lineups to a more usable format
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
            # Type ID 12 = Starting XI, Type ID 13 = Substitutes (or check type name)
            for lineup_item in lineups_data:
                team_id = lineup_item.get("team_id") or lineup_item.get("participant_id")
                type_id = lineup_item.get("type_id")
                type_name = lineup_item.get("type", {})
                if isinstance(type_name, dict):
                    type_name = type_name.get("name", "").lower()
                else:
                    type_name = str(type_name).lower()
                
                # Determine if starting XI or substitute
                # Type ID 12 = Starting XI, Type ID 13 = Substitutes (according to Sportmonks API)
                # Log for debugging
                player_name = lineup_item.get("player_name") or lineup_item.get("player", {}).get("name", "Unknown")
                logger.info(f"Lineup item: type_id={type_id}, type_name='{type_name}', player='{player_name}', team_id={team_id}")
                
                # Check if it's a substitute (type_id 13 = substitute, or keywords in type_name)
                is_substitute = (
                    type_id == 13 or
                    "substitute" in type_name or
                    "bench" in type_name or
                    "reserve" in type_name
                )
                # Check if it's starting XI (type_id 12 = starting XI, or keywords in type_name)
                is_starting = (
                    type_id == 12 or 
                    "starting" in type_name or 
                    "xi" in type_name or
                    "lineup" in type_name
                )
                
                logger.info(f"  -> is_substitute={is_substitute}, is_starting={is_starting}")
                
                player_data = {
                    "id": lineup_item.get("player_id"),
                    "name": lineup_item.get("player_name") or lineup_item.get("player", {}).get("name", ""),
                    "position": lineup_item.get("position", {}).get("name", "") if isinstance(lineup_item.get("position"), dict) else "",
                    "jersey_number": lineup_item.get("jersey_number"),
                    "image": lineup_item.get("player", {}).get("image_path", "") if isinstance(lineup_item.get("player"), dict) else ""
                }
                
                # Add to appropriate list - prioritize substitute check over starting
                if team_id == home_team_id:
                    if is_substitute:
                        transformed_lineups["home"]["substitutes"].append(player_data)
                        logger.info(f"  -> Added to home substitutes: {player_name}")
                    elif is_starting:
                        transformed_lineups["home"]["startingXI"].append(player_data)
                        logger.info(f"  -> Added to home startingXI: {player_name}")
                    else:
                        logger.warning(f"  -> Player not classified: {player_name} (type_id={type_id}, type_name='{type_name}')")
                elif team_id == away_team_id:
                    if is_substitute:
                        transformed_lineups["away"]["substitutes"].append(player_data)
                        logger.info(f"  -> Added to away substitutes: {player_name}")
                    elif is_starting:
                        transformed_lineups["away"]["startingXI"].append(player_data)
                        logger.info(f"  -> Added to away startingXI: {player_name}")
                    else:
                        logger.warning(f"  -> Player not classified: {player_name} (type_id={type_id}, type_name='{type_name}')")
        
        return {
            "success": True,
            "data": transformed_lineups
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching lineups for match {match_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/teams/{team_id}/injuries")
async def get_team_injuries(team_id: int):
    """
    Get injuries and suspensions for a specific team.
    Note: Sportmonks API may not have injuries endpoint, returns empty array if not available.
    """
    try:
        # Try to fetch injuries from Sportmonks API
        # Note: Sportmonks V3 may not have a direct injuries endpoint
        # This is a placeholder that can be extended if the API supports it
        try:
            response = await sportmonks_service._get(f"teams/{team_id}/injuries")
            if isinstance(response, dict) and "data" in response:
                injuries = response["data"]
            elif isinstance(response, list):
                injuries = response
            else:
                injuries = []
        except Exception as e:
            # If injuries endpoint doesn't exist, return empty array
            logger.debug(f"Injuries endpoint not available for team {team_id}: {e}")
            injuries = []
        
        return {
            "success": True,
            "data": injuries if isinstance(injuries, list) else [],
            "count": len(injuries) if isinstance(injuries, list) else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching injuries for team {team_id}: {e}")
        # Return empty array instead of error, as injuries may not be available
        return {
            "success": True,
            "data": [],
            "count": 0
        }

@api_router.get("/leagues")
async def get_leagues():
    """Get all available leagues"""
    try:
        include = "country;currentSeason"
        leagues = await sportmonks_service.get_leagues(include=include)
        
        return {
            "success": True,
            "data": leagues,
            "count": len(leagues)
        }
    except Exception as e:
        logger.error(f"Error fetching leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/leagues/{league_id}/standings")
async def get_league_standings(
    league_id: int,
    season_id: Optional[int] = Query(None, description="Optional season ID. If not provided, uses current season.")
):
    """Get league standings by league ID"""
    try:
        standings = await sportmonks_service.get_standings_by_league(league_id, season_id)
        
        if not standings:
            return {
                "success": False,
                "data": None,
                "message": "Standings not found for this league"
            }
        
        return {
            "success": True,
            "data": standings
        }
    except Exception as e:
        logger.error(f"Error fetching standings for league {league_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/stats")
async def get_stats():
    """Get homepage statistics (today matches, upcoming matches, total matches, leagues count)"""
    try:
        from datetime import timezone, timedelta
        
        # Turkey timezone (UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        now_turkey = datetime.now(turkey_tz)
        today = now_turkey.strftime("%Y-%m-%d")
        seven_days_later = (now_turkey + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Get matches for the next 7 days
        # Include all odds data: bookmaker, market, values for all markets from bookmaker 1
        include = "participants;scores;events.type;events.player;league;odds;odds.bookmaker;odds.market;odds.values;odds.participants"
        # Use bet365 for all odds
        filters = f"bookmakers:{BOOKMAKER_BET365_ID}"
        fixtures = await sportmonks_service.get_fixtures(
            date_from=today,
            date_to=seven_days_later,
            include=include,
            filters=filters
        )
        
        # Transform fixtures to match format
        matches = []
        for fixture in fixtures:
            transformed = sportmonks_service._transform_fixture_to_match(fixture, timezone_offset=3)
            matches.append(transformed)
        
        # Filter matches
        today_matches = []
        upcoming_matches = []
        unique_leagues = set()
        
        for m in matches:
            # Exclude finished and postponed matches
            status = (m.get("status") or "").upper()
            is_finished = status in ["FT", "FINISHED", "CANCELED", "CANCELLED"]
            is_postponed = status == "POSTPONED"
            
            if is_finished or is_postponed:
                continue
            
            # Get date from match - could be in date field or commence_time
            match_date = m.get("date")
            if not match_date:
                # Extract date from commence_time (YYYY-MM-DD format)
                commence_time = m.get("commence_time") or m.get("commence_time_utc")
                if commence_time:
                    try:
                        if isinstance(commence_time, str):
                            # Handle different formats: "2025-12-29 19:45:00" or "2025-12-29T19:45:00Z"
                            if "T" in commence_time:
                                match_date = commence_time.split("T")[0]
                            elif " " in commence_time:
                                match_date = commence_time.split(" ")[0]
                            else:
                                match_date = commence_time[:10] if len(commence_time) >= 10 else None
                    except:
                        pass
            
            if not match_date:
                continue
            
            # Normalize date format (handle DD.MM.YYYY to YYYY-MM-DD)
            if "." in match_date and len(match_date.split(".")) == 3:
                try:
                    parts = match_date.split(".")
                    if len(parts) == 3:
                        match_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
                except:
                    pass
            
            # Count today matches
            if match_date == today:
                today_matches.append(m)
            
            # Count upcoming matches (including today)
            if match_date >= today:
                upcoming_matches.append(m)
            
            # Collect unique leagues
            league = m.get("league") or m.get("league_name") or m.get("leagueName")
            if league and league.strip():
                unique_leagues.add(league.strip())
        
        return {
            "success": True,
            "data": {
                "today": len(today_matches),
                "upcoming": len(upcoming_matches),
                "total": len(matches),
                "leagues": len(unique_leagues)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# CORS Configuration
cors_origins_str = os.environ.get('CORS_ORIGINS', '*')
cors_origins = cors_origins_str.split(',') if cors_origins_str != '*' else ['*']
allow_creds = cors_origins_str != '*'

# Add CORS middleware BEFORE including the router (order matters!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router in the main app (after CORS middleware) with /api prefix
# Rate limit observability endpoint
@api_router.get("/rate-limit/metrics")
async def get_rate_limit_metrics(entity: Optional[str] = None):
    """
    Get rate limit metrics for observability.
    
    Args:
        entity: Optional entity name to filter metrics (e.g., "fixtures", "livescores")
    
    Returns:
        Rate limit metrics and alerts
    """
    try:
        rate_limit_manager = get_rate_limit_manager()
        metrics = rate_limit_manager.get_metrics(entity=entity)
        alerts = rate_limit_manager.check_alerts()
        
        return {
            "success": True,
            "metrics": metrics,
            "alerts": alerts,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting rate limit metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router, prefix="/api")

# Startup and shutdown events for background worker
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup."""
    try:
        from services.odds_worker import start_odds_worker
        await start_odds_worker()
        logger.info("Application startup completed - odds worker started")
    except Exception as e:
        logger.error(f"Error starting odds worker: {e}")
        # Don't fail startup if worker fails - app should still be usable


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background tasks on application shutdown."""
    try:
        from services.odds_worker import stop_odds_worker
        await stop_odds_worker()
        logger.info("Application shutdown completed - odds worker stopped")
    except Exception as e:
        logger.error(f"Error stopping odds worker: {e}")

# Logging already configured above
