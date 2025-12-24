/**
 * Match Data Mapper
 * Transforms The Odds API response format to our internal match structure
 */

/**
 * Map API response to internal match structure
 * @param {Object} apiMatch - Match object from The Odds API or StatPal API
 * @returns {Object} Internal match structure
 */
export function mapApiMatchToInternal(apiMatch) {
  if (!apiMatch) return null;
  
  // Check if this is a StatPal API response
  if (apiMatch.main_id || (apiMatch.home && typeof apiMatch.home === 'object' && apiMatch.home.name)) {
    return mapStatPalMatchToInternal(apiMatch);
  }
  
  // Otherwise, treat as The Odds API response
  
  // The Odds API response structure:
  // {
  //   id, sport_key, commence_time, home_team, away_team,
  //   bookmakers: [{ key, title, markets: [{ key: "h2h", outcomes: [{ name, price }] }] }]
  // }
  
  // Extract h2h market from first bookmaker (or best available)
  const h2hMarket = extractH2HMarket(apiMatch.bookmakers, apiMatch.home_team, apiMatch.away_team);
  
  // Parse commence_time (ISO 8601 format: "2021-09-10T00:20:00Z")
  const commenceTime = apiMatch.commence_time ? new Date(apiMatch.commence_time) : null;
  const date = commenceTime ? formatDateFromISO(commenceTime) : '';
  const time = commenceTime ? formatTimeFromISO(commenceTime) : '';
  
  // Extract odds from h2h market outcomes
  const homeOdds = h2hMarket?.home || null;
  const drawOdds = h2hMarket?.draw || null;
  const awayOdds = h2hMarket?.away || null;
  
  // Build markets array
  const markets = [];
  if (homeOdds || drawOdds || awayOdds) {
    markets.push({
      name: 'Maç Sonucu',
      options: [
        ...(homeOdds ? [{ label: '1', value: parseFloat(homeOdds) }] : []),
        ...(drawOdds ? [{ label: 'X', value: parseFloat(drawOdds) }] : []),
        ...(awayOdds ? [{ label: '2', value: parseFloat(awayOdds) }] : []),
      ],
    });
  }
  
  // Get league name from sport_key
  const league = getLeagueNameFromSportKey(apiMatch.sport_key);
  const leagueFlag = getLeagueFlagFromSportKey(apiMatch.sport_key);
  
  // Extract live scores if available (from Scores API - paid plans only)
  let homeScore = 0;
  let awayScore = 0;
  let isLive = false;
  let minute = null;
  
  // Check if this is a live match with scores (from Scores API)
  if (apiMatch.scores && Array.isArray(apiMatch.scores)) {
    // Scores API format: [{ name: "Team Name", score: 2 }]
    const homeTeamName = apiMatch.home_team?.toLowerCase() || '';
    const awayTeamName = apiMatch.away_team?.toLowerCase() || '';
    
    for (const scoreData of apiMatch.scores) {
      const scoreName = (scoreData.name || '').toLowerCase();
      const score = scoreData.score;
      
      if (scoreName === homeTeamName || homeTeamName.includes(scoreName) || scoreName.includes(homeTeamName)) {
        homeScore = score || 0;
      } else if (scoreName === awayTeamName || awayTeamName.includes(scoreName) || scoreName.includes(awayTeamName)) {
        awayScore = score || 0;
      }
    }
    
    // Determine if match is live
    // Scores API provides: completed (false = live, true = finished)
    // or is_live flag from merged data
    if (apiMatch.is_live === true || apiMatch.completed === false) {
      isLive = true;
      // Try to extract minute from last_update or estimate from commence_time
      if (apiMatch.last_update && commenceTime) {
        const lastUpdate = new Date(apiMatch.last_update);
        if (!isNaN(commenceTime.getTime()) && !isNaN(lastUpdate.getTime())) {
          const diffMinutes = Math.floor((lastUpdate - commenceTime) / (1000 * 60));
          if (diffMinutes > 0 && diffMinutes <= 120) { // Max 120 minutes for soccer
            minute = diffMinutes;
          }
        }
      }
    }
  }
  
  return {
    id: apiMatch.id || '',
    league: league,
    leagueFlag: leagueFlag,
    sportKey: apiMatch.sport_key || '', // Add sport_key for filtering
    homeTeam: apiMatch.home_team || 'Home Team',
    awayTeam: apiMatch.away_team || 'Away Team',
    homeTeamLogo: null, // The Odds API doesn't provide logos
    awayTeamLogo: null,
    homeScore: homeScore,
    awayScore: awayScore,
    minute: minute,
    isLive: isLive,
    time: time,
    date: date,
    odds: {
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds,
    },
    markets: markets,
    stats: null,
  };
}

