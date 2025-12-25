"""
Coupon Settlement Service
Automatically settles coupons based on match results from StatPal API

Note: This service requires Firebase Admin SDK to be initialized in the main server file.
The coupon settlement is handled via frontend service for now, this is a placeholder.
"""
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Note: Firebase Admin SDK initialization should be done in server.py
# For now, this is a placeholder - actual settlement can be triggered from frontend

COMMISSION_RATE = 0.20  # 20% commission


async def check_and_settle_coupons():
    """
    Check pending coupons and settle them based on match results.
    This should be called periodically (via cron or scheduled job).
    
    Note: This is a placeholder. Actual settlement should be handled via frontend
    coupon service (couponService.js) which has full Firebase integration.
    """
    logger.info("Coupon settlement check - This is a placeholder function")
    logger.info("Actual settlement is handled via frontend couponService.js")
    return 0


async def _check_coupon_selections(coupon: Dict[str, Any]) -> bool:
    """
    Check if all selections in a coupon are won or lost.
    Returns:
        True if all selections won
        False if any selection lost
        None if not all matches are finished yet
    """
    from statpal_api import statpal_service
    
    selections = coupon.get('selections', [])
    if not selections:
        return False
    
    results = []
    for selection in selections:
        match_id = selection.get('matchId')
        if not match_id:
            continue
        
        try:
            # Get match details from StatPal API
            match_data = await statpal_service.get_match_details(match_id)
            
            if not match_data:
                # Match not found, can't settle yet
                return None
            
            # Check if match is finished
            status = (match_data.get('status') || '').upper()
            if status not in ['FT', 'FINISHED', 'CANCELED', 'CANCELLED']:
                # Match not finished yet
                return None
            
            # Check if selection won
            is_won = _check_selection_result(selection, match_data)
            results.append(is_won)
        except Exception as e:
            logger.error(f"Error checking selection {match_id}: {e}")
            # If we can't check, assume not settled yet
            return None
    
    # If all matches are finished, return True if all won, False otherwise
    if len(results) == len(selections):
        return all(results)
    
    return None


def _check_selection_result(selection: Dict[str, Any], match_data: Dict[str, Any]) -> bool:
    """
    Check if a selection won based on match result.
    """
    market_name = selection.get('marketName', '').lower()
    option = selection.get('option', '').upper()
    
    home_team = match_data.get('home_team', '')
    away_team = match_data.get('away_team', '')
    
    # Get scores
    scores = match_data.get('scores', [])
    home_score = 0
    away_score = 0
    
    for score in scores:
        if isinstance(score, dict):
            name = score.get('name', '').lower()
            score_value = score.get('score', 0)
            if home_team.lower() in name or name in home_team.lower():
                home_score = score_value
            elif away_team.lower() in name or name in away_team.lower():
                away_score = score_value
    
    # Check market type and result
    if 'maç sonucu' in market_name or 'match result' in market_name:
        # 1X2 market
        if option == '1':
            return home_score > away_score
        elif option == 'X' or option == 'BERABERLIK':
            return home_score == away_score
        elif option == '2':
            return away_score > home_score
    
    # Add more market types as needed
    # For now, return False for unknown markets (conservative)
    return False


# Note: Actual settlement functions are in frontend/src/services/couponService.js
# These placeholder functions are kept for reference
COMMISSION_RATE = 0.20  # 20% commission

