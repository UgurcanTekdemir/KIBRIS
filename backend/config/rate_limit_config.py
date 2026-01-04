"""
Rate Limit Configuration for SportMonks API
Entity-based rate limit settings and cache TTL policies
"""
from typing import Dict, Optional
from dataclasses import dataclass

# SportMonks Advanced Plan: 3000 requests per hour per entity
RATE_LIMIT_CAPACITY = 3000  # requests per hour per entity
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds

# Degrade mode threshold: when remaining < this, enter degrade mode
DEGRADE_THRESHOLD = 200  # requests remaining

# Entity definitions
ENTITY_FIXTURES = "fixtures"
ENTITY_LIVESCORES = "livescores"
ENTITY_ODDS = "odds"
ENTITY_MARKETS = "markets"
ENTITY_TEAMS = "teams"
ENTITY_LEAGUES = "leagues"
ENTITY_STATES = "states"
ENTITY_TYPES = "types"
ENTITY_COUNTRIES = "countries"
ENTITY_VENUES = "venues"
ENTITY_SEASONS = "seasons"
ENTITY_STANDINGS = "standings"
ENTITY_PLAYERS = "players"
ENTITY_LINEUPS = "lineups"
ENTITY_EVENTS = "events"
ENTITY_STATISTICS = "statistics"
ENTITY_SIDELINED = "sidelined"

# All known entities
ALL_ENTITIES = [
    ENTITY_FIXTURES,
    ENTITY_LIVESCORES,
    ENTITY_ODDS,
    ENTITY_MARKETS,
    ENTITY_TEAMS,
    ENTITY_LEAGUES,
    ENTITY_STATES,
    ENTITY_TYPES,
    ENTITY_COUNTRIES,
    ENTITY_VENUES,
    ENTITY_SEASONS,
    ENTITY_STANDINGS,
    ENTITY_PLAYERS,
    ENTITY_LINEUPS,
    ENTITY_EVENTS,
    ENTITY_STATISTICS,
    ENTITY_SIDELINED,
]

@dataclass
class EntityCacheConfig:
    """Cache TTL configuration per entity type"""
    ttl_seconds: int
    is_static: bool = False  # Static entities rarely change (teams, leagues, etc.)

# Cache TTL configuration per entity
# Static entities: 6-24 hours (rarely change)
# Fixtures (upcoming): 1-5 minutes
# Live: 3-5 seconds
# Odds live: 3-5 seconds
ENTITY_CACHE_TTL: Dict[str, EntityCacheConfig] = {
    # Static entities (rarely change)
    ENTITY_TEAMS: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_LEAGUES: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_MARKETS: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_STATES: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_TYPES: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_COUNTRIES: EntityCacheConfig(ttl_seconds=24 * 60 * 60, is_static=True),  # 24 hours
    ENTITY_VENUES: EntityCacheConfig(ttl_seconds=12 * 60 * 60, is_static=True),  # 12 hours
    ENTITY_SEASONS: EntityCacheConfig(ttl_seconds=12 * 60 * 60, is_static=True),  # 12 hours
    ENTITY_PLAYERS: EntityCacheConfig(ttl_seconds=6 * 60 * 60, is_static=True),  # 6 hours
    
    # Semi-static entities
    ENTITY_STANDINGS: EntityCacheConfig(ttl_seconds=5 * 60),  # 5 minutes
    ENTITY_SIDELINED: EntityCacheConfig(ttl_seconds=10 * 60),  # 10 minutes
    
    # Dynamic entities (upcoming fixtures)
    ENTITY_FIXTURES: EntityCacheConfig(ttl_seconds=3 * 60),  # 3 minutes for upcoming
    
    # Live entities (very dynamic)
    ENTITY_LIVESCORES: EntityCacheConfig(ttl_seconds=4),  # 4 seconds
    ENTITY_ODDS: EntityCacheConfig(ttl_seconds=4),  # 4 seconds
    ENTITY_LINEUPS: EntityCacheConfig(ttl_seconds=60),  # 1 minute
    ENTITY_EVENTS: EntityCacheConfig(ttl_seconds=4),  # 4 seconds
    ENTITY_STATISTICS: EntityCacheConfig(ttl_seconds=4),  # 4 seconds
}

# Backoff configuration for 429 handling
BACKOFF_CONFIG = {
    "base_delay": 1.0,  # Base delay in seconds
    "max_delay": 300.0,  # Maximum delay (5 minutes)
    "exponential_base": 2.0,  # Exponential backoff base
    "jitter_max": 0.3,  # Max jitter (30% of delay)
}

# Observability thresholds
OBSERVABILITY_THRESHOLDS = {
    "low_remaining_warning": 500,  # Warn when remaining < 500
    "critical_remaining_warning": 200,  # Critical warning when remaining < 200
    "high_429_rate": 10,  # Warn if 429 count > 10 in last minute
    "cache_hit_rate_warning": 0.5,  # Warn if cache hit rate < 50%
}

def get_entity_from_path(path: str) -> str:
    """
    Extract entity type from API path.
    
    Examples:
        fixtures/123 -> fixtures
        fixtures/date/2024-01-01 -> fixtures
        livescores -> livescores
        odds/fixtures/123 -> odds
        teams/123 -> teams
    """
    path = path.strip("/")
    if not path:
        return ENTITY_FIXTURES  # Default
    
    parts = path.split("/")
    first_part = parts[0].lower()
    
    # Map common paths to entities
    entity_map = {
        "fixtures": ENTITY_FIXTURES,
        "livescores": ENTITY_LIVESCORES,
        "odds": ENTITY_ODDS,
        "markets": ENTITY_MARKETS,
        "teams": ENTITY_TEAMS,
        "leagues": ENTITY_LEAGUES,
        "states": ENTITY_STATES,
        "types": ENTITY_TYPES,
        "countries": ENTITY_COUNTRIES,
        "venues": ENTITY_VENUES,
        "seasons": ENTITY_SEASONS,
        "standings": ENTITY_STANDINGS,
        "players": ENTITY_PLAYERS,
        "lineups": ENTITY_LINEUPS,
        "events": ENTITY_EVENTS,
        "statistics": ENTITY_STATISTICS,
        "sidelined": ENTITY_SIDELINED,
    }
    
    return entity_map.get(first_part, ENTITY_FIXTURES)  # Default to fixtures

def get_cache_ttl(entity: str) -> int:
    """Get cache TTL for entity in seconds"""
    config = ENTITY_CACHE_TTL.get(entity)
    if config:
        return config.ttl_seconds
    return 60  # Default 1 minute

