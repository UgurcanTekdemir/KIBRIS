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
from statpal_api import statpal_service


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
    league: Optional[str] = Query(None, description="League name or ID filter"),
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get all matches (live + daily + fixtures)"""
    try:
        matches = await statpal_service.get_matches(
            date=date,
            league=league
        )
        
        # Filter by country if provided
        if country:
            matches = [m for m in matches if 
                     country.lower() in m.get("country", "").lower()]
        
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/live")
async def get_live_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """
    Get live matches (matches currently in progress).
    
    Uses StatPal API to get live soccer matches with scores and statistics.
    """
    try:
        # Get live matches from StatPal API
        live_matches = await statpal_service.get_live_matches()
        
        if not live_matches:
            # If no live matches found, return empty list
            return {"success": True, "data": [], "is_live": False}
        
        return {"success": True, "data": live_matches, "is_live": True}
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed information for a specific match"""
    try:
        # Try new get_match_details first, fallback to get_match_by_id
        match_data = await statpal_service.get_match_details(match_id)
        if not match_data:
            # Fallback to old method
            match_data = await statpal_service.get_match_by_id(match_id)
        if not match_data:
            raise HTTPException(status_code=404, detail="Match not found")
        return {"success": True, "data": match_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/details")
async def get_match_details_endpoint(match_id: str):
    """Get detailed information for a specific match"""
    try:
        match_data = await statpal_service.get_match_details(match_id)
        if not match_data:
            raise HTTPException(status_code=404, detail="Match not found")
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
        lineups = await statpal_service.get_match_lineups(match_id)
        if lineups is None:
            raise HTTPException(status_code=404, detail="Match lineups not found")
        return {"success": True, "data": lineups}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match lineups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/events")
async def get_match_events(match_id: str):
    """Get match events (goals, cards, substitutions)"""
    try:
        events = await statpal_service.get_match_events(match_id)
        return {"success": True, "data": events}
    except Exception as e:
        logger.error(f"Error fetching match events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/statistics")
async def get_match_statistics(match_id: str):
    """Get match statistics (possession, shots, etc.)"""
    try:
        statistics = await statpal_service.get_match_statistics(match_id)
        if statistics is None:
            raise HTTPException(status_code=404, detail="Match statistics not found")
        return {"success": True, "data": statistics}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}/odds")
async def get_match_odds(match_id: str):
    """Get odds for a specific match"""
    try:
        # Get live odds map
        live_odds_map = await statpal_service.get_live_odds()
        
        if match_id in live_odds_map:
            return {"success": True, "data": live_odds_map[match_id]}
        else:
            # Return empty if no odds available
            return {"success": True, "data": []}
    except Exception as e:
        logger.error(f"Error fetching match odds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/images/team/{team_name}")
async def get_team_logo(team_name: str):
    """Get team logo URL from StatPal Images API"""
    try:
        logo_url = await statpal_service.get_team_logo(team_name)
        if logo_url:
            return {"success": True, "data": {"logo_url": logo_url}}
        else:
            return {"success": False, "data": None, "message": "Logo not found"}
    except Exception as e:
        logger.error(f"Error fetching team logo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues/{league_id}/matches")
async def get_league_matches(
    league_id: str,
    season: Optional[str] = Query(None, description="Season filter (e.g., 2025/2026)")
):
    """Get all matches for a specific league"""
    try:
        matches = await statpal_service.get_league_matches(league_id, season=season)
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching league matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/popular")
async def get_popular_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """Get popular matches (prioritized live matches)"""
    try:
        matches = await statpal_service.get_popular_matches(limit=20)
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching popular matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues")
async def get_leagues(
    match_type: int = Query(1, description="Match type"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get available leagues from StatPal API"""
    try:
        leagues = await statpal_service.get_available_leagues()
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
    """Get available countries from StatPal API leagues"""
    try:
        countries = await statpal_service.get_available_countries()
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging already configured above

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()