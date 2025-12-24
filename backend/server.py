from fastapi import FastAPI, APIRouter, Query, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from nosy_api import nosy_api_service
from the_odds_api import the_odds_service
from statpal_api import statpal_api_service


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection (optional - only if MONGO_URL is provided)
mongo_url = os.environ.get('MONGO_URL')
client = None
db = None

if mongo_url:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'kibris_db')]
        logger.info("MongoDB connection established")
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}. Continuing without MongoDB.")
else:
    logger.info("MongoDB URL not provided. Continuing without MongoDB.")

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


# Banner Models
class Banner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    image_url: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    button_text: Optional[str] = None
    is_active: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BannerCreate(BaseModel):
    image_url: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    button_text: Optional[str] = None
    is_active: bool = True
    order: int = 0

class BannerUpdate(BaseModel):
    image_url: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    button_text: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "KIBRIS API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mongodb_connected": db is not None
    }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    if not db:
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if not db:
        return []
    
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# Match API Endpoints
@api_router.get("/matches")
async def get_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)"),
    league: Optional[str] = Query(None, description="League name filter"),
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get betting program matches from StatPal API"""
    try:
        matches = await statpal_api_service.get_matches(date=date)
        return {"success": True, "data": matches, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching matches from StatPal API: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/live")
async def get_live_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """
    Get live matches (matches currently in progress) from StatPal API.
    """
    try:
        live_matches = await statpal_api_service.get_live_matches()
        return {"success": True, "data": live_matches, "is_live": True, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching live matches from StatPal API: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed information for a specific match from StatPal API"""
    try:
        match_data = await statpal_api_service.get_match_details(match_id)
        if not match_data:
            raise HTTPException(status_code=404, detail="Match not found")
        return {"success": True, "data": match_data, "source": "statpal"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details from StatPal API: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/popular")
async def get_popular_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """Get popular matches (matches with most bookmakers)"""
    try:
        matches = await the_odds_service.get_popular_matches(limit=20)
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching popular matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues")
async def get_leagues(
    match_type: int = Query(1, description="Match type"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get available leagues from The Odds API"""
    try:
        leagues = await the_odds_service.get_available_leagues()
        # Filter by country if provided
        if country:
            leagues = [l for l in leagues if l.get("country", "").lower() == country.lower()]
        return {"success": True, "data": leagues}
    except Exception as e:
        logger.error(f"Error fetching leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/countries")
async def get_countries(
    match_type: int = Query(1, description="Match type")
):
    """Get available countries from The Odds API leagues"""
    try:
        countries = await the_odds_service.get_available_countries()
        return {"success": True, "data": countries}
    except Exception as e:
        logger.error(f"Error fetching countries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/test")
async def test_api_connection():
    """Test NosyAPI connection and token"""
    try:
        # Test with a real endpoint - get match types
        result = await nosy_api_service.get_match_types()
        return {
            "success": True,
            "message": "API connection successful",
            "api_response": result,
            "token_configured": bool(nosy_api_service.token),
            "token_length": len(nosy_api_service.token) if nosy_api_service.token else 0
        }
    except Exception as e:
        logger.error(f"API test failed: {e}")
        return {
            "success": False,
            "message": f"API connection failed: {str(e)}",
            "token_configured": bool(nosy_api_service.token),
            "token_length": len(nosy_api_service.token) if nosy_api_service.token else 0,
            "error_details": str(e)
        }

@api_router.get("/test-odds-api")
async def test_odds_api():
    """Test The Odds API connection and configuration"""
    from the_odds_api import THE_ODDS_API_KEY, DEFAULT_SPORT_KEYS
    import httpx
    
    api_key_configured = bool(THE_ODDS_API_KEY)
    api_key_length = len(THE_ODDS_API_KEY) if THE_ODDS_API_KEY else 0
    api_key_preview = THE_ODDS_API_KEY[:8] + "..." if THE_ODDS_API_KEY and len(THE_ODDS_API_KEY) > 8 else "N/A"
    
    # First test: Check if API key is valid by calling /sports endpoint
    sports_test_result = None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            sports_url = "https://api.the-odds-api.com/v4/sports/"
            response = await client.get(sports_url, params={"apiKey": THE_ODDS_API_KEY})
            if response.status_code == 200:
                sports_data = response.json()
                sports_test_result = {
                    "valid": True,
                    "sports_count": len(sports_data) if isinstance(sports_data, list) else 0
                }
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"text": response.text}
                sports_test_result = {
                    "valid": False,
                    "status_code": response.status_code,
                    "error": error_data
                }
    except Exception as e:
        sports_test_result = {
            "valid": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    # Second test: Try to fetch matches
    matches_test_result = None
    try:
        matches = await the_odds_service.get_matches()
        matches_test_result = {
            "success": True,
            "matches_count": len(matches),
            "sample_matches": matches[:2] if matches else []
        }
    except Exception as e:
        matches_test_result = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    return {
        "api_key_configured": api_key_configured,
        "api_key_length": api_key_length,
        "api_key_preview": api_key_preview,
        "default_sports": DEFAULT_SPORT_KEYS,
        "sports_endpoint_test": sports_test_result,
        "matches_endpoint_test": matches_test_result,
        "overall_success": sports_test_result and sports_test_result.get("valid") and matches_test_result and matches_test_result.get("success")
    }


# StatPal API Endpoints
@api_router.get("/matches/statpal")
async def get_statpal_matches(
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    league_id: Optional[int] = Query(None, description="League ID filter"),
    team_id: Optional[int] = Query(None, description="Team ID filter")
):
    """Get soccer matches from StatPal API"""
    try:
        matches = await statpal_api_service.get_matches(
            date=date,
            league_id=league_id,
            team_id=team_id
        )
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching StatPal matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/live")
async def get_statpal_live_matches():
    """Get live soccer matches from StatPal API"""
    try:
        matches = await statpal_api_service.get_live_matches()
        return {"success": True, "data": matches, "is_live": True}
    except Exception as e:
        logger.error(f"Error fetching StatPal live matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/{match_id}")
async def get_statpal_match_details(match_id: str):
    """Get detailed information for a specific match from StatPal API"""
    try:
        match_data = await statpal_api_service.get_match_details(match_id)
        if not match_data:
            raise HTTPException(status_code=404, detail="Match not found")
        return {"success": True, "data": match_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching StatPal match details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/results")
async def get_statpal_results(
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)")
):
    """Get finished match results from StatPal API"""
    try:
        results = await statpal_api_service.get_results(date=date)
        return {"success": True, "data": results, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues/statpal")
async def get_statpal_leagues():
    """Get available leagues from StatPal API"""
    try:
        leagues = await statpal_api_service.get_leagues()
        return {"success": True, "data": leagues}
    except Exception as e:
        logger.error(f"Error fetching StatPal leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/teams/statpal")
async def get_statpal_teams(
    league_id: Optional[int] = Query(None, description="League ID filter")
):
    """Get teams from StatPal API"""
    try:
        teams = await statpal_api_service.get_teams(league_id=league_id)
        return {"success": True, "data": teams}
    except Exception as e:
        logger.error(f"Error fetching StatPal teams: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/standings/statpal/{league_id}")
async def get_statpal_standings(league_id: int):
    """Get league standings from StatPal API"""
    try:
        standings = await statpal_api_service.get_standings(league_id)
        return {"success": True, "data": standings}
    except Exception as e:
        logger.error(f"Error fetching StatPal standings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/{match_id}/stats")
async def get_statpal_match_stats(match_id: str):
    """Get live in-depth match stats from StatPal API"""
    try:
        stats = await statpal_api_service.get_match_stats(match_id)
        return {"success": True, "data": stats, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal match stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/upcoming")
async def get_statpal_upcoming(
    league_id: Optional[int] = Query(None, description="League ID filter"),
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)")
):
    """Get upcoming match schedules from StatPal API"""
    try:
        schedules = await statpal_api_service.get_upcoming_schedules(league_id=league_id, date=date)
        return {"success": True, "data": schedules, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal upcoming schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues/statpal/{league_id}/top-scorers")
async def get_statpal_top_scorers(league_id: int):
    """Get league top scorers from StatPal API"""
    try:
        scorers = await statpal_api_service.get_top_scorers(league_id)
        return {"success": True, "data": scorers, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal top scorers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/injuries/statpal")
async def get_statpal_injuries(
    team_id: Optional[int] = Query(None, description="Team ID filter")
):
    """Get player injuries and suspensions from StatPal API"""
    try:
        injuries = await statpal_api_service.get_injuries(team_id=team_id)
        return {"success": True, "data": injuries, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal injuries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/teams/statpal/{team1_id}/vs/{team2_id}")
async def get_statpal_head_to_head(team1_id: int, team2_id: int):
    """Get head-to-head statistics between two teams from StatPal API"""
    try:
        h2h = await statpal_api_service.get_head_to_head(team1_id, team2_id)
        return {"success": True, "data": h2h, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal head-to-head: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/teams/statpal/{team_id}/stats")
async def get_statpal_team_stats(team_id: int):
    """Get detailed team statistics from StatPal API"""
    try:
        stats = await statpal_api_service.get_team_stats(team_id)
        return {"success": True, "data": stats, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal team stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/players/statpal/{player_id}/stats")
async def get_statpal_player_stats(player_id: int):
    """Get detailed player statistics from StatPal API"""
    try:
        stats = await statpal_api_service.get_player_stats(player_id)
        return {"success": True, "data": stats, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal player stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.get("/teams/statpal/{team_id}/transfers")
async def get_statpal_team_transfers(team_id: int):
    """Get team transfer history from StatPal API"""
    try:
        transfers = await statpal_api_service.get_team_transfers(team_id)
        return {"success": True, "data": transfers, "source": "statpal"}
    except Exception as e:
        logger.error(f"Error fetching StatPal team transfers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/statpal/{match_id}/odds")
async def get_statpal_match_odds(
    match_id: str,
    inplay: bool = Query(False, description="Get inplay odds instead of pre-match")
):
    """Get pre-match or inplay odds markets from StatPal API"""
    try:
        odds = await statpal_api_service.get_match_odds(match_id, inplay=inplay)
        if not odds or len(odds) == 0:
            return {
                "success": False,
                "message": "Odds data not available for this match",
                "data": {},
                "source": "statpal",
                "inplay": inplay
            }
        return {"success": True, "data": odds, "source": "statpal", "inplay": inplay}
    except Exception as e:
        logger.error(f"Error fetching StatPal match odds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/test-statpal")
async def test_statpal_api():
    """Test StatPal API connection and configuration"""
    from statpal_api import STATPAL_API_KEY
    
    api_key_configured = bool(STATPAL_API_KEY)
    api_key_length = len(STATPAL_API_KEY) if STATPAL_API_KEY else 0
    api_key_preview = STATPAL_API_KEY[:8] + "..." if STATPAL_API_KEY and len(STATPAL_API_KEY) > 8 else "N/A"
    
    # Test: Try to fetch live matches
    live_matches_test = None
    try:
        live_matches = await statpal_api_service.get_live_matches()
        live_matches_test = {
            "success": True,
            "matches_count": len(live_matches),
            "sample_matches": live_matches[:2] if live_matches else []
        }
    except Exception as e:
        live_matches_test = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    # Test: Try to fetch leagues
    leagues_test = None
    try:
        leagues = await statpal_api_service.get_leagues()
        leagues_test = {
            "success": True,
            "leagues_count": len(leagues),
            "sample_leagues": leagues[:2] if leagues else []
        }
    except Exception as e:
        leagues_test = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    return {
        "api_key_configured": api_key_configured,
        "api_key_length": api_key_length,
        "api_key_preview": api_key_preview,
        "live_matches_test": live_matches_test,
        "leagues_test": leagues_test,
        "overall_success": live_matches_test and live_matches_test.get("success")
    }


# Banner API Endpoints
@api_router.get("/banners", response_model=List[Banner])
async def get_banners(active_only: bool = Query(False, description="Return only active banners")):
    """Get all banners"""
    try:
        if not db:
            # Return empty list if MongoDB is not configured
            return []
        
        query = {"is_active": True} if active_only else {}
        banners = await db.banners.find(query, {"_id": 0}).sort("order", 1).to_list(100)
        
        # Convert ISO string dates back to datetime objects
        for banner in banners:
            if isinstance(banner.get('created_at'), str):
                banner['created_at'] = datetime.fromisoformat(banner['created_at'])
            if isinstance(banner.get('updated_at'), str):
                banner['updated_at'] = datetime.fromisoformat(banner['updated_at'])
        
        return banners
    except Exception as e:
        logger.error(f"Error fetching banners: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/banners", response_model=Banner)
async def create_banner(banner: BannerCreate):
    """Create a new banner"""
    try:
        if not db:
            raise HTTPException(status_code=503, detail="MongoDB not configured")
        
        banner_dict = banner.model_dump()
        banner_obj = Banner(**banner_dict)
        
        # Convert to dict and serialize datetime to ISO string for MongoDB
        doc = banner_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.banners.insert_one(doc)
        return banner_obj
    except Exception as e:
        logger.error(f"Error creating banner: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/banners/{banner_id}", response_model=Banner)
async def update_banner(banner_id: str, banner_update: BannerUpdate):
    """Update a banner"""
    try:
        if not db:
            raise HTTPException(status_code=503, detail="MongoDB not configured")
        
        # Get existing banner
        existing = await db.banners.find_one({"id": banner_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Banner not found")
        
        # Update fields
        update_data = {k: v for k, v in banner_update.model_dump().items() if v is not None}
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.banners.update_one({"id": banner_id}, {"$set": update_data})
        
        # Get updated banner
        updated = await db.banners.find_one({"id": banner_id}, {"_id": 0})
        
        # Convert ISO string dates back to datetime objects
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if isinstance(updated.get('updated_at'), str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        
        return Banner(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating banner: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str):
    """Delete a banner"""
    try:
        if not db:
            raise HTTPException(status_code=503, detail="MongoDB not configured")
        
        result = await db.banners.delete_one({"id": banner_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Banner not found")
        
        return {"success": True, "message": "Banner deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting banner: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# CORS Configuration
cors_origins_str = os.environ.get('CORS_ORIGINS', '*')
# Clean up CORS origins - remove empty strings and strip whitespace
cors_origins = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]

logger.info(f"CORS Origins configured: {cors_origins}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins if cors_origins != ['*'] else ['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging already configured above

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()