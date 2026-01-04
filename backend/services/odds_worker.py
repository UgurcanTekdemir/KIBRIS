"""
Background worker for fetching latest odds updates from SportMonks.
Polls latest odds endpoints at regular intervals and saves to Firebase.
"""
import asyncio
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

from services.sportmonks_service import sportmonks_service
from services.firebase_service import save_odds_snapshot

logger = logging.getLogger(__name__)

# Bookmaker ID for Bet365
BOOKMAKER_BET365_ID = 2

# Worker control
_worker_running = False
_worker_tasks = []


def filter_bet365_odds(odds_data: Any, fixture_id: int = None) -> List[Dict[str, Any]]:
    """
    Filter odds data to only include Bet365 (bookmaker_id=2) odds.
    
    Args:
        odds_data: Raw odds data from SportMonks API
        fixture_id: Optional fixture ID for logging
        
    Returns:
        List of filtered odds entries (Bet365 only)
    """
    filtered_odds = []
    
    # Handle different response formats
    if isinstance(odds_data, dict):
        # Check if it's a nested structure
        if "data" in odds_data:
            odds_list = odds_data["data"]
        else:
            # Try to extract from common keys
            odds_list = []
            for key, value in odds_data.items():
                if isinstance(value, list):
                    odds_list.extend(value)
                elif isinstance(value, dict) and "data" in value:
                    odds_list.extend(value["data"])
    elif isinstance(odds_data, list):
        odds_list = odds_data
    else:
        logger.warning(f"Unexpected odds_data format for fixture {fixture_id}: {type(odds_data)}")
        return filtered_odds
    
    # Filter by bookmaker_id = 2 (Bet365)
    for odd_item in odds_list:
        if not isinstance(odd_item, dict):
            continue
        
        # Extract bookmaker_id from various possible locations
        bookmaker_id = None
        
        # Try bookmaker_id directly
        if "bookmaker_id" in odd_item:
            bookmaker_id = odd_item["bookmaker_id"]
        # Try nested bookmaker object
        elif "bookmaker" in odd_item:
            bookmaker = odd_item["bookmaker"]
            if isinstance(bookmaker, dict):
                if "data" in bookmaker:
                    bookmaker_id = bookmaker["data"].get("id")
                else:
                    bookmaker_id = bookmaker.get("id")
        
        # Only include Bet365 odds
        if bookmaker_id == BOOKMAKER_BET365_ID:
            filtered_odds.append(odd_item)
    
    return filtered_odds


async def process_latest_odds(odds_items: List[Dict[str, Any]], is_live: bool = False) -> int:
    """
    Process latest odds items and save to Firebase.
    
    Args:
        odds_items: List of odds items from latest endpoint
        is_live: Whether these are in-play odds
        
    Returns:
        Number of snapshots saved
    """
    saved_count = 0
    
    for item in odds_items:
        if not isinstance(item, dict):
            continue
        
        # Extract fixture_id
        fixture_id = item.get("fixture_id") or item.get("id")
        if not fixture_id:
            logger.warning(f"Skipping odds item without fixture_id: {item.keys()}")
            continue
        
        # Extract odds data
        odds_data = item.get("odds") or item.get("odds_data") or item
        
        # Filter for Bet365 only
        filtered_odds = filter_bet365_odds(odds_data, fixture_id=fixture_id)
        
        if not filtered_odds:
            logger.debug(f"No Bet365 odds found for fixture {fixture_id} (live: {is_live})")
            continue
        
        # Save to Firebase
        success = await save_odds_snapshot(
            fixture_id=fixture_id,
            odds_data=filtered_odds,
            is_live=is_live
        )
        
        if success:
            saved_count += 1
            logger.debug(f"Saved odds snapshot for fixture {fixture_id} (live: {is_live}, count: {len(filtered_odds)})")
        else:
            logger.warning(f"Failed to save odds snapshot for fixture {fixture_id}")
    
    return saved_count