/**
 * Extract h2h (head-to-head) market from bookmakers
 * Returns { home, draw, away } odds from the first bookmaker that has h2h market
 */
function extractH2HMarket(bookmakers, homeTeam, awayTeam) {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
    return null;
  }
  
  // Find first bookmaker with h2h market
  for (const bookmaker of bookmakers) {
    if (!bookmaker.markets || !Array.isArray(bookmaker.markets)) {
      continue;
    }
    
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    if (!h2hMarket || !h2hMarket.outcomes) {
      continue;
    }
    
    // Map outcomes to home/draw/away
    const result = { home: null, draw: null, away: null };
    
    // The Odds API h2h outcomes are typically ordered: home_team, draw (if exists), away_team
    // First try to match by team names, then fallback to position-based logic
    
    // The Odds API outcomes order is NOT guaranteed (home, draw, away)
    // We MUST match by team names, not by position
    
    // First, identify draw outcome
    for (const outcome of h2hMarket.outcomes) {
      const name = outcome.name || '';
      const price = outcome.price;
      
      // Check if it's a draw outcome
      if (name.toLowerCase().includes('draw') || name === 'X' || name === 'Draw') {
        result.draw = price;
        break;
      }
    }
    
    // Then match team names - The Odds API outcomes order is NOT guaranteed
    // We MUST match by team names, not by position
    for (const outcome of h2hMarket.outcomes) {
      const name = outcome.name || '';
      const price = outcome.price;
      
      // Skip if already identified as draw
      if (name.toLowerCase().includes('draw') || name === 'X' || name === 'Draw') {
        continue;
      }
      
      // Match by team names (case-insensitive)
      const nameLower = name.toLowerCase().trim();
      
      if (homeTeam) {
        const homeLower = homeTeam.toLowerCase().trim();
        
        // Exact match (most reliable)
        if (nameLower === homeLower) {
          result.home = price;
          continue;
        }
        
        // Contains match (for variations like "Kasimpasa SK" vs "Kasimpasa")
        if (nameLower.includes(homeLower) || homeLower.includes(nameLower)) {
          // Only assign if not already assigned
          if (result.home === null) {
            result.home = price;
            continue;
          }
        }
      }
      
      if (awayTeam) {
        const awayLower = awayTeam.toLowerCase().trim();
        
        // Exact match
        if (nameLower === awayLower) {
          result.away = price;
          continue;
        }
        
        // Contains match
        if (nameLower.includes(awayLower) || awayLower.includes(nameLower)) {
          // Only assign if not already assigned
          if (result.away === null) {
            result.away = price;
            continue;
          }
        }
      }
    }
    
    // Final fallback: If we still have null values, use position-based logic
    // But ONLY if team name matching completely failed
    if (h2hMarket.outcomes.length === 2) {
      // Two outcomes: assume first is home, second is away (no draw)
      if (result.home === null && result.away === null) {
        result.home = h2hMarket.outcomes[0]?.price || null;
        result.away = h2hMarket.outcomes[1]?.price || null;
      } else if (result.home === null) {
        // Only home is missing, use first non-draw outcome
        result.home = h2hMarket.outcomes.find(o => 
          !o.name?.toLowerCase().includes('draw') && o.name !== 'X' && o.name !== 'Draw'
        )?.price || h2hMarket.outcomes[0]?.price || null;
      } else if (result.away === null) {
        // Only away is missing, use last non-draw outcome
        const nonDrawOutcomes = h2hMarket.outcomes.filter(o => 
          !o.name?.toLowerCase().includes('draw') && o.name !== 'X' && o.name !== 'Draw'
        );
        result.away = nonDrawOutcomes[nonDrawOutcomes.length - 1]?.price || h2hMarket.outcomes[1]?.price || null;
      }
    } else if (h2hMarket.outcomes.length === 3) {
      // Three outcomes: try to identify by process of elimination
      const nonDrawOutcomes = h2hMarket.outcomes.filter(o => 
        !o.name?.toLowerCase().includes('draw') && o.name !== 'X' && o.name !== 'Draw'
      );
      
      if (result.home === null && result.away === null && result.draw === null) {
        // Complete failure - use position as last resort
        result.home = h2hMarket.outcomes[0]?.price || null;
        result.draw = h2hMarket.outcomes[1]?.price || null;
        result.away = h2hMarket.outcomes[2]?.price || null;
      } else {
        // Fill missing ones
        if (result.home === null && nonDrawOutcomes.length >= 1) {
          result.home = nonDrawOutcomes[0]?.price || null;
        }
        if (result.away === null && nonDrawOutcomes.length >= 2) {
          result.away = nonDrawOutcomes[nonDrawOutcomes.length - 1]?.price || null;
        }
      }
    }
    
    return result;
  }
  
  return null;
}

