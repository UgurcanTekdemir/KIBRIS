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
    league: Optional[str] = Query(None, description="League name filter"),
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD)"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get betting program matches"""
    try:
        # Use The Odds API service instead of NosyAPI
        matches = await the_odds_service.get_matches()
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
    
    Note: Requires a paid The Odds API plan. Free plan doesn't provide live scores.
    With paid plan, this uses the Scores API to get live matches with scores.
    """
    try:
        # Try to get live matches with scores (requires paid plan)
        live_matches = await the_odds_service.get_live_matches()
        
        if not live_matches:
            # If no live matches found (could be free plan or no live matches at the moment)
            # Return upcoming matches sorted by commence_time as fallback
            all_matches = await the_odds_service.get_matches()
            sorted_matches = sorted(all_matches, key=lambda m: m.get('commence_time', ''))
            return {"success": True, "data": sorted_matches[:20], "is_live": False}
        
        return {"success": True, "data": live_matches, "is_live": True}
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        # Fallback to upcoming matches if Scores API fails (free plan)
        try:
            all_matches = await the_odds_service.get_matches()
            sorted_matches = sorted(all_matches, key=lambda m: m.get('commence_time', ''))
            return {"success": True, "data": sorted_matches[:20], "is_live": False}
        except Exception as fallback_error:
            logger.error(f"Fallback also failed: {fallback_error}")
            raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed information for a specific match"""
    try:
        match_data = await the_odds_service.get_match_by_id(match_id)
        if not match_data:
            raise HTTPException(status_code=404, detail="Match not found")
        return {"success": True, "data": match_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details: {e}")
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