async def inplay_odds_loop():
    """Loop for fetching in-play latest odds every 5 seconds."""
    logger.info("In-play odds worker loop started (5 second interval)")
    
    consecutive_errors = 0
    max_consecutive_errors = 10
    
    while _worker_running:
        try:
            # Fetch latest in-play odds
            latest_odds = await sportmonks_service.get_latest_odds_inplay()
            
            if latest_odds:
                saved_count = await process_latest_odds(latest_odds, is_live=True)
                if saved_count > 0:
                    logger.info(f"In-play odds: Processed {len(latest_odds)} items, saved {saved_count} snapshots")
                    consecutive_errors = 0
                else:
                    logger.debug(f"In-play odds: No Bet365 odds found in {len(latest_odds)} items")
            else:
                logger.debug("In-play odds: No updates available")
            
            # Wait 5 seconds before next iteration
            await asyncio.sleep(5)
            
        except Exception as e:
            consecutive_errors += 1
            logger.error(f"Error in in-play odds loop (error #{consecutive_errors}): {e}")
            
            if consecutive_errors >= max_consecutive_errors:
                logger.error(f"In-play odds worker stopped after {max_consecutive_errors} consecutive errors")
                break
            
            # Wait before retry (with exponential backoff)
            wait_time = min(5 * (2 ** min(consecutive_errors - 1, 4)), 60)
            await asyncio.sleep(wait_time)
    
    logger.info("In-play odds worker loop stopped")


async def prematch_odds_loop():
    """Loop for fetching pre-match latest odds every 15-30 seconds (using 20 seconds as average)."""
    logger.info("Pre-match odds worker loop started (20 second interval)")
    
    consecutive_errors = 0
    max_consecutive_errors = 10
    
    while _worker_running:
        try:
            # Fetch latest pre-match odds
            latest_odds = await sportmonks_service.get_latest_odds_prematch()
            
            if latest_odds:
                saved_count = await process_latest_odds(latest_odds, is_live=False)
                if saved_count > 0:
                    logger.info(f"Pre-match odds: Processed {len(latest_odds)} items, saved {saved_count} snapshots")
                    consecutive_errors = 0
                else:
                    logger.debug(f"Pre-match odds: No Bet365 odds found in {len(latest_odds)} items")
            else:
                logger.debug("Pre-match odds: No updates available")
            
            # Wait 20 seconds before next iteration (average of 15-30)
            await asyncio.sleep(20)
            
        except Exception as e:
            consecutive_errors += 1
            logger.error(f"Error in pre-match odds loop (error #{consecutive_errors}): {e}")
            
            if consecutive_errors >= max_consecutive_errors:
                logger.error(f"Pre-match odds worker stopped after {max_consecutive_errors} consecutive errors")
                break
            
            # Wait before retry (with exponential backoff)
            wait_time = min(20 * (2 ** min(consecutive_errors - 1, 4)), 120)
            await asyncio.sleep(wait_time)
    
    logger.info("Pre-match odds worker loop stopped")


async def start_odds_worker():
    """Start the odds worker background tasks."""
    global _worker_running, _worker_tasks
    
    if _worker_running:
        logger.warning("Odds worker is already running")
        return
    
    _worker_running = True
    logger.info("Starting odds worker background tasks...")
    
    # Start in-play loop (5 seconds)
    inplay_task = asyncio.create_task(inplay_odds_loop())
    _worker_tasks.append(inplay_task)
    
    # Start pre-match loop (20 seconds)
    prematch_task = asyncio.create_task(prematch_odds_loop())
    _worker_tasks.append(prematch_task)
    
    logger.info("Odds worker started successfully")


async def stop_odds_worker():
    """Stop the odds worker background tasks."""
    global _worker_running, _worker_tasks
    
    if not _worker_running:
        return
    
    logger.info("Stopping odds worker...")
    _worker_running = False
    
    # Cancel all tasks
    for task in _worker_tasks:
        if not task.done():
            task.cancel()
    
    # Wait for tasks to complete
    if _worker_tasks:
        await asyncio.gather(*_worker_tasks, return_exceptions=True)
    
    _worker_tasks = []
    logger.info("Odds worker stopped")

