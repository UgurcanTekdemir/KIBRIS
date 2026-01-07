import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBetSlip } from '../context/BetSlipContext';
import { ArrowLeft, Clock, TrendingUp, AlertCircle, Filter, Activity, Target, ArrowUp, ArrowDown, Users, Heart, Trophy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMatchDetails } from '../hooks/useMatches';
import { useLiveMatchEvents } from '../hooks/useLiveMatchEvents';
import { useLiveMatchStatistics } from '../hooks/useLiveMatchStatistics';
import { useOddsTracking } from '../hooks/useOddsTracking';
import { useMatchLineups } from '../hooks/useMatchLineups';
import { useLeagueStandings } from '../hooks/useLeagueStandings';
import { matchAPI } from '../services/api';
import * as footballService from '../services/football';
import { useQuery } from '@tanstack/react-query';
import { groupMarketsByCategory, getCategoryOrder, getMarketCategory } from '../utils/marketCategories';
import { translateMarketName, translateOptionLabel, mapApiMatchToInternal } from '../utils/matchMapper';
import { getTeamImagePath, getFallbackIcon } from '../utils/imageUtils';
import { formatMatchDateTime } from '../utils/dateUtils';

/**
 * Translate position from English to Turkish
 * @param {string} position - Position in English
 * @returns {string} Position in Turkish
 */
function translatePosition(position) {
  if (!position) return '';
  
  const positionLower = position.toLowerCase().trim();
  
  const positionMap = {
    'goalkeeper': 'Kaleci',
    'defender': 'Defans',
    'midfielder': 'Orta Saha',
    'attacker': 'Forvet',
    'forward': 'Forvet',
    'striker': 'Forvet',
    'winger': 'Kanat',
    'left winger': 'Sol Kanat',
    'right winger': 'Sağ Kanat',
    'left back': 'Sol Bek',
    'right back': 'Sağ Bek',
    'center back': 'Stoper',
    'central defender': 'Stoper',
    'defensive midfielder': 'Defansif Orta Saha',
    'central midfielder': 'Orta Saha',
    'attacking midfielder': 'Ofansif Orta Saha',
    'left midfielder': 'Sol Orta Saha',
    'right midfielder': 'Sağ Orta Saha',
    'center forward': 'Santrafor',
    'left forward': 'Sol Forvet',
    'right forward': 'Sağ Forvet',
  };
  
  // Direct match
  if (positionMap[positionLower]) {
    return positionMap[positionLower];
  }
  
  // Partial match
  if (positionLower.includes('goalkeeper') || positionLower.includes('keeper')) {
    return 'Kaleci';
  }
  if (positionLower.includes('defender') || positionLower.includes('defence') || positionLower.includes('back')) {
    if (positionLower.includes('left')) return 'Sol Bek';
    if (positionLower.includes('right')) return 'Sağ Bek';
    if (positionLower.includes('center') || positionLower.includes('central')) return 'Stoper';
    return 'Defans';
  }
  if (positionLower.includes('midfielder') || positionLower.includes('midfield')) {
    if (positionLower.includes('defensive')) return 'Defansif Orta Saha';
    if (positionLower.includes('attacking') || positionLower.includes('offensive')) return 'Ofansif Orta Saha';
    if (positionLower.includes('left')) return 'Sol Orta Saha';
    if (positionLower.includes('right')) return 'Sağ Orta Saha';
    if (positionLower.includes('center') || positionLower.includes('central')) return 'Orta Saha';
    return 'Orta Saha';
  }
  if (positionLower.includes('attacker') || positionLower.includes('forward') || positionLower.includes('striker')) {
    if (positionLower.includes('left')) return 'Sol Forvet';
    if (positionLower.includes('right')) return 'Sağ Forvet';
    if (positionLower.includes('center') || positionLower.includes('central')) return 'Santrafor';
    if (positionLower.includes('winger')) return 'Kanat';
    return 'Forvet';
  }
  if (positionLower.includes('winger')) {
    if (positionLower.includes('left')) return 'Sol Kanat';
    if (positionLower.includes('right')) return 'Sağ Kanat';
    return 'Kanat';
  }
  
  // Return original if no match found
  return position;
}

/**
 * Sort market options in a logical order
 * @param {Array} options - Array of option objects with label and value
 * @param {string} marketName - Name of the market
 * @returns {Array} Sorted options array
 */
function sortMarketOptions(options, marketName) {
  if (!options || !Array.isArray(options)) return options;
  
  const marketNameLower = (marketName || '').toLowerCase();
  
  // For 1X2 / Match Result markets, sort as 1, X, 2
  if (
    marketNameLower.includes('maç sonucu') ||
    marketNameLower.includes('match result') ||
    marketNameLower.includes('1x2') ||
    marketNameLower.includes('1-x-2')
  ) {
    return [...options].sort((a, b) => {
      const order = { '1': 1, 'X': 2, '2': 3, 'Beraberlik': 2, 'Home': 1, 'Draw': 2, 'Away': 3 };
      const labelA = (a.label || '').trim();
      const labelB = (b.label || '').trim();
      const orderA = order[labelA] || order[labelA.toLowerCase()] || 999;
      const orderB = order[labelB] || order[labelB.toLowerCase()] || 999;
      return orderA - orderB;
    });
  }
  
  // For Over/Under markets, sort as Under first, then Over
  if (
    marketNameLower.includes('alt') ||
    marketNameLower.includes('üst') ||
    marketNameLower.includes('over') ||
    marketNameLower.includes('under')
  ) {
    return [...options].sort((a, b) => {
      const labelA = (a.label || '').toLowerCase();
      const labelB = (b.label || '').toLowerCase();
      const aIsUnder = labelA.includes('alt') || labelA.includes('under');
      const bIsUnder = labelB.includes('alt') || labelB.includes('under');
      if (aIsUnder && !bIsUnder) return -1;
      if (!aIsUnder && bIsUnder) return 1;
      // If both same type, sort by odds value (ascending)
      const valueA = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
      const valueB = typeof b.value === 'number' ? b.value : parseFloat(b.value) || 0;
      return valueA - valueB;
    });
  }
  
  // For Double Chance markets, sort as 1X, 12, X2
  if (
    marketNameLower.includes('çift şans') ||
    marketNameLower.includes('double chance')
  ) {
    return [...options].sort((a, b) => {
      const order = { '1X': 1, '12': 2, 'X2': 3, '1x': 1, 'x2': 3 };
      const labelA = (a.label || '').trim();
      const labelB = (b.label || '').trim();
      const orderA = order[labelA] || order[labelA.toUpperCase()] || 999;
      const orderB = order[labelB] || order[labelB.toUpperCase()] || 999;
      return orderA - orderB;
    });
  }
  
  // Default: sort by odds value (ascending) for better UX
  return [...options].sort((a, b) => {
    const valueA = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
    const valueB = typeof b.value === 'number' ? b.value : parseFloat(b.value) || 0;
    return valueA - valueB;
  });
}

/**
 * Transform Sportmonks V3 statistics array to component format
 * @param {Array} statsArray - Statistics array from Sportmonks V3
 * @param {number} homeTeamId - Home team participant ID
 * @param {number} awayTeamId - Away team participant ID
 * @returns {Object} Transformed statistics object
 */
