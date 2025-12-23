/**
 * Match Data Mapper
 * Transforms NosyAPI response format to our internal match structure
 * 
 * NOTE: This mapping will need to be adjusted based on the actual API response structure
 * Please provide sample API responses so we can create accurate mappings
 */

/**
 * Map API response to internal match structure
 * @param {Object} apiMatch - Match object from NosyAPI
 * @returns {Object} Internal match structure
 */
export function mapApiMatchToInternal(apiMatch) {
  if (!apiMatch) return null;
  
  // NosyAPI response structure:
  // {
  //   MatchID, Date, Time, DateTime, LeagueCode, LeagueFlag, Country, League,
  //   Teams, Team1, Team2, Team1Logo, Team2Logo, MatchResult, MB, Result,
  //   GameResult, LiveStatus, BetCount, HomeWin, Draw, AwayWin, Under25, Over25
  // }
  
  // Determine if match is live: LiveStatus must be 1 AND match must have started
  // A match is live only if LiveStatus is 1 AND Result is not 0 (meaning it has actually started)
  const liveStatus = apiMatch.LiveStatus === 1;
  const result = apiMatch.Result || 0;
  const hasStarted = result && result !== 0 && result !== '0' && result.toString().includes('-');
  const isLive = liveStatus && hasStarted;
  
  // Handle Result: 0 means no score yet, otherwise it's a score like "2-1"
  const scoreParts = hasStarted 
    ? result.toString().split('-') 
    : null;
  
  // Map markets from Bets array if available (for match details)
  let markets = [];
  
  if (apiMatch.Bets && Array.isArray(apiMatch.Bets)) {
    // Map Bets array to markets
    markets = apiMatch.Bets
      .filter(bet => bet.odds && Array.isArray(bet.odds))
      .map(bet => ({
        name: bet.gameName || bet.gameNameEn || 'Bahis',
        options: bet.odds.map(odd => ({
          label: odd.value || odd.label || '',
          value: odd.odd || odd.value || 0,
        })),
      }))
      .filter(market => market.options.length > 0);
  } else {
    // Fallback to basic markets for list view
    markets = [
      {
        name: 'Maç Sonucu',
        options: [
          { label: '1', value: apiMatch.HomeWin || 0 },
          { label: 'X', value: apiMatch.Draw || 0 },
          { label: '2', value: apiMatch.AwayWin || 0 },
        ].filter(opt => opt.value > 0),
      },
      ...(apiMatch.Under25 && apiMatch.Over25 ? [{
        name: 'Toplam Gol',
        options: [
          { label: 'Alt 2.5', value: apiMatch.Under25 },
          { label: 'Üst 2.5', value: apiMatch.Over25 },
        ],
      }] : []),
    ];
  }
  
  return {
    id: apiMatch.MatchID || apiMatch.matchID || apiMatch.id,
    league: apiMatch.League || apiMatch.league || 'Unknown League',
    leagueFlag: apiMatch.LeagueFlag || getLeagueFlag(apiMatch.Country || apiMatch.League),
    homeTeam: apiMatch.Team1 || apiMatch.homeTeam || apiMatch.home_team || 'Home Team',
    awayTeam: apiMatch.Team2 || apiMatch.awayTeam || apiMatch.away_team || 'Away Team',
    homeScore: scoreParts ? parseInt(scoreParts[0]) || 0 : null,
    awayScore: scoreParts ? parseInt(scoreParts[1]) || 0 : null,
    minute: isLive ? (apiMatch.MB || apiMatch.minute || apiMatch.min || null) : null,
    isLive: isLive,
    time: formatTime(apiMatch.Time || apiMatch.time),
    date: formatDate(apiMatch.Date || apiMatch.date),
    odds: {
      home: apiMatch.HomeWin || null,
      draw: apiMatch.Draw || null,
      away: apiMatch.AwayWin || null,
    },
    markets: markets,
    stats: null, // API'de stats yok
  };
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
 * Format time string
 * @param {string} time - Time string from API
 * @returns {string} Formatted time (HH:MM)
 */
function formatTime(time) {
  if (!time) return '';
  
  // NosyAPI returns time in HH:MM:SS format, convert to HH:MM
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
 * Format date string
 * @param {string} date - Date string from API
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function formatDate(date) {
  if (!date) return '';
  // NosyAPI returns date in YYYY-MM-DD format, return as is
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }
  // Handle DateTime format (YYYY-MM-DD HH:MM:SS)
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}\s/)) {
    return date.split(' ')[0];
  }
  return date;
}

