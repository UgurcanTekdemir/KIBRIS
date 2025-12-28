from fastapi import FastAPI, APIRouter, Query, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from typing import Optional

from services.sportmonks_service import sportmonks_service


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


# Match API Endpoints - Sportmonks V3
@api_router.get("/matches")
async def get_all_matches(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    league_id: Optional[int] = Query(None, description="Filter by league ID")
):
    """
    Get all matches (upcoming, live, and finished) for a date range or specific league.
    
    Uses Sportmonks V3 API to get fixtures with odds and statistics.
    Combines live matches with upcoming fixtures.
    """
    try:
        # Default to today + 7 days if no date range specified
        from datetime import datetime, timedelta
        if not date_from:
            date_from = datetime.now().strftime("%Y-%m-%d")
        if not date_to:
            date_to = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Get both live matches and fixtures in parallel for better performance
        import asyncio
        livescores_task = sportmonks_service.get_livescores(
            include="participants;scores;events;league;odds"
        )
        fixtures_task = sportmonks_service.get_fixtures(
            date_from=date_from,
            date_to=date_to,
            league_id=league_id,
            include="participants;scores;events;league;odds"
        )
        
        # Fetch both in parallel
        livescores, fixtures = await asyncio.gather(
            livescores_task,
            fixtures_task,
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(livescores, Exception):
            logger.error(f"Error fetching livescores: {livescores}")
            livescores = []
        if isinstance(fixtures, Exception):
            logger.error(f"Error fetching fixtures: {fixtures}")
            fixtures = []
        
        # Combine and deduplicate matches by ID
        all_matches = {}
        
        # Add live matches first (they take priority)
        if livescores:
            for ls in livescores:
                transformed = sportmonks_service._transform_livescore_to_match(ls)
                if transformed and transformed.get("id"):
                    all_matches[transformed["id"]] = transformed
        
        # Add fixtures (only if not already in live matches)
        if fixtures:
            for fixture in fixtures:
                transformed = sportmonks_service._transform_fixture_to_match(fixture)
                if transformed and transformed.get("id"):
                    match_id = transformed["id"]
                    # Only add if not already in live matches
                    if match_id not in all_matches:
                        all_matches[match_id] = transformed
        
        # Convert to list
        transformed_matches = list(all_matches.values())
        
        # Sort by starting_at/commence_time
        transformed_matches.sort(key=lambda m: m.get("commence_time") or m.get("starting_at") or "", reverse=False)
        
        return {"success": True, "data": transformed_matches}
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues")
async def get_leagues():
    """
    Get all available leagues from Sportmonks V3.
    """
    try:
        leagues = await sportmonks_service.get_leagues(
            include="country;currentSeason"
        )
        
        if not leagues:
            return {"success": True, "data": []}
        
        # Transform leagues to frontend format
        transformed_leagues = []
        for league in leagues:
            # Extract league data (handle nested format)
            league_data = league
            if isinstance(league, dict) and "data" in league:
                league_data = league["data"]
            
            # Extract country data
            country_data = league_data.get("country", {})
            if isinstance(country_data, dict) and "data" in country_data:
                country_data = country_data["data"]
            
            transformed_leagues.append({
                "id": league_data.get("id"),
                "name": league_data.get("name", ""),
                "country": country_data.get("name", "") if isinstance(country_data, dict) else "",
                "logo": league_data.get("image_path"),
                "sport_key": "soccer"  # Default for football
            })
        
        return {"success": True, "data": transformed_leagues}
    except Exception as e:
        logger.error(f"Error fetching leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/live")
async def get_live_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """
    Get live matches (matches currently in progress).
    
    Uses Sportmonks V3 API to get live soccer matches with scores and statistics.
    """
    try:
        # Get live matches from Sportmonks V3 API
        # Note: 'time' is not a valid include in Sportmonks V3, status comes from time object in response
        livescores = await sportmonks_service.get_livescores(
            include="participants;scores;events;league;odds"
        )
        
        if not livescores:
            # If no live matches found, return empty list
            return {"success": True, "data": [], "is_live": False}
        
        # Transform each livescore to match format
        transformed_matches = [
            sportmonks_service._transform_livescore_to_match(ls)
            for ls in livescores
        ]
        
        return {"success": True, "data": transformed_matches, "is_live": True}
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed information for a specific match"""
    try:
        # Convert match_id to int (Sportmonks uses integer IDs)
        try:
            fixture_id = int(match_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid match ID format: {match_id}")
        
        # Get fixture from Sportmonks V3 API
        fixture = await sportmonks_service.get_fixture(
            fixture_id,
            include="participants;scores;statistics;lineups;events;odds;venue;season"
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail=f"Match with ID {match_id} not found")
        
        # Transform fixture to match format
        match_data = sportmonks_service._transform_fixture_to_match(fixture)
        
        return {"success": True, "data": match_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/lineups")
async def get_match_lineups(match_id: str):
    """Get match lineups (starting XI and substitutes)"""
    try:
        # Convert match_id to int
        try:
            fixture_id = int(match_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid match ID format: {match_id}")
        
        # Get fixture with lineups
        fixture = await sportmonks_service.get_fixture(
            fixture_id,
            include="lineups;participants"
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract lineups from fixture
        lineups_data = fixture.get("lineups", [])
        if isinstance(lineups_data, dict) and "data" in lineups_data:
            lineups_data = lineups_data["data"]
        
        if not lineups_data:
            return {"success": True, "data": None, "message": "Match lineups not available"}
        
        return {"success": True, "data": lineups_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match lineups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/events")
async def get_match_events(match_id: str):
    """Get match events (goals, cards, substitutions)"""
    try:
        # Convert match_id to int
        try:
            fixture_id = int(match_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid match ID format: {match_id}")
        
        # Get fixture with events
        fixture = await sportmonks_service.get_fixture(
            fixture_id,
            include="events;participants"
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract events from fixture
        events_data = fixture.get("events", [])
        if isinstance(events_data, dict) and "data" in events_data:
            events_data = events_data["data"]
        
        return {"success": True, "data": events_data if isinstance(events_data, list) else []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/statistics")
async def get_match_statistics(match_id: str):
    """Get match statistics (possession, shots, etc.)"""
    try:
        # Convert match_id to int
        try:
            fixture_id = int(match_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid match ID format: {match_id}")
        
        # Get fixture with statistics
        fixture = await sportmonks_service.get_fixture(
            fixture_id,
            include="statistics;participants"
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract statistics from fixture
        statistics_data = fixture.get("statistics", [])
        if isinstance(statistics_data, dict) and "data" in statistics_data:
            statistics_data = statistics_data["data"]
        
        if not statistics_data:
            return {"success": True, "data": None, "message": "Match statistics not available"}
        
        return {"success": True, "data": statistics_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/odds")
async def get_match_odds(match_id: str):
    """Get odds for a specific match"""
    try:
        # Convert match_id to int
        try:
            fixture_id = int(match_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid match ID format: {match_id}")
        
        # Get fixture with odds
        fixture = await sportmonks_service.get_fixture(
            fixture_id,
            include="odds"
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract odds from fixture
        odds_data = fixture.get("odds", {})
        if isinstance(odds_data, dict) and "data" in odds_data:
            odds_data = odds_data["data"]
        
        # Filter popular markets (1x2, BTTS, Over/Under)
        if isinstance(odds_data, list):
            popular_markets = ["1x2", "match_winner", "both_teams_to_score", "btts", "over_under", "total_goals"]
            filtered_odds = [
                odd for odd in odds_data
                if odd.get("market", {}).get("name", "").lower() in [m.lower() for m in popular_markets]
                or any(m in odd.get("market", {}).get("name", "").lower() for m in ["1x2", "btts", "over", "under"])
            ]
            return {"success": True, "data": filtered_odds if filtered_odds else odds_data}
        
        return {"success": True, "data": odds_data if isinstance(odds_data, list) else []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match odds: {e}")
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
app.include_router(api_router, prefix="/api")

# Logging already configured above