function transformSportmonksStatistics(statsArray, homeTeamId, awayTeamId) {
  if (!Array.isArray(statsArray) || statsArray.length === 0) {
    return null;
  }
  
  const result = {
    possession: null,
    shots: null,
    shotsOnTarget: null,
    corners: null,
    attacks: null,
    yellowCards: null,
    redCards: null,
    offsides: null,
    fouls: null,
    saves: null,
    passes: null,
    passAccuracy: null,
  };
  
  // Group statistics by participant_id
  const homeStats = {};
  const awayStats = {};
  
  // Developer name to stat name mapping (from Sportmonks API)
  const developerNameToStatName = {
    // Possession
    'BALL_POSSESSION': 'ball possession',
    // Shots
    'SHOTS_TOTAL': 'total shots',
    'SHOTS_ON_TARGET': 'shots on target',
    'SHOTS_ON_GOAL': 'shots on goal',
    'SHOTS_OFF_TARGET': 'shots off goal',
    'SHOTS_INSIDEBOX': 'shots insidebox',
    'SHOTS_OUTSIDEBOX': 'shots outsidebox',
    'SHOTS_BLOCKED': 'shots blocked',
    'GOAL_ATTEMPTS': 'goal attempts',
    'HIT_WOODWORK': 'hit woodwork',
    // Corners
    'CORNER_KICKS': 'corner kicks',
    // Attacks
    'ATTACKS': 'attacks',
    'DANGEROUS_ATTACKS': 'dangerous attacks',
    'COUNTER_ATTACKS': 'counter attacks',
    // Cards
    'YELLOWCARDS': 'yellow cards',
    'YELLOWCARDS_OVERTIME': 'yellow cards',
    'REDCARDS': 'red cards',
    // Offsides
    'OFFSIDES': 'offsides',
    'OFFSIDES_OVERTIME': 'offsides',
    // Fouls
    'FOULS': 'fouls',
    'FREE_KICKS': 'free kicks',
    // Saves
    'SAVES': 'saves',
    // Passes
    'PASSES': 'passes',
    'SUCCESSFUL_PASSES': 'successful passes',
    'SUCCESSFUL_PASSES_PERCENTAGE': 'pass accuracy',
    'LONG_BALLS': 'long balls',
    'BACKWARD_PASSES': 'backward passes',
    'PASSES_IN_FINAL_THIRD': 'passes in final third',
    // Other
    'TACKLES': 'tackles',
    'INTERCEPTIONS': 'interceptions',
    'CLEARANCES': 'clearances',
    'HEADERS': 'headers',
    'SUCCESSFUL_HEADERS': 'successful headers',
    'DUELS_WON': 'duels won',
    'CHALLENGES': 'challenges',
    'THROWINS': 'throwins',
    'GOAL_KICKS': 'goal kicks',
    'BEATS': 'beats',
    'TREATMENTS': 'treatments',
    'INJURIES': 'injuries',
  };
  
  // Common Sportmonks type_id to stat name mapping (fallback)
  const typeIdToName = {
    45: 'ball possession', // Possession
    47: 'shots on target', // Shots on Target
    46: 'total shots', // Total Shots
    49: 'corner kicks', // Corners
    50: 'offsides', // Offsides
    52: 'fouls', // Fouls
    53: 'yellow cards', // Yellow Cards
    54: 'red cards', // Red Cards
    55: 'saves', // Saves
    56: 'passes', // Passes
    57: 'pass accuracy', // Pass Accuracy
    100: 'attacks', // Attacks
    43: 'shots on goal', // Shots on Goal
    44: 'shots off goal', // Shots off Goal
  };
  
  // Track which stats we've already processed to avoid duplicates
  const processedHomeStats = new Set();
  const processedAwayStats = new Set();
  
  for (const stat of statsArray) {
    const participantId = stat.participant_id;
    // Handle different statistic formats
    let statType = '';
    let value = 0;
    
    // Format 1: Use developer_name first (most reliable)
    if (stat.developer_name && developerNameToStatName[stat.developer_name]) {
      statType = developerNameToStatName[stat.developer_name];
    }
    // Format 2: stat.type.name or stat.type_name
    else if (stat.type?.name) {
      statType = stat.type.name;
    } else if (stat.type_name) {
      statType = stat.type_name;
    } else if (stat.type_id) {
      // Format 3: type_id with data.value (Sportmonks V3 format)
      statType = typeIdToName[stat.type_id] || `type_${stat.type_id}`;
    }
    
    // Skip if no stat type identified
    if (!statType) {
      continue;
    }
    
    // Extract value - can be direct or in data.value
    if (stat.value !== undefined && stat.value !== null) {
      value = parseFloat(stat.value) || 0;
    } else if (stat.data?.value !== undefined && stat.data.value !== null) {
      value = parseFloat(stat.data.value) || 0;
    }
    
    // Normalize stat type to lowercase for consistent comparison
    const statTypeLower = statType.toLowerCase();
    
    // Map location-based stats (home/away) to stat types
    if (stat.location && (stat.location === 'home' || stat.location === 'away')) {
      // Location-based format (Sportmonks V3)
      const statKey = `${statTypeLower}_${stat.location}`;
      if (stat.location === 'home') {
        // Only add if we haven't processed this stat type for home team yet
        // Or if the new value is higher (for cards, take the maximum)
        if (!processedHomeStats.has(statTypeLower) || value > (homeStats[statTypeLower] || 0)) {
          homeStats[statTypeLower] = value;
          processedHomeStats.add(statTypeLower);
        }
      } else if (stat.location === 'away') {
        // Only add if we haven't processed this stat type for away team yet
        // Or if the new value is higher (for cards, take the maximum)
        if (!processedAwayStats.has(statTypeLower) || value > (awayStats[statTypeLower] || 0)) {
          awayStats[statTypeLower] = value;
          processedAwayStats.add(statTypeLower);
        }
      }
    } else if (participantId) {
      // Participant-based format
      if (participantId === homeTeamId) {
        // Only add if we haven't processed this stat type for home team yet
        // Or if the new value is higher (for cards, take the maximum)
        if (!processedHomeStats.has(statTypeLower) || value > (homeStats[statTypeLower] || 0)) {
          homeStats[statTypeLower] = value;
          processedHomeStats.add(statTypeLower);
        }
      } else if (participantId === awayTeamId) {
        // Only add if we haven't processed this stat type for away team yet
        // Or if the new value is higher (for cards, take the maximum)
        if (!processedAwayStats.has(statTypeLower) || value > (awayStats[statTypeLower] || 0)) {
          awayStats[statTypeLower] = value;
          processedAwayStats.add(statTypeLower);
        }
      }
    }
  }
  
  // Map common statistic names to result keys
  const statMappings = {
    // Possession
    'possession': 'possession',
    'ball possession': 'possession',
    'ball_possession': 'possession',
    // Shots
    'shots on goal': 'shots',
    'shots on target': 'shotsOnTarget',
    'shots_on_goal': 'shots',
    'shots_on_target': 'shotsOnTarget',
    'total shots': 'shots',
    'total_shots': 'shots',
    'shots': 'shots',
    // Corners
    'corner kicks': 'corners',
    'corner_kicks': 'corners',
    'corners': 'corners',
    // Attacks
    'attacks': 'attacks',
    'dangerous attacks': 'attacks',
    'dangerous_attacks': 'attacks',
    // Cards
    'yellow cards': 'yellowCards',
    'yellow_cards': 'yellowCards',
    'yellowcard': 'yellowCards',
    'yellow card': 'yellowCards',
    'red cards': 'redCards',
    'red_cards': 'redCards',
    'redcard': 'redCards',
    'red card': 'redCards',
    // Offsides
    'offsides': 'offsides',
    'offside': 'offsides',
    // Fouls
    'fouls': 'fouls',
    'foul': 'fouls',
    // Saves
    'saves': 'saves',
    'save': 'saves',
    'goalkeeper saves': 'saves',
    // Passes
    'passes': 'passes',
    'total passes': 'passes',
    'total_passes': 'passes',
    'pass accuracy': 'passAccuracy',
    'pass_accuracy': 'passAccuracy',
    'passes accuracy': 'passAccuracy',
    'passes_accuracy': 'passAccuracy',
  };
  
  // Extract statistics
  for (const [key, value] of Object.entries(homeStats)) {
    const mappedKey = statMappings[key] || key;
    if (mappedKey in result) {
      if (!result[mappedKey]) {
        result[mappedKey] = [value, awayStats[key] || 0];
      }
    }
  }
  
  // If we didn't find stats, try to extract from away stats
  for (const [key, value] of Object.entries(awayStats)) {
    const mappedKey = statMappings[key] || key;
    if (mappedKey in result && !result[mappedKey]) {
      result[mappedKey] = [homeStats[key] || 0, value];
    }
  }
  
  return result;
}

const MatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addSelection, isSelected } = useBetSlip();
  const { match, loading, error } = useMatchDetails(id);
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [expandedMarkets, setExpandedMarkets] = useState(new Set()); // Track which markets are expanded
  const [logoErrors, setLogoErrors] = useState({ home: false, away: false });
  const [activeTab, setActiveTab] = useState('markets'); // 'markets', 'events', 'stats', 'lineups', 'injuries'
  
  // Fetch odds from fixture-specific endpoint (71 markets) for detail page
  const { data: oddsData, isLoading: oddsLoading } = useQuery({
    queryKey: ['matchOdds', id],
    queryFn: async () => {
      if (!id) return null;
      const odds = await footballService.getMatchOdds(parseInt(id, 10));
      return odds?.data || odds || [];
    },
    enabled: !!id && !!match, // Only fetch if match ID exists and match is loaded
    staleTime: 7000, // Data is fresh for 7 seconds
    cacheTime: 300000, // Cache for 5 minutes
    refetchInterval: (query) => {
      // Only poll when page is visible (not in background)
      if (typeof document !== 'undefined' && document.hidden) {
        return false; // Stop polling when page is hidden
      }
      // Live matches: poll every 10 seconds (in-play data updates every 5-15 seconds)
      // Pre-match: don't poll (odds update less frequently)
      return match?.isLive ? 10000 : false;
    },
  });
  
  // Merge odds from dedicated endpoint with match data
  const matchWithOdds = useMemo(() => {
    if (!match) return null;
    if (!oddsData || oddsData.length === 0) return match;
    
    // Convert normalized odds array to markets format
    // Odds endpoint returns normalized odds: [{ market_id, market_name, label, value, stopped, suspended, ... }]
    // Use the existing mapping function that handles normalized odds
    // Create a backend-style match object with odds
    const matchWithOddsData = {
      ...match,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      odds: oddsData
    };
    const mapped = mapApiMatchToInternal(matchWithOddsData);
    
    // Use markets from odds endpoint if available, otherwise use match markets
    return {
      ...match,
      markets: mapped?.markets && mapped.markets.length > 0 ? mapped.markets : (match.markets || [])
    };
  }, [match, oddsData]);
  
  // Debug logs removed for production optimization
  
  // Fetch events and statistics for live, half-time, or finished matches
  const isHalfTime = match?.status === 'HT' || match?.status === 'HALF_TIME';
  const shouldFetchEvents = match?.isLive || isHalfTime || match?.isFinished;
  
  // Update active tab if match is finished and current tab is markets
  useEffect(() => {
    if (match?.isFinished && activeTab === 'markets') {
      // Switch to events tab if available, otherwise lineups
      if (shouldFetchEvents) {
        setActiveTab('events');
      } else {
        setActiveTab('lineups');
      }
    }
  }, [match?.isFinished, activeTab, shouldFetchEvents]);
  // Refresh intervals: live matches refresh faster, half-time and finished matches refresh slower
  // Only poll when page is visible (not in background)
  const isPageVisible = typeof document !== 'undefined' && !document.hidden;
  const refreshIntervalEvents = isPageVisible && match?.isLive ? 15000 : (isPageVisible && (isHalfTime || match?.isFinished) ? 120000 : false);
  const refreshIntervalStats = isPageVisible && match?.isLive ? 30000 : (isPageVisible && (isHalfTime || match?.isFinished) ? 120000 : false);
  const { events, loading: eventsLoading, error: eventsError } = useLiveMatchEvents(id, shouldFetchEvents, refreshIntervalEvents);
  const { statistics: rawStatistics, loading: statsLoading, error: statsError } = useLiveMatchStatistics(id, shouldFetchEvents, refreshIntervalStats);
  
  // Fetch lineups
  const { lineups, loading: lineupsLoading, error: lineupsError } = useMatchLineups(id, true);
  const homeTeamId = match?.homeTeamId || match?.home_team_id;
  const awayTeamId = match?.awayTeamId || match?.away_team_id;
  
  // Extract sidelined (match-specific injuries and suspensions) from match data
  const { homeInjuries, awayInjuries } = useMemo(() => {
    const sidelined = match?.sidelined || [];
    
    if (!Array.isArray(sidelined) || sidelined.length === 0) {
      return { homeInjuries: [], awayInjuries: [] };
    }
    
    // Separate by team side and transform to UI format
    const homeInj = [];
    const awayInj = [];
    
    sidelined.forEach((item) => {
      if (!item.is_active) return; // Skip inactive items
      
      // Translate type to Turkish (backend'den gelmişse zaten çevrilmiş olabilir, yine de kontrol edelim)
      const typeLower = (item.type || '').toLowerCase();
      let injuryType = item.type || 'Sakatlık';
      
      // Eğer backend'den Türkçe gelmemişse çevir
      const turkishIndicators = ['sakatlık', 'cezalı', 'milli takıma', 'ameliyatı', 'kırığı'];
      const isAlreadyTurkish = turkishIndicators.some(indicator => typeLower.includes(indicator));
      
      if (!isAlreadyTurkish) {
        // Common type translations
        const typeTranslations = {
          // General
          'injury': 'Sakatlık',
          'suspension': 'Cezalı',
          'called up to national team': 'Milli Takıma Çağrıldı',
          'national team': 'Milli Takıma Çağrıldı',
          'virus': 'Hastalık',
          'ill': 'Hastalık',
          'illness': 'Hastalık',
          'sick': 'Hastalık',
          'disease': 'Hastalık',
          
          // Injuries
          'hamstring injury': 'Hamstring Sakatlığı',
          'ankle injury': 'Ayak Bileği Sakatlığı',
          'knee injury': 'Diz Sakatlığı',
          'shoulder injury': 'Omuz Sakatlığı',
          'back injury': 'Sırt Sakatlığı',
          'foot injury': 'Ayak Sakatlığı',
          'leg injury': 'Bacak Sakatlığı',
          'thigh injury': 'Uyluk Sakatlığı',
          'thigh problems': 'Uyluk Sorunu',
          'groin injury': 'Kasık Sakatlığı',
          'muscle injury': 'Kas Sakatlığı',
          'broken collarbone': 'Köprücük Kemiği Kırığı',
          'broken leg': 'Bacak Kırığı',
          'cruciate ligament tear': 'Çapraz Bağ Kopması',
          'acl injury': 'Çapraz Bağ Kopması',
          'bruised ribs': 'Kaburga Ezilmesi',
          'rib injury': 'Kaburga Sakatlığı',
          'ankle surgery': 'Ayak Bileği Ameliyatı',
          'knee surgery': 'Diz Ameliyatı',
          'shoulder surgery': 'Omuz Ameliyatı',
          'concussion': 'Sarsıntı',
          'head injury': 'Kafa Sakatlığı',
          'neck injury': 'Boyun Sakatlığı',
          'wrist injury': 'Bilek Sakatlığı',
          'elbow injury': 'Dirsek Sakatlığı',
          'hip injury': 'Kalça Sakatlığı',
          'calf injury': 'Baldır Sakatlığı',
          'achilles injury': 'Aşil Tendonu Sakatlığı',
          'meniscus injury': 'Menisküs Sakatlığı',
          'torn muscle': 'Kas Yırtığı',
          'muscle tear': 'Kas Yırtığı',
          'strain': 'Zorlanma',
          'sprain': 'Burkulma',
          'fracture': 'Kırık',
          'dislocation': 'Çıkık',
          'tendon injury': 'Tendon Sakatlığı',
          'ligament injury': 'Bağ Sakatlığı',
          
          // Suspensions
          'yellow card suspension': 'Sarı Kart Cezası',
          'red card suspension': 'Kırmızı Kart Cezası',
          'accumulated yellow cards': 'Biriken Sarı Kart Cezası',
          'red card': 'Kırmızı Kart Cezası',
          'yellow card': 'Sarı Kart Cezası',
        };
        
        // Try exact match first
        if (typeLower in typeTranslations) {
          injuryType = typeTranslations[typeLower];
        } else {
          // Try partial matches
          if (typeLower.includes('injury')) {
            injuryType = 'Sakatlık';
          } else if (typeLower.includes('suspension') || typeLower.includes('suspended')) {
            injuryType = 'Cezalı';
          } else if (typeLower.includes('national team') || typeLower.includes('called up')) {
            injuryType = 'Milli Takıma Çağrıldı';
          } else if (typeLower.includes('yellow card')) {
            injuryType = 'Sarı Kart Cezası';
          } else if (typeLower.includes('red card')) {
            injuryType = 'Kırmızı Kart Cezası';
          } else if (typeLower.includes('virus') || typeLower.includes('ill') || typeLower.includes('illness') || typeLower.includes('sick')) {
            injuryType = 'Hastalık';
          } else if (typeLower.includes('cruciate') || typeLower.includes('acl')) {
            injuryType = 'Çapraz Bağ Kopması';
          } else if (typeLower.includes('thigh') && typeLower.includes('problem')) {
            injuryType = 'Uyluk Sorunu';
          } else if (typeLower.includes('rib') && (typeLower.includes('bruised') || typeLower.includes('bruise'))) {
            injuryType = 'Kaburga Ezilmesi';
          } else if (typeLower.includes('rib')) {
            injuryType = 'Kaburga Sakatlığı';
          } else if (typeLower.includes('ligament') && typeLower.includes('tear')) {
            injuryType = 'Bağ Kopması';
          } else if (typeLower.includes('muscle') && (typeLower.includes('tear') || typeLower.includes('torn'))) {
            injuryType = 'Kas Yırtığı';
          } else if (typeLower.includes('concussion')) {
            injuryType = 'Sarsıntı';
          } else if (typeLower.includes('strain')) {
            injuryType = 'Zorlanma';
          } else if (typeLower.includes('sprain')) {
            injuryType = 'Burkulma';
          } else if (typeLower.includes('fracture')) {
            injuryType = 'Kırık';
          } else if (typeLower.includes('dislocation')) {
            injuryType = 'Çıkık';
          } else if (typeLower.includes('surgery')) {
            injuryType = item.type.replace(/Surgery/gi, 'Ameliyatı').replace(/surgery/gi, 'Ameliyatı');
          } else if (typeLower.includes('injury')) {
            // General injury pattern - try to translate body parts
            if (typeLower.includes('head') || typeLower.includes('kafa')) {
              injuryType = 'Kafa Sakatlığı';
            } else if (typeLower.includes('neck') || typeLower.includes('boyun')) {
              injuryType = 'Boyun Sakatlığı';
            } else if (typeLower.includes('wrist') || typeLower.includes('bilek')) {
              injuryType = 'Bilek Sakatlığı';
            } else if (typeLower.includes('elbow') || typeLower.includes('dirsek')) {
              injuryType = 'Dirsek Sakatlığı';
            } else if (typeLower.includes('hip') || typeLower.includes('kalça')) {
              injuryType = 'Kalça Sakatlığı';
            } else if (typeLower.includes('calf') || typeLower.includes('baldır')) {
              injuryType = 'Baldır Sakatlığı';
            } else if (typeLower.includes('achilles') || typeLower.includes('aşil')) {
              injuryType = 'Aşil Tendonu Sakatlığı';
            } else if (typeLower.includes('meniscus') || typeLower.includes('menisküs')) {
              injuryType = 'Menisküs Sakatlığı';
            } else if (typeLower.includes('tendon')) {
              injuryType = 'Tendon Sakatlığı';
            } else if (typeLower.includes('ligament')) {
              injuryType = 'Bağ Sakatlığı';
            } else {
              injuryType = 'Sakatlık';
            }
          }
        }
      }
      
      // Format return date
      let returnDate = '';
      if (item.end_date) {
        try {
          const date = new Date(item.end_date);
          if (!isNaN(date.getTime())) {
            // Format as DD.MM.YYYY
            returnDate = date.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          } else {
            returnDate = item.end_date; // Use as-is if parsing fails
          }
        } catch (e) {
          returnDate = item.end_date; // Use as-is if error
        }
      }
      
      const injuryItem = {
        player_name: item.player_name || 'Oyuncu',
        player_image: item.player_image || null,
        type: injuryType,
        description: item.description || '',
        return_date: returnDate,
        team: item.team_side === 'home' ? (match?.homeTeam || match?.home_team || 'Ev Sahibi') : (match?.awayTeam || match?.away_team || 'Deplasman'),
      };
      
      if (item.team_side === 'home') {
        homeInj.push(injuryItem);
      } else if (item.team_side === 'away') {
        awayInj.push(injuryItem);
      }
    });
    
    return { homeInjuries: homeInj, awayInjuries: awayInj };
  }, [match?.sidelined, match?.homeTeam, match?.home_team, match?.awayTeam, match?.away_team]);
  
  // Combine injuries from both teams for backward compatibility
  const injuries = useMemo(() => {
    const allInjuries = [];
    if (homeInjuries && Array.isArray(homeInjuries)) {
      allInjuries.push(...homeInjuries);
    }
    if (awayInjuries && Array.isArray(awayInjuries)) {
      allInjuries.push(...awayInjuries);
    }
    return allInjuries;
  }, [homeInjuries, awayInjuries]);
  
  // Loading and error states are now tied to match loading
  const injuriesLoading = loading;
  const injuriesError = error;
  
  // Fetch league standings
  const leagueId = match?.leagueId || match?.league_id;
  const seasonId = match?.seasonId || match?.season_id;
  const { standings, loading: standingsLoading, error: standingsError } = useLeagueStandings(
    leagueId?.toString(),
    seasonId
  );
  
  // Transform Sportmonks V3 statistics array to component format
  const statistics = useMemo(() => {
    // First check if statistics are already in match object from backend
    if (match?.statistics && Array.isArray(match.statistics) && match.statistics.length > 0) {
      const homeTeamId = match?.homeTeamId || match?.home_team_id;
      const awayTeamId = match?.awayTeamId || match?.away_team_id;
      return transformSportmonksStatistics(match.statistics, homeTeamId, awayTeamId);
    }
    
    if (!rawStatistics) return null;
    
    // If it's already in the expected format (object with possession, shots, etc.)
    if (rawStatistics.possession || rawStatistics.shots) {
      return rawStatistics;
    }
    
    // If it's an array (Sportmonks V3 format), transform it
    if (Array.isArray(rawStatistics)) {
      const homeTeamId = match?.homeTeamId || match?.home_team_id;
      const awayTeamId = match?.awayTeamId || match?.away_team_id;
      return transformSportmonksStatistics(rawStatistics, homeTeamId, awayTeamId);
    }
    
    return null;
  }, [rawStatistics, match?.statistics, match?.homeTeamId, match?.home_team_id, match?.awayTeamId, match?.away_team_id]);
  
  // Track odds changes
  const { getOddsChange } = useOddsTracking(id, match, match?.isLive ? 5000 : 30000);
  
  const dateTimeDisplay = useMemo(() => {
    if (!match) return '';
    return formatMatchDateTime(match.date, match.time);
  }, [match]);

  // Group markets by category
  const marketsByCategory = useMemo(() => {
    const marketsToUse = matchWithOdds?.markets || match?.markets;
    if (!marketsToUse) return {};
    return groupMarketsByCategory(marketsToUse);
  }, [matchWithOdds?.markets, match?.markets]);

  // Get available categories
  const categories = useMemo(() => {
    const cats = Object.keys(marketsByCategory);
    return ['Tümü', ...getCategoryOrder().filter(cat => cats.includes(cat)), ...cats.filter(cat => !getCategoryOrder().includes(cat))];
  }, [marketsByCategory]);

  // Normalize market name for grouping (remove variations, translate to standard name)
  const normalizeMarketName = (marketName) => {
    if (!marketName) return '';
    const translated = translateMarketName(marketName);
    const lower = translated.toLowerCase().trim();
    const originalLower = (marketName || '').toLowerCase().trim();
    
    // Normalize common variations - check both translated and original
    if (lower.includes('maç sonucu') || lower.includes('match result') || originalLower.includes('1x2') || originalLower.includes('match winner') || originalLower.includes('full time result') || originalLower.includes('fulltime result')) {
      return 'maç_sonucu';
    }
    if (lower.includes('toplam gol') || originalLower.includes('total goal') || originalLower.includes('over/under') || originalLower.includes('goal line') || originalLower.includes('total goals')) {
      return 'toplam_gol';
    }
    if (lower.includes('çifte şans') || originalLower.includes('double chance')) {
      return 'çifte_şans';
    }
    if (lower.includes('beraberlik yok') || lower.includes('beraberlikte iade') || originalLower.includes('draw no bet')) {
      return 'beraberlik_yok';
    }
    if (lower.includes('asya handikap') || originalLower.includes('asian handicap')) {
      return 'asya_handikap';
    }
    if (lower.includes('karşılıklı gol') || originalLower.includes('both teams to score') || originalLower.includes('btts')) {
      return 'karşılıklı_gol';
    }
    
    return translated.toLowerCase().replace(/\s+/g, '_');
  };
  
  // Filter, merge duplicates, translate and sort markets by selected category
  const filteredMarkets = useMemo(() => {
    const marketsToUse = matchWithOdds?.markets || match?.markets;
    if (!marketsToUse) return [];
    
    let markets = [];
    if (selectedCategory === 'Tümü') {
      markets = marketsToUse;
    } else {
      markets = marketsByCategory[selectedCategory] || [];
    }
    
    // Merge markets with same normalized name and translate names
    const marketMap = new Map();
    
    markets.forEach((market) => {
      // Translate market name to Turkish
      const translatedName = translateMarketName(market.name);
      const normalizedKey = normalizeMarketName(market.name);
      
      if (marketMap.has(normalizedKey)) {
        // Merge options from duplicate markets
        const existingMarket = marketMap.get(normalizedKey);
        
        // Normalize option labels for matching (1, X, 2 for match result, otherwise use label as-is)
        const normalizeOptionLabel = (label) => {
          if (!label) return '';
          const labelTrimmed = (label || '').trim();
          const labelLower = labelTrimmed.toLowerCase();
          
          // Keep score formats as-is (e.g., "0-0", "1-0", "2-1")
          if (/^\d+-\d+$/.test(labelTrimmed)) {
            return labelTrimmed; // Keep original format (preserves case, but scores are usually numbers)
          }
          
          // For correct score markets, don't normalize - keep original label
          const isCorrectScore = normalizedKey.includes('kesin_skor') || normalizedKey.includes('correct_score');
          if (isCorrectScore) {
            return labelTrimmed;
          }
          
          // For handicap markets, don't normalize 1/X/2 - keep original labels
          // Handicap markets should only have home/away options with handicap values
          const isHandicap = normalizedKey.includes('handikap') || normalizedKey.includes('handicap');
          if (isHandicap) {
            // For handicap, keep original label (will be "Home 0.5", "Away -0.5", etc.)
            return labelTrimmed;
          }
          
          // For match result markets only, normalize to 1, X, 2
          if (normalizedKey === 'maç_sonucu' || normalizedKey.includes('match_result')) {
            if (labelLower === 'home' || labelLower === 'ev sahibi' || labelLower === '1' || 
                labelLower === match?.homeTeam?.toLowerCase()) {
              return '1';
            }
            if (labelLower === 'away' || labelLower === 'deplasman' || labelLower === '2' || 
                labelLower === match?.awayTeam?.toLowerCase()) {
              return '2';
            }
            if (labelLower === 'draw' || labelLower === 'beraberlik' || labelLower === 'x' || labelLower === 'tie') {
              return 'X';
            }
          }
          
          // For other markets, use normalized lowercase label
          return labelLower;
        };
        
        // Helper function to select best odds using the logic:
        // - If only one option: use it
        // - If multiple options: use second lowest, unless difference from lowest is > 0.50, then use lowest
        const selectBestOdds = (options) => {
          if (options.length === 0) return null;
          if (options.length === 1) return options[0];
          
          // Sort by value (ascending - lowest first)
          const sorted = [...options].sort((a, b) => {
            const valA = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
            const valB = typeof b.value === 'number' ? b.value : parseFloat(b.value) || 0;
            return valA - valB;
          });
          
          // Get lowest and second lowest
          const lowest = sorted[0];
          const secondLowest = sorted[1];
          
          const lowestValue = typeof lowest.value === 'number' ? lowest.value : parseFloat(lowest.value) || 0;
          const secondLowestValue = typeof secondLowest.value === 'number' ? secondLowest.value : parseFloat(secondLowest.value) || 0;
          
          const difference = secondLowestValue - lowestValue;
          
          if (difference > 0.50) {
            // Difference > 0.50, use lowest
            return lowest;
          } else {
            // Difference <= 0.50, use second lowest
            return secondLowest;
          }
        };
        
        // Process each option from the new market - collect all options first
        const allOptionsByLabel = new Map();
        
        // Add existing options
        existingMarket.options.forEach(opt => {
          const normalized = normalizeOptionLabel(opt.label);
          if (!allOptionsByLabel.has(normalized)) {
            allOptionsByLabel.set(normalized, []);
          }
          allOptionsByLabel.get(normalized).push(opt);
        });
        
        // Add new options from current market
        market.options.forEach(opt => {
          const optLabel = (opt.label || '').trim();
          const optLabelNormalized = normalizeOptionLabel(optLabel);
          const optValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
          
          // Filter out invalid odds (<= 0) and extremely high odds (> 100)
          if (optValue <= 0 || optValue > 100) return;
          
          if (!allOptionsByLabel.has(optLabelNormalized)) {
            allOptionsByLabel.set(optLabelNormalized, []);
          }
          
          // Keep normalized label for display if it's 1/X/2 (prevents duplicates)
          // Otherwise use original label (will be translated later)
          const displayLabel = ['1', 'X', '2'].includes(optLabelNormalized)
            ? optLabelNormalized.toUpperCase() 
            : optLabel;
          
          allOptionsByLabel.get(optLabelNormalized).push({
            label: displayLabel,
            value: optValue,
            selectionId: opt.selectionId
          });
        });
        
        // For each normalized label, apply the selection logic
        const finalOptions = [];
        allOptionsByLabel.forEach((opts, normalized) => {
          const selected = selectBestOdds(opts);
          if (selected) {
            finalOptions.push(selected);
          }
        });
        
        existingMarket.options = finalOptions;
      } else {
        // Create new market entry with translated name
        // Normalize option labels for matching - apply to all markets
        const normalizeOptionLabel = (label) => {
          if (!label) return '';
          const labelTrimmed = (label || '').trim();
          const labelLower = labelTrimmed.toLowerCase();
          
          // Keep score formats as-is (e.g., "0-0", "1-0", "2-1")
          if (/^\d+-\d+$/.test(labelTrimmed)) {
            return labelTrimmed; // Keep original format
          }
          
          // For correct score markets, don't normalize - keep original label
          const isCorrectScore = normalizedKey.includes('kesin_skor') || normalizedKey.includes('correct_score');
          if (isCorrectScore) {
            return labelTrimmed;
          }
          
          // For handicap markets, don't normalize 1/X/2 - keep original labels
          // Handicap markets should only have home/away options, not 1/X/2
          const isHandicap = normalizedKey.includes('handikap') || normalizedKey.includes('handicap');
          if (isHandicap) {
            // For handicap, keep original label (will be "Home 0.5", "Away -0.5", etc.)
            return labelTrimmed;
          }
          
          // For match result markets only, normalize to 1/X/2
          if (normalizedKey === 'maç_sonucu' || normalizedKey.includes('match_result')) {
            if (labelLower === 'home' || labelLower === 'ev sahibi' || labelLower === '1' || 
                labelLower === match?.homeTeam?.toLowerCase()) {
              return '1';
            }
            if (labelLower === 'away' || labelLower === 'deplasman' || labelLower === '2' || 
                labelLower === match?.awayTeam?.toLowerCase()) {
              return '2';
            }
            if (labelLower === 'draw' || labelLower === 'beraberlik' || labelLower === 'x' || labelLower === 'tie') {
              return 'X';
            }
          }
          
          // For other markets, use normalized lowercase label
          return labelLower;
        };
        
        // Helper function to select best odds using the logic:
        // - If only one option: use it
        // - If multiple options: use second lowest, unless difference from lowest is > 0.50, then use lowest
        const selectBestOdds = (options) => {
          if (options.length === 0) return null;
          if (options.length === 1) return options[0];
          
          // Sort by value (ascending - lowest first)
          const sorted = [...options].sort((a, b) => {
            const valA = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
            const valB = typeof b.value === 'number' ? b.value : parseFloat(b.value) || 0;
            return valA - valB;
          });
          
          // Get lowest and second lowest
          const lowest = sorted[0];
          const secondLowest = sorted[1];
          
          const lowestValue = typeof lowest.value === 'number' ? lowest.value : parseFloat(lowest.value) || 0;
          const secondLowestValue = typeof secondLowest.value === 'number' ? secondLowest.value : parseFloat(secondLowest.value) || 0;
          
          const difference = secondLowestValue - lowestValue;
          
          if (difference > 0.50) {
            // Difference > 0.50, use lowest
            return lowest;
          } else {
            // Difference <= 0.50, use second lowest
            return secondLowest;
          }
        };
        
        // Group options by normalized label
        const optionsByLabel = new Map();
        market.options.forEach(opt => {
          const optValue = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
          // Filter out invalid odds (<= 0) and extremely high odds (> 100)
          if (optValue <= 0 || optValue > 100) return;
          
          const normalized = normalizeOptionLabel(opt.label);
          if (!optionsByLabel.has(normalized)) {
            optionsByLabel.set(normalized, []);
          }
          
          // Keep normalized label for display if it's 1/X/2 (prevents duplicates)
          // Otherwise use original label (will be translated later)
          const displayLabel = ['1', 'X', '2'].includes(normalized)
            ? normalized.toUpperCase() 
            : (opt.label || '').trim();
          
          optionsByLabel.get(normalized).push({
            label: displayLabel,
            value: optValue,
            selectionId: opt.selectionId
          });
        });
        
        // For each normalized label, apply the selection logic
        const validOptions = [];
        optionsByLabel.forEach((opts) => {
          const selected = selectBestOdds(opts);
          if (selected) {
            validOptions.push(selected);
          }
        });
        
        if (validOptions.length > 0) {
          marketMap.set(normalizedKey, {
            ...market,
            name: translatedName,
            options: validOptions,
            originalName: market.name,
          });
        }
      }
    });
    
    // Convert map back to array
    const mergedMarkets = Array.from(marketMap.values());
    
    // Sort markets by importance (use category order)
    const categoryOrder = getCategoryOrder();
    return mergedMarkets.sort((a, b) => {
      const categoryA = getMarketCategory(a.name);
      const categoryB = getMarketCategory(b.name);
      const indexA = categoryOrder.indexOf(categoryA);
      const indexB = categoryOrder.indexOf(categoryB);
      
      // If same category, sort by name
      if (indexA === indexB) {
        return a.name.localeCompare(b.name);
      }
      
      // If category not found, put at end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  }, [match?.markets, selectedCategory, marketsByCategory]);
  
  // Check if a market is Over/Under type (for table display)
  const isOverUnderMarket = useMemo(() => {
    return (marketName) => {
      const name = (marketName || '').toLowerCase();
      return (
        name.includes('toplam gol') ||
        name.includes('total goal') ||
        (name.includes('over') && name.includes('under')) ||
        (name.includes('alt') && name.includes('üst')) ||
        (name.includes('gol') && (name.includes('2.5') || name.includes('1.5') || name.includes('3.5') || name.includes('4.5')))
      );
    };
  }, []);
  
  // Check if a market is Handicap type (for table display)
  const isHandicapMarket = useMemo(() => {
    return (marketName) => {
      const name = (marketName || '').toLowerCase();
      return (
        name.includes('handikap') ||
        name.includes('handicap') ||
        name.includes('asian handicap') ||
        name.includes('asya handikap')
      );
    };
  }, []);
  
  // Group handicap options by handicap value
  const groupHandicapOptions = useMemo(() => {
    return (options, homeTeam, awayTeam) => {
      const groups = new Map();
      
      options.forEach(opt => {
        const label = (opt.label || '').trim();
        const value = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
        
        // Filter out invalid odds (<= 0) and extremely high odds (> 100)
        if (value <= 0 || value > 100) return;
        
        // Extract handicap value from label (e.g., "0.5", "-0.5", "1", "-1.25")
        // Handicap labels can be: "0.5", "-0.5", "Home 0.5", "Away -0.5", etc.
        let handicapValue = null;
        const handicapMatch = label.match(/([+-]?\d+\.?\d*)/);
        if (handicapMatch) {
          handicapValue = handicapMatch[1];
        } else {
          // Try to extract from translated label
          const translatedLabel = translateOptionLabel(label);
          const translatedMatch = translatedLabel.match(/([+-]?\d+\.?\d*)/);
          if (translatedMatch) {
            handicapValue = translatedMatch[1];
          }
        }
        
        if (!handicapValue) return;
        
        // Determine if this is for home or away team
        const labelLower = label.toLowerCase();
        const handicapNum = parseFloat(handicapValue);
        const isHome = labelLower.includes('home') || labelLower.includes('ev sahibi') || 
                       (handicapNum >= 0 && !labelLower.includes('away') && !labelLower.includes('deplasman'));
        const isAway = labelLower.includes('away') || labelLower.includes('deplasman') || 
                       (handicapNum < 0 && !labelLower.includes('home') && !labelLower.includes('ev sahibi'));
        
        // Normalize handicap value (remove sign for grouping)
        const absHandicap = Math.abs(handicapNum);
        const handicapKey = absHandicap.toString();
        
        if (!groups.has(handicapKey)) {
          groups.set(handicapKey, { 
            handicap: handicapKey, 
            home: null, 
            away: null,
            homeHandicap: null,
            awayHandicap: null
          });
        }
        
        const group = groups.get(handicapKey);
        
        // For positive handicaps, usually home team; for negative, away team
        // But also check label for explicit team references
        if (isHome || (handicapNum >= 0 && !isAway)) {
          if (!group.home || group.home.value > value) {
            group.home = { label, value, original: opt };
            group.homeHandicap = handicapValue.startsWith('-') ? handicapValue.replace('-', '') : handicapValue;
          }
        } else if (isAway || handicapNum < 0) {
          if (!group.away || group.away.value > value) {
            group.away = { label, value, original: opt };
            // Away handicap is negative, but we display it with minus sign
            group.awayHandicap = handicapValue.startsWith('-') ? handicapValue : `-${handicapValue}`;
          }
        }
      });
      
      // Convert to array and sort by handicap value
      return Array.from(groups.values()).sort((a, b) => {
        const numA = parseFloat(a.handicap) || 0;
        const numB = parseFloat(b.handicap) || 0;
        return numA - numB;
      });
    };
  }, []);
  
  // Group Over/Under options by line (e.g., 2.5, 3.5)
  const groupOverUnderOptions = useMemo(() => {
    return (options) => {
      const groups = new Map();
      
      options.forEach(opt => {
        const label = (opt.label || '').trim();
        const value = typeof opt.value === 'number' ? opt.value : parseFloat(opt.value) || 0;
        
        // Filter out invalid odds (<= 0) and extremely high odds (> 100)
        if (value <= 0 || value > 100) return;
        
        // Extract line number from label (e.g., "2.5 üstü" -> "2.5", "Over 3.5" -> "3.5")
        const lineMatch = label.match(/(\d+\.?\d*)/);
        if (!lineMatch) return;
        
        const lineKey = lineMatch[1];
        
        if (!groups.has(lineKey)) {
          groups.set(lineKey, { line: lineKey, over: null, under: null });
        }
        
        const group = groups.get(lineKey);
        const labelLower = label.toLowerCase();
        
        if (labelLower.includes('üst') || labelLower.includes('over') || labelLower.includes('üstü')) {
          group.over = { label, value, original: opt };
        } else if (labelLower.includes('alt') || labelLower.includes('under') || labelLower.includes('altı')) {
          group.under = { label, value, original: opt };
        }
      });
      
      // Convert to array and sort by line number
      return Array.from(groups.values()).sort((a, b) => {
        const numA = parseFloat(a.line) || 0;
        const numB = parseFloat(b.line) || 0;
        return numA - numB;
      });
    };
  }, []);

  // Reset logo errors when match changes
  useEffect(() => {
    setLogoErrors({ home: false, away: false });
  }, [match?.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32 mb-6 bg-[#1a2332]" />
        <div className="bg-[#0d1117] border border-[#1e2736] rounded-2xl overflow-hidden">
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48 bg-[#1a2332]" />
            <Skeleton className="h-32 w-full bg-[#1a2332]" />
            <Skeleton className="h-64 w-full bg-[#1a2332]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || (!loading && !match)) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft size={16} className="mr-2" />
          Geri Dön
        </Button>
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a2332] flex items-center justify-center">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Maç Bulunamadı</h3>
          <p className="text-gray-500 mb-4">
            {error || 'Bu maçın detayları şu anda mevcut değil. Maç listesine dönerek başka bir maç seçebilirsiniz.'}
          </p>
          <Button
            onClick={() => navigate('/matches')}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            Maçlara Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Geri</span>
      </button>

      {/* Match Header */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0d1117] border border-[#2a3a4d] rounded-2xl overflow-hidden mb-6">
        {/* League */}
        <div className="px-6 py-3 border-b border-[#1e2736] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {match.leagueLogo ? (
              <img src={match.leagueLogo} alt={match.league || 'League'} className="w-6 h-6 object-contain" />
            ) : match.leagueFlag && match.leagueFlag.startsWith('http') ? (
              <img src={match.leagueFlag} alt={match.league || 'League'} className="w-6 h-6 object-contain" />
            ) : null}
            <span className="text-gray-400 font-medium">{match?.league || ''}</span>
          </div>
          {match.status === 'HT' || match.status === 'HALF_TIME' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-yellow-500 font-bold">DEVRE ARASI</span>
            </div>
          ) : match.isLive ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-500 font-bold">CANLI {match.minute}'</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={16} />
              <span>{dateTimeDisplay}</span>
            </div>
          )}
        </div>

        {/* Score Board */}
        <div className="p-6">
          <div className="flex items-center justify-center gap-8">
            {/* Home Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center overflow-hidden">
                {match.homeTeamLogo && !logoErrors.home ? (
                  <img 
                    src={match.homeTeamLogo} 
                    alt={match.homeTeam}
                    className="w-full h-full object-contain p-2"
                    onError={() => setLogoErrors(prev => ({ ...prev, home: true }))}
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">{getFallbackIcon(match.homeTeam)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.homeTeam}</h3>
            </div>

            {/* Score or Date/Time */}
            <div className="text-center">
              {(match.isLive || isHalfTime || match.isFinished) && 
               (match.homeScore !== null && match.homeScore !== undefined) && 
               (match.awayScore !== null && match.awayScore !== undefined) ? (
                <div>
                  <div className="text-5xl font-bold text-white mb-2">
                  {match.homeScore} - {match.awayScore}
                  </div>
                  {match.isFinished && (
                    <div className="text-xs text-gray-500 font-medium">Maç Bitti</div>
                  )}
                  {isHalfTime && (
                    <div className="text-xs text-yellow-500 font-medium">DEVRE ARASI</div>
                  )}
                  {match.isLive && match.minute && (
                    <div className="text-xs text-red-500 font-medium">{match.minute}'</div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-500 mb-2">VS</div>
                  <div className="text-sm text-gray-400">
                    {dateTimeDisplay ? (
                    <div className="flex items-center justify-center gap-1">
                      <Clock size={14} />
                      <span>{dateTimeDisplay}</span>
                    </div>
                    ) : (
                      <div className="text-gray-500">Tarih belirtilmemiş</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center flex-1">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0a0e14] flex items-center justify-center overflow-hidden">
                {match.awayTeamLogo && !logoErrors.away ? (
                  <img 
                    src={match.awayTeamLogo} 
                    alt={match.awayTeam}
                    className="w-full h-full object-contain p-2"
                    onError={() => setLogoErrors(prev => ({ ...prev, away: true }))}
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">{getFallbackIcon(match.awayTeam)}</span>
                )}
              </div>
              <h3 className="text-white font-bold text-lg">{match.awayTeam}</h3>
            </div>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden mb-6">
        <div className="flex border-b border-[#1e2736] overflow-x-auto scrollbar-hide">
          {[
            { id: 'markets', label: 'Bahis Oranları', icon: TrendingUp, show: true }, // Show markets for all matches including half-time and finished
            { id: 'events', label: 'Olaylar', icon: Target, show: shouldFetchEvents },
            { id: 'stats', label: 'İstatistikler', icon: Activity, show: shouldFetchEvents },
            { id: 'lineups', label: 'Kadrolar', icon: Users, show: true },
            { id: 'injuries', label: 'Sakatlıklar', icon: Heart, show: true },
            { id: 'standings', label: 'Puan Durumu', icon: Trophy, show: !!leagueId },
          ].filter(tab => tab.show).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'text-amber-500 border-b-2 border-amber-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Markets Tab */}
          {activeTab === 'markets' && (
            <div className="space-y-4">
              {/* Category Filter */}
              {categories.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Filter size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex gap-2 min-w-max">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                          selectedCategory === category
                            ? 'bg-amber-500 text-black'
                            : 'bg-[#1a2332] text-gray-400 hover:bg-[#2a3a4d] hover:text-white'
                        }`}
                      >
                        {category}
                        {category !== 'Tümü' && marketsByCategory[category] && (
                          <span className="ml-2 text-xs opacity-75">
                            ({marketsByCategory[category].length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Markets List - Table view for Over/Under and Handicap, dropdown for others */}
              <div className="space-y-4">
                {filteredMarkets.length > 0 ? (
                  filteredMarkets.map((market, idx) => {
                    const marketKey = `${selectedCategory}-${idx}-${market.name}-${market.marketId || ''}`;
                    const validOptions = market.options || [];
                    const isExpanded = expandedMarkets.has(marketKey);
                    
                    if (validOptions.length === 0) return null;
                    
                    // Render all markets as dropdown/collapsible (same format for all)
                    const sortedOptions = sortMarketOptions(validOptions, market.name);
                    const isMarketExpanded = expandedMarkets.has(marketKey);
                    
                    return (
                      <div key={marketKey} className="bg-[#0a0e14] border border-[#1e2736] rounded-xl overflow-hidden">
                        <div 
                          className="p-4 border-b border-[#1e2736] bg-[#0d1117] flex items-center justify-between cursor-pointer hover:bg-[#1a2332] transition-colors"
                          onClick={() => {
                            const newExpanded = new Set(expandedMarkets);
                            if (newExpanded.has(marketKey)) {
                              newExpanded.delete(marketKey);
                            } else {
                              newExpanded.add(marketKey);
                            }
                            setExpandedMarkets(newExpanded);
                          }}
                        >
                          <h3 className="text-white font-semibold text-sm">{market.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{sortedOptions.length} seçenek</span>
                            <svg 
                              className={`w-4 h-4 text-gray-400 transition-transform ${isMarketExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        {isMarketExpanded && (
                          <div className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {sortedOptions.map((opt, optIdx) => {
                                const selected = isSelected(match.id, market.originalName || market.name, opt.label);
                                const oddsValue = opt.value;
                              
                              // Get odds change indicator
                                const oddsChange = getOddsChange(market.originalName || market.name, opt.label);
                                
                                // Translate option labels - opt.label is already normalized (1, X, 2 or original)
                                let displayLabel = opt.label;
                                // If it's already 1/X/2, keep it
                                if (opt.label === '1' || opt.label === 'X' || opt.label === '2') {
                                  displayLabel = opt.label;
                                } else {
                                  // For player goalscorer markets, check if label is just "Home" or "Away"
                                  const marketNameLower = (market.name || '').toLowerCase();
                                  const labelLower = (opt.label || '').toLowerCase().trim();
                                  
                                  if ((marketNameLower.includes('ilk golü atan') || marketNameLower.includes('first goalscorer') || 
                                       marketNameLower.includes('oyuncu gol')) && 
                                      (labelLower === 'home' || labelLower === 'away')) {
                                    // For player markets, "Home" or "Away" should be translated to team names or "Ev Sahibi"/"Deplasman"
                                    displayLabel = labelLower === 'home' ? 'Ev Sahibi' : 'Deplasman';
                                  } else {
                                    // Otherwise translate to Turkish
                                    displayLabel = translateOptionLabel(opt.label, match?.homeTeam, match?.awayTeam);
                                  }
                                }
                              
                              return (
                                <button
                                  key={`${market.name}-${opt.label}-${optIdx}`}
                                    onClick={() => addSelection(match, market.originalName || market.name, opt.label, oddsValue)}
                                    className={`py-3 px-4 rounded-lg text-center transition-all ${
                                    selected
                                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 font-semibold'
                                        : 'bg-[#1a2332] hover:bg-[#2a3a4d] text-white border border-transparent hover:border-amber-500/30'
                                  }`}
                                >
                                    <div className="text-xs text-gray-400 mb-1.5 font-medium">{displayLabel}</div>
                                    <div className="font-bold text-lg flex items-center justify-center gap-1.5">
                                    {oddsChange && oddsChange.direction === 'up' && (
                                        <ArrowUp size={16} className="text-green-500" />
                                    )}
                                    {oddsChange && oddsChange.direction === 'down' && (
                                        <ArrowDown size={16} className="text-red-500" />
                                    )}
                                    {oddsValue.toFixed(2)}
                                    </div>
                                </button>
                              );
                            })}
                        </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    {(matchWithOdds?.markets || match?.markets) && (matchWithOdds?.markets || match?.markets).length > 0 
                      ? 'Bu kategoride bahis bulunamadı'
                      : 'Bu maç için bahis oranları henüz mevcut değil'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-3">
              {eventsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-gray-500 mt-2">Olaylar yükleniyor...</p>
                </div>
              ) : eventsError ? (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-500 text-sm">{eventsError}</p>
                </div>
              ) : events && events.length > 0 ? (
                events
                  .sort((a, b) => {
                    const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
                    const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
                    return bMin - aMin;
                  })
                  .map((event, idx) => {
                    const minute = event.minute || event.time || event.elapsed || '?';
                    
                    // Event type can be nested: event.type.name or direct: event.type
                    const type = (
                      event.type?.name || 
                      event.type?.type ||
                      (typeof event.type === 'string' ? event.type : '') ||
                      event.event_type?.name ||
                      event.event_type?.type ||
                      (typeof event.event_type === 'string' ? event.event_type : '') ||
                      ''
                    );
                    
                    // Player can be nested: event.player.name or direct: event.player
                    const player = (
                      event.player?.name || 
                      (typeof event.player === 'string' ? event.player : '') ||
                      event.player_name || 
                      ''
                    );
                    
                    // For substitutions, get player_out and player_in
                    const playerOut = (
                      event.player_out?.name ||
                      (typeof event.player_out === 'string' ? event.player_out : '') ||
                      event.player_out_name ||
                      event.player_name || // Fallback to player_name for substitution
                      player
                    );
                    
                    const playerIn = (
                      event.player_in?.name ||
                      (typeof event.player_in === 'string' ? event.player_in : '') ||
                      event.player_in_name ||
                      event.related_player_name || // API uses related_player_name for substitution
                      event.related_player?.name ||
                      ''
                    );
                    
                    // Team can be nested: event.team.name or direct: event.team
                    const team = (
                      event.team?.name || 
                      (typeof event.team === 'string' ? event.team : '') ||
                      event.team_name || 
                      ''
                    );
                    
                    const isHome = team === match.homeTeam;
                    
                    let icon = '⚽';
                    let typeText = type;
                    let displayText = player || 'Oyuncu';
                    
                    // Translate event types to Turkish
                    const typeLower = type.toLowerCase();
                    if (typeLower.includes('card') || typeLower.includes('kart')) {
                      if (typeLower.includes('yellow') || typeLower.includes('sarı')) {
                        icon = '🟨';
                        typeText = 'Sarı Kart';
                      } else {
                        icon = '🟥';
                        typeText = 'Kırmızı Kart';
                      }
                    } else if (typeLower.includes('sub') || typeLower.includes('değişiklik') || typeLower.includes('substitution')) {
                      icon = '🔄';
                      typeText = 'Oyuncu Değişikliği';
                      // For substitutions, show "PlayerOut → PlayerIn"
                      if (playerOut && playerIn) {
                        displayText = `${playerOut} → ${playerIn}`;
                      } else if (playerOut) {
                        displayText = `${playerOut} çıktı`;
                      } else if (playerIn) {
                        displayText = `${playerIn} girdi`;
                      }
                    } else if (typeLower.includes('goal') || typeLower.includes('gol')) {
                      icon = '⚽';
                      typeText = 'Gol';
                    } else if (typeLower.includes('penalty') || typeLower.includes('penaltı')) {
                      icon = '⚽';
                      typeText = 'Penaltı';
                    } else if (typeLower.includes('corner') || typeLower.includes('korner')) {
                      icon = '📐';
                      typeText = 'Korner';
                    } else if (typeLower.includes('offside') || typeLower.includes('ofsayt')) {
                      icon = '🚩';
                      typeText = 'Ofsayt';
                    } else if (type) {
                      // Keep original if no match
                      typeText = type;
                    }
                    
                    return (
                      <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg ${isHome ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                        <span className="text-base">{icon}</span>
                        <div className="flex-1">
                          <div className="text-white font-medium text-sm">{displayText}</div>
                          <div className="text-xs text-gray-400">{typeText}</div>
                        </div>
                        <span className="text-gray-400 font-medium text-xs">{minute}'</span>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {match?.isLive ? 'Henüz olay yok' : shouldFetchEvents ? 'Bu maç için olay bulunamadı' : 'Maç başlamadığı için olaylar henüz mevcut değil'}
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div>
              {statsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-gray-500 mt-2">İstatistikler yükleniyor...</p>
                </div>
              ) : statsError ? (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-500 text-sm">{statsError}</p>
                </div>
              ) : statistics ? (
                <div className="space-y-4">
                  {/* Possession */}
                  {statistics.possession && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.possession[0] || statistics.possession.home || 0}%</span>
                        <span className="text-gray-500">Topa Sahip Olma</span>
                        <span className="text-white font-medium">{statistics.possession[1] || statistics.possession.away || 0}%</span>
                      </div>
                      <Progress value={statistics.possession[0] || statistics.possession.home || 0} className="h-2 bg-[#1a2332]" />
                    </div>
                  )}

                  {/* Shots */}
                  {statistics.shots && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.shots[0] || statistics.shots.home || 0}</span>
                        <span className="text-gray-500">Toplam Şut</span>
                        <span className="text-white font-medium">{statistics.shots[1] || statistics.shots.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.shots[0] || statistics.shots.home || 0) / ((statistics.shots[0] || statistics.shots.home || 0) + (statistics.shots[1] || statistics.shots.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Shots on Target */}
                  {statistics.shotsOnTarget && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.shotsOnTarget[0] || statistics.shotsOnTarget.home || 0}</span>
                        <span className="text-gray-500">Kaleye Atılan Şut</span>
                        <span className="text-white font-medium">{statistics.shotsOnTarget[1] || statistics.shotsOnTarget.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.shotsOnTarget[0] || statistics.shotsOnTarget.home || 0) / ((statistics.shotsOnTarget[0] || statistics.shotsOnTarget.home || 0) + (statistics.shotsOnTarget[1] || statistics.shotsOnTarget.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Corners */}
                  {statistics.corners && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.corners[0] || statistics.corners.home || 0}</span>
                        <span className="text-gray-500">Korner</span>
                        <span className="text-white font-medium">{statistics.corners[1] || statistics.corners.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.corners[0] || statistics.corners.home || 0) / ((statistics.corners[0] || statistics.corners.home || 0) + (statistics.corners[1] || statistics.corners.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Yellow Cards */}
                  {statistics.yellowCards && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.yellowCards[0] || statistics.yellowCards.home || 0}</span>
                        <span className="text-gray-500">🟨 Sarı Kart</span>
                        <span className="text-white font-medium">{statistics.yellowCards[1] || statistics.yellowCards.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-yellow-500 rounded" style={{ width: `${((statistics.yellowCards[0] || statistics.yellowCards.home || 0) / ((statistics.yellowCards[0] || statistics.yellowCards.home || 0) + (statistics.yellowCards[1] || statistics.yellowCards.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Red Cards */}
                  {statistics.redCards && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.redCards[0] || statistics.redCards.home || 0}</span>
                        <span className="text-gray-500">🟥 Kırmızı Kart</span>
                        <span className="text-white font-medium">{statistics.redCards[1] || statistics.redCards.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-red-500 rounded" style={{ width: `${((statistics.redCards[0] || statistics.redCards.home || 0) / ((statistics.redCards[0] || statistics.redCards.home || 0) + (statistics.redCards[1] || statistics.redCards.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Offsides */}
                  {statistics.offsides && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.offsides[0] || statistics.offsides.home || 0}</span>
                        <span className="text-gray-500">Ofsayt</span>
                        <span className="text-white font-medium">{statistics.offsides[1] || statistics.offsides.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.offsides[0] || statistics.offsides.home || 0) / ((statistics.offsides[0] || statistics.offsides.home || 0) + (statistics.offsides[1] || statistics.offsides.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Fouls */}
                  {statistics.fouls && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.fouls[0] || statistics.fouls.home || 0}</span>
                        <span className="text-gray-500">Faul</span>
                        <span className="text-white font-medium">{statistics.fouls[1] || statistics.fouls.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.fouls[0] || statistics.fouls.home || 0) / ((statistics.fouls[0] || statistics.fouls.home || 0) + (statistics.fouls[1] || statistics.fouls.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Saves */}
                  {statistics.saves && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.saves[0] || statistics.saves.home || 0}</span>
                        <span className="text-gray-500">Kurtarış</span>
                        <span className="text-white font-medium">{statistics.saves[1] || statistics.saves.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.saves[0] || statistics.saves.home || 0) / ((statistics.saves[0] || statistics.saves.home || 0) + (statistics.saves[1] || statistics.saves.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Passes */}
                  {statistics.passes && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.passes[0] || statistics.passes.home || 0}</span>
                        <span className="text-gray-500">Pas</span>
                        <span className="text-white font-medium">{statistics.passes[1] || statistics.passes.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.passes[0] || statistics.passes.home || 0) / ((statistics.passes[0] || statistics.passes.home || 0) + (statistics.passes[1] || statistics.passes.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}

                  {/* Pass Accuracy */}
                  {statistics.passAccuracy && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.passAccuracy[0] || statistics.passAccuracy.home || 0}%</span>
                        <span className="text-gray-500">Pas İsabeti</span>
                        <span className="text-white font-medium">{statistics.passAccuracy[1] || statistics.passAccuracy.away || 0}%</span>
                      </div>
                      <Progress value={statistics.passAccuracy[0] || statistics.passAccuracy.home || 0} className="h-2 bg-[#1a2332]" />
                    </div>
                  )}

                  {/* Attacks */}
                  {statistics.attacks && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white font-medium">{statistics.attacks[0] || statistics.attacks.home || 0}</span>
                        <span className="text-gray-500">Atak</span>
                        <span className="text-white font-medium">{statistics.attacks[1] || statistics.attacks.away || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 bg-amber-500 rounded" style={{ width: `${((statistics.attacks[0] || statistics.attacks.home || 0) / ((statistics.attacks[0] || statistics.attacks.home || 0) + (statistics.attacks[1] || statistics.attacks.away || 0) || 1)) * 100}%` }}></div>
                        <div className="h-2 bg-blue-500 rounded flex-1"></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {shouldFetchEvents ? 'İstatistik bilgisi henüz mevcut değil' : 'Maç başlamadığı için istatistikler henüz mevcut değil'}
                </div>
              )}
            </div>
          )}

          {/* Lineups Tab */}
          {activeTab === 'lineups' && (
            <div>
              {lineupsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-gray-500 mt-2">Kadrolar yükleniyor...</p>
        </div>
              ) : lineupsError ? (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-500 text-sm">{lineupsError}</p>
                </div>
              ) : lineups && (lineups.home || lineups.away) ? (
                <div className="space-y-6">
                  {/* Home Team Lineup */}
                  {lineups.home && (lineups.home.startingXI?.length > 0 || lineups.home.substitutes?.length > 0) && (
                    <div>
                      <h3 className="text-white font-semibold mb-3 text-lg">{match.homeTeam}</h3>
                      <div className="bg-[#0a0e14] border border-[#1e2736] rounded-lg p-4">
                        {lineups.home.startingXI && Array.isArray(lineups.home.startingXI) && lineups.home.startingXI.length > 0 ? (
                          <div>
                            <h4 className="text-gray-400 text-sm mb-3 font-medium">İlk 11</h4>
                            <div className="space-y-2">
                              {lineups.home.startingXI.map((player, idx) => {
                                const playerName = player.name || player.player_name || player.player?.name || 'Oyuncu';
                                const positionRaw = player.position || player.pos || player.position_name || '';
                                const position = translatePosition(positionRaw);
                                const jerseyNumber = player.jersey_number || player.number || '';
                                const playerImage = player.image || player.player?.image_path || '';
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-[#1a2332] transition-colors border border-transparent hover:border-[#2a3a4d]">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {playerImage ? (
                                        <img 
                                          src={playerImage} 
                                          alt={playerName}
                                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-10 h-10 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                        <span className="text-gray-400 text-xs font-medium">
                                          {jerseyNumber || playerName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-white font-medium truncate">{playerName}</span>
                                        {jerseyNumber && (
                                          <span className="text-gray-500 text-xs">#{jerseyNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {position && (
                                      <span className="text-gray-300 text-xs bg-[#1a2332] px-3 py-1.5 rounded-full border border-[#2a3a4d] flex-shrink-0 ml-2">{position}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Kadro bilgisi mevcut değil</p>
                        )}
                        
                        {/* Substitutes */}
                        {lineups.home.substitutes && Array.isArray(lineups.home.substitutes) && lineups.home.substitutes.length > 0 && (
                          <div className="mt-6">
                            <h4 className="text-gray-400 text-sm mb-3 font-medium">Yedekler</h4>
                            <div className="space-y-2">
                              {lineups.home.substitutes.map((player, idx) => {
                                const playerName = player.name || player.player_name || player.player?.name || 'Oyuncu';
                                const positionRaw = player.position || player.pos || player.position_name || '';
                                const position = translatePosition(positionRaw);
                                const jerseyNumber = player.jersey_number || player.number || '';
                                const playerImage = player.image || player.player?.image_path || '';
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-[#1a2332] transition-colors border border-transparent hover:border-[#2a3a4d]">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {playerImage ? (
                                        <img 
                                          src={playerImage} 
                                          alt={playerName}
                                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-10 h-10 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                        <span className="text-gray-400 text-xs font-medium">
                                          {jerseyNumber || playerName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-white font-medium truncate">{playerName}</span>
                                        {jerseyNumber && (
                                          <span className="text-gray-500 text-xs">#{jerseyNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {position && (
                                      <span className="text-gray-300 text-xs bg-[#1a2332] px-3 py-1.5 rounded-full border border-[#2a3a4d] flex-shrink-0 ml-2">{position}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Away Team Lineup */}
                  {lineups.away && (lineups.away.startingXI?.length > 0 || lineups.away.substitutes?.length > 0) && (
                    <div>
                      <h3 className="text-white font-semibold mb-3 text-lg">{match.awayTeam}</h3>
                      <div className="bg-[#0a0e14] border border-[#1e2736] rounded-lg p-4">
                        {lineups.away.startingXI && Array.isArray(lineups.away.startingXI) && lineups.away.startingXI.length > 0 ? (
                          <div>
                            <h4 className="text-gray-400 text-sm mb-3 font-medium">İlk 11</h4>
                            <div className="space-y-2">
                              {lineups.away.startingXI.map((player, idx) => {
                                const playerName = player.name || player.player_name || player.player?.name || 'Oyuncu';
                                const positionRaw = player.position || player.pos || player.position_name || '';
                                const position = translatePosition(positionRaw);
                                const jerseyNumber = player.jersey_number || player.number || '';
                                const playerImage = player.image || player.player?.image_path || '';
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-[#1a2332] transition-colors border border-transparent hover:border-[#2a3a4d]">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {playerImage ? (
                                        <img 
                                          src={playerImage} 
                                          alt={playerName}
                                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-10 h-10 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                        <span className="text-gray-400 text-xs font-medium">
                                          {jerseyNumber || playerName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-white font-medium truncate">{playerName}</span>
                                        {jerseyNumber && (
                                          <span className="text-gray-500 text-xs">#{jerseyNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {position && (
                                      <span className="text-gray-300 text-xs bg-[#1a2332] px-3 py-1.5 rounded-full border border-[#2a3a4d] flex-shrink-0 ml-2">{position}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Kadro bilgisi mevcut değil</p>
                        )}
                        
                        {/* Substitutes */}
                        {lineups.away.substitutes && Array.isArray(lineups.away.substitutes) && lineups.away.substitutes.length > 0 && (
                          <div className="mt-6">
                            <h4 className="text-gray-400 text-sm mb-3 font-medium">Yedekler</h4>
                            <div className="space-y-2">
                              {lineups.away.substitutes.map((player, idx) => {
                                const playerName = player.name || player.player_name || player.player?.name || 'Oyuncu';
                                const positionRaw = player.position || player.pos || player.position_name || '';
                                const position = translatePosition(positionRaw);
                                const jerseyNumber = player.jersey_number || player.number || '';
                                const playerImage = player.image || player.player?.image_path || '';
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-[#1a2332] transition-colors border border-transparent hover:border-[#2a3a4d]">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {playerImage ? (
                                        <img 
                                          src={playerImage} 
                                          alt={playerName}
                                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-10 h-10 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                        <span className="text-gray-400 text-xs font-medium">
                                          {jerseyNumber || playerName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-white font-medium truncate">{playerName}</span>
                                        {jerseyNumber && (
                                          <span className="text-gray-500 text-xs">#{jerseyNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {position && (
                                      <span className="text-gray-300 text-xs bg-[#1a2332] px-3 py-1.5 rounded-full border border-[#2a3a4d] flex-shrink-0 ml-2">{position}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {(!lineups.home || (lineups.home.startingXI?.length === 0 && lineups.home.substitutes?.length === 0)) && 
                   (!lineups.away || (lineups.away.startingXI?.length === 0 && lineups.away.substitutes?.length === 0)) && (
                    <div className="text-center py-8 text-gray-500">
                      Kadro bilgisi henüz mevcut değil
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Kadro bilgisi henüz mevcut değil
                </div>
              )}
            </div>
          )}

          {/* Injuries Tab */}
          {activeTab === 'injuries' && (
            <div>
              {injuriesLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-gray-500 mt-2">Sakatlıklar yükleniyor...</p>
                </div>
              ) : injuriesError ? (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-500 text-sm">{injuriesError}</p>
                </div>
              ) : injuries && injuries.length > 0 ? (
                <div className="space-y-6">
                  {/* Home Team Injuries */}
                  {homeInjuries && homeInjuries.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold mb-3 text-lg">{match?.homeTeam || match?.home_team || 'Ev Sahibi'}</h3>
                      <div className="space-y-3">
                        {homeInjuries.map((injury, idx) => {
                          const playerName = injury.player_name || 'Oyuncu';
                          const playerImage = injury.player_image;
                          const injuryType = injury.type || 'Sakatlık';
                          const description = injury.description || '';
                          const returnDate = injury.return_date || '';
                          
                          return (
                            <div key={idx} className="bg-[#0a0e14] border border-[#1e2736] rounded-lg p-4 hover:border-[#2a3a4d] transition-colors">
                              <div className="flex items-center gap-3 mb-2">
                                {/* Player Image */}
                                {playerImage ? (
                                  <img 
                                    src={playerImage} 
                                    alt={playerName}
                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-12 h-12 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                  <span className="text-gray-400 text-sm font-medium">
                                    {playerName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                {/* Player Name and Type */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white font-medium truncate">{playerName}</span>
                                    <span className="text-xs text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30 flex-shrink-0">
                                      {injuryType}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {description && (
                                <p className="text-sm text-gray-400 mt-2 ml-[60px]">
                                  {description}
                                </p>
                              )}
                              {returnDate && (
                                <p className="text-sm text-gray-400 mt-2 ml-[60px]">
                                  <span className="text-gray-500">Tahmini Dönüş:</span> {returnDate}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Away Team Injuries */}
                  {awayInjuries && awayInjuries.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold mb-3 text-lg">{match?.awayTeam || match?.away_team || 'Deplasman'}</h3>
                      <div className="space-y-3">
                        {awayInjuries.map((injury, idx) => {
                          const playerName = injury.player_name || 'Oyuncu';
                          const playerImage = injury.player_image;
                          const injuryType = injury.type || 'Sakatlık';
                          const description = injury.description || '';
                          const returnDate = injury.return_date || '';
                          
                          return (
                            <div key={idx} className="bg-[#0a0e14] border border-[#1e2736] rounded-lg p-4 hover:border-[#2a3a4d] transition-colors">
                              <div className="flex items-center gap-3 mb-2">
                                {/* Player Image */}
                                {playerImage ? (
                                  <img 
                                    src={playerImage} 
                                    alt={playerName}
                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-[#2a3a4d]"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-12 h-12 rounded-full bg-[#1a2332] border border-[#2a3a4d] flex items-center justify-center flex-shrink-0 ${playerImage ? 'hidden' : 'flex'}`}>
                                  <span className="text-gray-400 text-sm font-medium">
                                    {playerName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                {/* Player Name and Type */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white font-medium truncate">{playerName}</span>
                                    <span className="text-xs text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30 flex-shrink-0">
                                      {injuryType}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {description && (
                                <p className="text-sm text-gray-400 mt-2 ml-[60px]">
                                  {description}
                                </p>
                              )}
                              {returnDate && (
                                <p className="text-sm text-gray-400 mt-2 ml-[60px]">
                                  <span className="text-gray-500">Tahmini Dönüş:</span> {returnDate}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Sakatlık bilgisi bulunmuyor
                </div>
              )}
            </div>
          )}

          {/* Standings Tab */}
          {activeTab === 'standings' && (
            <div>
              {standingsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-gray-500 mt-2">Puan durumu yükleniyor...</p>
                </div>
              ) : standingsError ? (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-500 text-sm">{standingsError}</p>
                </div>
              ) : standings && standings.table && Array.isArray(standings.table) && standings.table.length > 0 ? (
                <div className="bg-[#0d1117] border border-[#1e2736] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#1a2332] border-b border-[#1e2736]">
                        <tr>
                          <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-medium">#</th>
                          <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-medium">Takım</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">O</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">G</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">B</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">M</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">A</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">Y</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">A.O</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">Y.O</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium">P.O</th>
                          <th className="text-center p-3 text-xs sm:text-sm text-gray-400 font-medium font-bold">P</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.table.map((team, idx) => {
                          const isHomeTeam = team.team_name === match?.homeTeam || team.team_id === homeTeamId;
                          const isAwayTeam = team.team_name === match?.awayTeam || team.team_id === awayTeamId;
                          const isMatchTeam = isHomeTeam || isAwayTeam;
                          
                          return (
                            <tr 
                              key={team.team_id || idx} 
                              className={`border-b border-[#1e2736] hover:bg-[#1a2332] transition-colors ${
                                isMatchTeam ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              <td className="p-3 text-xs sm:text-sm text-white font-medium">{team.position || idx + 1}</td>
                              <td className="p-3 text-xs sm:text-sm text-white font-medium">
                                <div className="flex items-center gap-2">
                                  {team.team_logo ? (
                                    <img 
                                      src={team.team_logo} 
                                      alt={team.team_name || 'Takım'}
                                      className="w-6 h-6 object-contain flex-shrink-0"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                  <span>
                                    {isMatchTeam && <span className="text-amber-500 mr-1">•</span>}
                                    {team.team_name || team.name || 'Takım'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.played || team.matches_played || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-green-400">{team.won || team.wins || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.drawn || team.draws || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-red-400">{team.lost || team.losses || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_for || team.goals_scored || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.goals_against || 0}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.avg_goals_for !== undefined && team.avg_goals_for !== null ? team.avg_goals_for.toFixed(2) : '-'}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.avg_goals_against !== undefined && team.avg_goals_against !== null ? team.avg_goals_against.toFixed(2) : '-'}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-gray-300">{team.avg_points !== undefined && team.avg_points !== null ? team.avg_points.toFixed(2) : '-'}</td>
                              <td className="p-3 text-xs sm:text-sm text-center text-amber-500 font-bold">{team.points || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Bu lig için puan durumu bulunamadı
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailPage;
