from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


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
