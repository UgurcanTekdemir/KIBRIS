"""
Firebase Admin SDK service for backend operations.
Handles Firestore operations for odds snapshots.
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    firebase_admin = None
    firestore = None

logger = logging.getLogger(__name__)

# Firebase app instance (singleton)
_firebase_app = None
_db = None


def initialize_firebase() -> bool:
    """Initialize Firebase Admin SDK."""
    global _firebase_app, _db
    
    if _firebase_app is not None:
        return True
    
    if firebase_admin is None:
        logger.warning("firebase-admin package not installed. Firebase operations will be disabled.")
        return False
    
    try:
        # Try to get service account key from environment variable or file
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        
        if service_account_path and os.path.exists(service_account_path):
            # Use service account file path
            cred = credentials.Certificate(service_account_path)
        else:
            # Try default location (project root)
            # Path resolution: services/firebase_service.py -> backend -> project_root
            services_dir = Path(__file__).parent  # services/
            backend_dir = services_dir.parent  # backend/
            root_dir = backend_dir.parent  # project root
            
            default_paths = [
                root_dir / "firebase-service-account-key.json",
                backend_dir / "firebase-service-account-key.json",
                Path("/Users/uggrcn/kıbrıs 2.2/KIBRIS/firebase-service-account-key.json")  # Absolute path fallback
            ]
            
            default_path = None
            for path in default_paths:
                if path.exists():
                    default_path = path
                    logger.info(f"Found Firebase service account key at: {path}")
                    break
            
            if default_path:
                cred = credentials.Certificate(str(default_path))
            else:
                # Try to get from environment variable as JSON string
                service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
                if service_account_json:
                    cred = credentials.Certificate(json.loads(service_account_json))
                else:
                    logger.warning("Firebase service account key not found. Firebase operations will be disabled.")
                    return False
        
        _firebase_app = firebase_admin.initialize_app(cred)
        _db = firestore.client()
        logger.info("Firebase Admin SDK initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return False


def get_firestore_db():
    """Get Firestore database instance."""
    global _db
    
    if _db is None:
        if not initialize_firebase():
            return None
    
    return _db


async def save_odds_snapshot(fixture_id: int, odds_data: Any, is_live: bool = False) -> bool:
    """
    Save odds snapshot to Firestore.
    
    Args:
        fixture_id: Match/fixture ID
        odds_data: Odds data (already filtered for Bet365)
        is_live: Whether the match is live (in-play)
        
    Returns:
        True if successful, False otherwise
    """
    db = get_firestore_db()
    if not db:
        logger.warning("Firestore not available. Skipping odds snapshot save.")
        return False
    
    try:
        from datetime import datetime, timezone
        
        # Collection path: odds_snapshots/{fixture_id}/snapshots/{timestamp}
        collection_ref = db.collection("odds_snapshots").document(str(fixture_id))
        
        # Create snapshot document
        snapshot_data = {
            "fixture_id": fixture_id,
            "odds": odds_data,
            "is_live": is_live,
            "timestamp": datetime.now(timezone.utc),
            "bookmaker_id": 2,  # Bet365
            "bookmaker_name": "Bet365"
        }
        
        # Save to subcollection with timestamp as document ID
        snapshot_ref = collection_ref.collection("snapshots").document()
        snapshot_ref.set(snapshot_data)
        
        # Also update the latest snapshot reference
        collection_ref.set({
            "latest_snapshot_id": snapshot_ref.id,
            "last_updated": datetime.now(timezone.utc),
            "fixture_id": fixture_id,
            "is_live": is_live
        }, merge=True)
        
        logger.debug(f"Saved odds snapshot for fixture {fixture_id} (live: {is_live})")
        return True
    except Exception as e:
        logger.error(f"Error saving odds snapshot for fixture {fixture_id}: {e}")
        return False


async def get_latest_odds_snapshot(fixture_id: int) -> Optional[Dict[str, Any]]:
    """
    Get the latest odds snapshot from Firestore.
    
    Args:
        fixture_id: Match/fixture ID
        
    Returns:
        Latest odds snapshot data or None
    """
    db = get_firestore_db()
    if not db:
        return None
    
    try:
        collection_ref = db.collection("odds_snapshots").document(str(fixture_id))
        doc = collection_ref.get()
        
        if not doc.exists:
            return None
        
        data = doc.to_dict()
        latest_snapshot_id = data.get("latest_snapshot_id")
        
        if not latest_snapshot_id:
            return None
        
        snapshot_ref = collection_ref.collection("snapshots").document(latest_snapshot_id)
        snapshot_doc = snapshot_ref.get()
        
        if snapshot_doc.exists:
            return snapshot_doc.to_dict()
        
        return None
    except Exception as e:
        logger.error(f"Error getting latest odds snapshot for fixture {fixture_id}: {e}")
        return None

