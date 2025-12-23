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
        api_response = await nosy_api_service.get_matches(
            match_type=match_type,
            league=league,
            date=date,
            country=country
        )
        # NosyAPI returns data in 'data' field
        matches = api_response.get('data', []) if isinstance(api_response, dict) else api_response
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/live")
async def get_live_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """Get live matches (matches currently in progress)"""
    try:
        # Get matches for today and filter live ones
        today = datetime.now().strftime("%Y-%m-%d")
        api_response = await nosy_api_service.get_matches(match_type=match_type, date=today)
        
        # NosyAPI returns data in 'data' field
        all_matches = api_response.get('data', []) if isinstance(api_response, dict) else api_response
        
        # Filter live matches: LiveStatus must be 1 AND Result must not be 0 (match has actually started)
        live_matches = [
            m for m in all_matches 
            if m.get('LiveStatus') == 1 
            and m.get('Result') 
            and m.get('Result') != 0 
            and m.get('Result') != '0'
            and '-' in str(m.get('Result', ''))
        ]
        
        return {"success": True, "data": live_matches}
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/{match_id}")
async def get_match_details(match_id: str):
    """Get detailed information for a specific match"""
    try:
        api_response = await nosy_api_service.get_match_details(match_id)
        # NosyAPI returns data in 'data' field as an array with one match
        if isinstance(api_response, dict) and 'data' in api_response:
            match_data = api_response['data'][0] if api_response['data'] else None
            if not match_data:
                raise HTTPException(status_code=404, detail="Match not found")
            return {"success": True, "data": match_data}
        # Fallback if response structure is different
        return {"success": True, "data": api_response}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/matches/popular")
async def get_popular_matches(
    match_type: int = Query(1, description="Match type (1=Futbol, 2=Basketbol, etc.)")
):
    """Get popular matches"""
    try:
        matches = await nosy_api_service.get_popular_matches(match_type=match_type)
        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"Error fetching popular matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/leagues")
async def get_leagues(
    match_type: int = Query(1, description="Match type"),
    country: Optional[str] = Query(None, description="Country filter")
):
    """Get available leagues"""
    try:
        leagues = await nosy_api_service.get_leagues(match_type=match_type, country=country)
        return {"success": True, "data": leagues}
    except Exception as e:
        logger.error(f"Error fetching leagues: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/countries")
async def get_countries(
    match_type: int = Query(1, description="Match type")
):
    """Get available countries"""
    try:
        countries = await nosy_api_service.get_countries(match_type=match_type)
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