/**
 * Get league name from sport_key
 */
function getLeagueNameFromSportKey(sportKey) {
  if (!sportKey) return 'Unknown League';
  
  const leagueMap = {
    'soccer_turkey_super_league': 'Süper Lig',
    'soccer_epl': 'Premier League',
    'soccer_spain_la_liga': 'La Liga',
    'soccer_italy_serie_a': 'Serie A',
    'soccer_germany_bundesliga': 'Bundesliga',
    'soccer_france_ligue_one': 'Ligue 1',
  };
  
  return leagueMap[sportKey] || sportKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get league flag from sport_key
 */
function getLeagueFlagFromSportKey(sportKey) {
  if (!sportKey) return '🏆';
  
  const flagMap = {
    'soccer_turkey_super_league': '🇹🇷',
    'soccer_epl': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'soccer_spain_la_liga': '🇪🇸',
    'soccer_italy_serie_a': '🇮🇹',
    'soccer_germany_bundesliga': '🇩🇪',
    'soccer_france_ligue_one': '🇫🇷',
  };
  
  return flagMap[sportKey] || '🏆';
}

/**
 * Map multiple API matches to internal structure
 * @param {Array} apiMatches - Array of match objects from NosyAPI
 * @returns {Array} Array of internal match structures
 */
export function mapApiMatchesToInternal(apiMatches) {
  if (!Array.isArray(apiMatches)) {
    return [];
  }
  return apiMatches.map(mapApiMatchToInternal);
}

/**
 * Determine if a match is live based on API data
 * @param {Object} apiMatch - Match object from API
 * @returns {boolean} Whether the match is live
 */
function determineIfLive(apiMatch) {
  // NosyAPI uses LiveStatus field: 1 = live, 0 = not live
  if (apiMatch.LiveStatus !== undefined) {
    return apiMatch.LiveStatus === 1;
  }
  if (apiMatch.liveStatus !== undefined) {
    return apiMatch.liveStatus === 1;
  }
  // Fallback to other methods
  if (apiMatch.isLive !== undefined) return apiMatch.isLive;
  if (apiMatch.status === 'live' || apiMatch.status === 'LIVE') return true;
  if (apiMatch.minute !== undefined && apiMatch.minute !== null) return true;
  
  return false;
}

/**
 * Map odds data to internal structure
 * @param {Object} oddsData - Odds data from API
 * @returns {Object} Internal odds structure
 */
function mapOdds(oddsData) {
  // NosyAPI uses HomeWin, Draw, AwayWin fields directly
  if (!oddsData) return { home: null, draw: null, away: null };
  
  return {
    home: oddsData.HomeWin || oddsData.homeWin || oddsData.home || oddsData['1'] || null,
    draw: oddsData.Draw || oddsData.draw || oddsData['X'] || oddsData['0'] || null,
    away: oddsData.AwayWin || oddsData.awayWin || oddsData.away || oddsData['2'] || null,
  };
}

/**
 * Map markets data to internal structure
 * @param {Object|Array} marketsData - Markets data from API
 * @returns {Array} Internal markets structure
 */
function mapMarkets(marketsData) {
  // TODO: Adjust based on actual API structure
  if (!marketsData) return [];
  
  // If it's already an array, map it
  if (Array.isArray(marketsData)) {
    return marketsData.map(market => ({
      name: market.name || market.marketName || 'Unknown Market',
      options: mapMarketOptions(market.options || market.odds || []),
    }));
  }
  
  // If it's an object, try to extract main market (1-X-2)
  const mainMarket = {
    name: 'Maç Sonucu',
    options: [
      { label: '1', value: marketsData.home || marketsData['1'] || 0 },
      { label: 'X', value: marketsData.draw || marketsData['X'] || marketsData['0'] || 0 },
      { label: '2', value: marketsData.away || marketsData['2'] || 0 },
    ].filter(opt => opt.value > 0),
  };
  
  return [mainMarket];
}

/**
 * Map market options to internal structure
 * @param {Array} options - Options from API
 * @returns {Array} Internal options structure
 */
function mapMarketOptions(options) {
  if (!Array.isArray(options)) return [];
  
  return options.map(opt => ({
    label: opt.label || opt.name || opt.option || '?',
    value: parseFloat(opt.value || opt.odds || opt.odd || 0),
  }));
}

/**
 * Map stats data to internal structure
 * @param {Object} statsData - Stats data from API
 * @returns {Object} Internal stats structure
 */
function mapStats(statsData) {
  // TODO: Adjust based on actual API structure
  if (!statsData) return null;
  
  return {
    possession: statsData.possession || [50, 50],
    shots: statsData.shots || [0, 0],
    corners: statsData.corners || [0, 0],
  };
}

/**
 * Get league flag emoji based on country/league name
 * @param {string} countryOrLeague - Country or league name
 * @returns {string} Flag emoji
 */
function getLeagueFlag(countryOrLeague) {
  if (!countryOrLeague) return '🏆';
  
  const flagMap = {
    'Türkiye': '🇹🇷',
    'Turkey': '🇹🇷',
    'İngiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'İspanya': '🇪🇸',
    'Spain': '🇪🇸',
    'İtalya': '🇮🇹',
    'Italy': '🇮🇹',
    'Almanya': '🇩🇪',
    'Germany': '🇩🇪',
    'Fransa': '🇫🇷',
    'France': '🇫🇷',
    'UEFA': '🇪🇺',
    'Avrupa': '🇪🇺',
    'ABD': '🇺🇸',
    'USA': '🇺🇸',
  };
  
  for (const [key, flag] of Object.entries(flagMap)) {
    if (countryOrLeague.includes(key)) {
      return flag;
    }
  }
  
  return '🏆';
}

/**
 * Format time from ISO 8601 date string
 * @param {Date} dateObj - Date object
 * @returns {string} Formatted time (HH:MM)
 */
function formatTimeFromISO(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  const hours = String(dateObj.getUTCHours()).padStart(2, '0');
  const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format date from ISO 8601 date string
 * @param {Date} dateObj - Date object
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function formatDateFromISO(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time string (legacy support for other formats)
 * @param {string} time - Time string from API
 * @returns {string} Formatted time (HH:MM)
 */
function formatTime(time) {
  if (!time) return '';
  
  // Handle HH:MM:SS format, convert to HH:MM
  if (typeof time === 'string' && time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return time.substring(0, 5); // Extract HH:MM
  }
  
  // If already in HH:MM format, return as is
  if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
    return time;
  }
  
  return time;
}

/**
 * Format date string (legacy support for other formats)
 * @param {string} date - Date string from API
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function formatDate(date) {
  if (!date) return '';
  // Handle YYYY-MM-DD format, return as is
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }
  // Handle DateTime format (YYYY-MM-DD HH:MM:SS)
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}\s/)) {
    return date.split(' ')[0];
  }
  // Handle StatPal format: "24.12.2025" -> "2025-12-24"
  if (typeof date === 'string' && date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    const [day, month, year] = date.split('.');
    return `${year}-${month}-${day}`;
  }
  return date;
}

/**
 * Map StatPal API match to internal structure
 * @param {Object} statpalMatch - Match object from StatPal API
 * @returns {Object} Internal match structure
 */
function mapStatPalMatchToInternal(statpalMatch) {
  if (!statpalMatch) return null;
  
  // StatPal API format:
  // {
  //   main_id, status, date: "24.12.2025", time: "15:30",
  //   home: {id, name, goals}, away: {id, name, goals},
  //   ht: {home_goals, away_goals}, ft: {home_goals, away_goals} or null,
  //   league_name, country
  // }
  
  const homeTeam = statpalMatch.home?.name || 'Home Team';
  const awayTeam = statpalMatch.away?.name || 'Away Team';
  
  // Get scores - StatPal API can have goals in different places:
  // 1. home.goals / away.goals (string, can be "?", "2", etc.)
  // 2. ht.home_goals / ht.away_goals (number, half-time score)
  // 3. ft.home_goals / ft.away_goals (number, full-time score)
  
  // Helper function to safely parse score
  const parseScore = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle "?" or empty strings
      if (value === '?' || value === '' || value.trim() === '') return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };
  
  // Get scores - prioritize ht/ft scores as they're more reliable
  // StatPal API structure:
  // - ht: {home_goals: number, away_goals: number} - half-time scores
  // - ft: {home_goals: number, away_goals: number} or null - full-time scores
  // - home.goals: string (can be "?", "2", etc.) - current score
  // - away.goals: string (can be "?", "1", etc.) - current score
  
  const status = String(statpalMatch.status || '').trim();
  let homeScore = null;
  let awayScore = null;
  
  // Priority 1: Use ft (full-time) scores if match is finished
  if (status === 'FT' && statpalMatch.ft) {
    homeScore = parseScore(statpalMatch.ft.home_goals);
    awayScore = parseScore(statpalMatch.ft.away_goals);
  }
  // Priority 2: Use ht (half-time) scores if available (for live matches)
  else if (statpalMatch.ht) {
    homeScore = parseScore(statpalMatch.ht.home_goals);
    awayScore = parseScore(statpalMatch.ht.away_goals);
  }
  
  // Priority 3: Fallback to home/away.goals if ht/ft not available
  if (homeScore === null) {
    homeScore = parseScore(statpalMatch.home?.goals);
  }
  if (awayScore === null) {
    awayScore = parseScore(statpalMatch.away?.goals);
  }
  
  // Final fallback: default to 0 if still null
  homeScore = homeScore === null ? 0 : homeScore;
  awayScore = awayScore === null ? 0 : awayScore;
  
  // Determine if match is live
  const status = String(statpalMatch.status || '').trim();
  let isLive = false;
  let minute = null;
  
  // Status can be:
  // - "FT" = Full Time (finished)
  // - "HT" = Half Time (live)
  // - "1" to "120" = minute number (live)
  // - "12:00" = future match time (not live)
  // - "Postp." = Postponed
  // - "Canc." = Cancelled
  
  if (status === 'HT') {
    isLive = true;
    minute = 45;
  } else if (status && !isNaN(parseInt(status))) {
    const statusNum = parseInt(status);
    if (statusNum > 0 && statusNum <= 120) {
      // It's a minute number (live match)
      isLive = true;
      minute = statusNum;
    }
  } else if (!['FT', 'Postp.', 'Canc.', 'Awarded'].includes(status) && 
             status !== '' && 
             !status.match(/^\d{2}:\d{2}$/)) {
    // Other statuses that might indicate live (like "1", "2", etc. as strings)
    isLive = true;
  }
  
  // Format date and time
  const date = formatDate(statpalMatch.date || '');
  const time = statpalMatch.time || '';
  
  // Get league info
  const league = statpalMatch.league_name || 'Unknown League';
  const country = statpalMatch.country || '';
  
  return {
    id: statpalMatch.main_id || statpalMatch.fallback_id_1 || '',
    league: league,
    leagueFlag: getLeagueFlag(country || league),
    sportKey: '', // StatPal doesn't use sport_key
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    homeTeamLogo: null,
    awayTeamLogo: null,
    homeScore: homeScore,
    awayScore: awayScore,
    minute: minute,
    isLive: isLive,
    time: time,
    date: date,
    odds: {
      home: null, // StatPal doesn't provide odds
      draw: null,
      away: null,
    },
    markets: [], // StatPal doesn't provide betting markets
    stats: null,
  };
}

