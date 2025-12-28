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
        
        # Include odds (simpler format to avoid API errors)
        include = "participants;scores;events;league;odds"
        
        fixtures = await sportmonks_service.get_fixtures(
            date_from=date_from,
            date_to=date_to,
            league_id=league_id,
            include=include
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
        
        return {
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
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/live")
async def get_live_matches():
    """Get all live matches"""
    try:
        # Include odds (simpler format to avoid API errors)
        include = "participants;scores;events;league;odds"
        
        livescores = await sportmonks_service.get_livescores(include=include)
        
        # Transform livescores to match format
        matches = []
        for livescore in livescores:
            transformed = sportmonks_service._transform_livescore_to_match(livescore)
            matches.append(transformed)
        
        return {
            "success": True,
            "data": matches,
            "count": len(matches)
        }
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: int):
    """
    Get detailed match information including odds, statistics, lineups, events.
    If odds are not included in fixture response, fetch them separately.
    """
    try:
        # Include all relevant data with nested odds structure
        # Note: Using simpler odds format to avoid API errors
        include = "participants;scores;statistics;lineups;events;odds;venue;season"
        
        fixture = await sportmonks_service.get_fixture(
            fixture_id=match_id,
            include=include
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Transform fixture to match format
        match = sportmonks_service._transform_fixture_to_match(fixture)
        
        # If odds are empty, try to fetch them separately
        if not match.get("odds") or len(match.get("odds", [])) == 0:
            logger.info(f"Odds not found in fixture response for match {match_id}, fetching separately...")
            try:
                # Fetch odds separately
                odds_include = "participants;odds.bookmaker;odds.market;odds.values"
                odds_fixture = await sportmonks_service.get_fixture(
                    fixture_id=match_id,
                    include=odds_include
                )
                if odds_fixture:
                    raw_odds_data = odds_fixture.get("odds", {})
                    odds_data = sportmonks_service._extract_and_normalize_odds(raw_odds_data)
                    if odds_data:
                        match["odds"] = odds_data
                        logger.info(f"Fetched {len(odds_data)} odds separately for match {match_id}")
            except Exception as e:
                logger.warning(f"Failed to fetch odds separately for match {match_id}: {e}")
        
        return {
            "success": True,
            "data": match
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details {match_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/{match_id}/odds")
async def get_match_odds(match_id: int):
    """
    Get odds for a specific match.
    Returns normalized odds data.
    """
    try:
        # Include odds with nested structure
        include = "participants;odds"
        
        fixture = await sportmonks_service.get_fixture(
            fixture_id=match_id,
            include=include
        )
        
        if not fixture:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Extract and normalize odds
        raw_odds_data = fixture.get("odds", {})
        odds_data = sportmonks_service._extract_and_normalize_odds(raw_odds_data)
        
        return {
            "success": True,
            "data": odds_data,
            "count": len(odds_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching odds for match {match_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
