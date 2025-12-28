/**
 * Match Data Mapper
 * Transforms API response format (Sportmonks V3, The Odds API, or StatPal API) to our internal match structure
 */

/**
 * Map API response to internal match structure
 * Supports Sportmonks V3, The Odds API, and StatPal API formats
 * @param {Object} apiMatch - Match object from API
 * @returns {Object} Internal match structure
 */
export function mapApiMatchToInternal(apiMatch) {
  if (!apiMatch) return null;
  
  // Detect Sportmonks V3 format (backend transforms it, but we check for sportmonks_id or transformed structure)
  if (apiMatch.sportmonks_id !== undefined || (apiMatch.home_team && apiMatch.away_team && apiMatch.status && !apiMatch.bookmakers)) {
    return mapSportmonksMatchToInternal(apiMatch);
  }
  
  // The Odds API / StatPal (transformed) response structure:
  // {
  //   id, sport_key, commence_time, home_team, away_team,
  //   bookmakers: [{ key, title, markets: [{ key: "h2h", outcomes: [{ name, price }] }] }] (The Odds API)
  //   scores: [{ name, score }] (StatPal or The Odds API Scores)
  //   is_live: boolean (StatPal or The Odds API Scores)
  //   minute: number (StatPal)
  // }
  
  // Extract h2h market from first bookmaker (or best available)
  // StatPal API provides odds in bookmakers array
  const h2hMarket = extractH2HMarket(apiMatch.bookmakers, apiMatch.home_team, apiMatch.away_team);
  
  // Parse commence_time (ISO 8601 format: "2021-09-10T00:20:00Z")
  const commenceTime = apiMatch.commence_time ? new Date(apiMatch.commence_time) : null;
  const date = commenceTime ? formatDateFromISO(commenceTime) : '';
  const time = commenceTime ? formatTimeFromISO(commenceTime) : '';
  
  // Extract odds from h2h market outcomes
  const homeOdds = h2hMarket?.home || null;
  const drawOdds = h2hMarket?.draw || null;
  const awayOdds = h2hMarket?.away || null;
  
  // Build markets array from all bookmakers
  const markets = [];
  
  // Add h2h market (Maç Sonucu)
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
  
  // Extract all other markets from bookmakers
  if (apiMatch.bookmakers && Array.isArray(apiMatch.bookmakers)) {
    for (const bookmaker of apiMatch.bookmakers) {
      if (!bookmaker.markets || !Array.isArray(bookmaker.markets)) {
        continue;
      }
      
      // Process all markets (not just h2h, totals, btts)
      for (const market of bookmaker.markets) {
        // Skip h2h as it's already processed above
        if (market.key === 'h2h') {
          continue;
        }
        
        if (!market.outcomes || !Array.isArray(market.outcomes) || market.outcomes.length === 0) {
          continue;
        }
        
        // Get market display name (from backend or use key-based name)
        let marketName = market.name;
        
        // Translate English market names to Turkish
        const englishToTurkishMarketNames = {
          'Home/Away': 'Ev Sahibi/Deplasman',
          'home/away': 'Ev Sahibi/Deplasman',
          'Home / Away': 'Ev Sahibi/Deplasman',
          'Home-Away': 'Ev Sahibi/Deplasman',
          'home-away': 'Ev Sahibi/Deplasman',
          'Match Result': 'Maç Sonucu',
          'match result': 'Maç Sonucu',
          '1X2': 'Maç Sonucu',
          '1-X-2': 'Maç Sonucu',
          'Total Goals': 'Toplam Gol',
          'total goals': 'Toplam Gol',
          'Totals': 'Toplam Gol',
          'totals': 'Toplam Gol',
          'Both Teams To Score': 'Karşılıklı Gol',
          'both teams to score': 'Karşılıklı Gol',
          'BTTS': 'Karşılıklı Gol',
          'btts': 'Karşılıklı Gol',
          'First Half Result': 'İlk Yarı Sonucu',
          'first half result': 'İlk Yarı Sonucu',
          'Second Half Result': 'İkinci Yarı Sonucu',
          'second half result': 'İkinci Yarı Sonucu',
          'Half Time Result': 'İlk Yarı Sonucu',
          'half time result': 'İlk Yarı Sonucu',
          'Double Chance': 'Çifte Şans',
          'double chance': 'Çifte Şans',
          'Handicap': 'Handikap',
          'handicap': 'Handikap',
          'Asian Handicap': 'Asya Handikapı',
          'asian handicap': 'Asya Handikapı',
          'Corners': 'Kornerler',
          'corners': 'Kornerler',
          'Corner': 'Kornerler',
          'corner': 'Kornerler',
          'Cards': 'Kartlar',
          'cards': 'Kartlar',
          'Draw No Bet': 'Beraberlik Yok',
          'draw no bet': 'Beraberlik Yok',
          'HT/FT': 'İlk Yarı/Maç Sonucu',
          'ht/ft': 'İlk Yarı/Maç Sonucu',
          'HT/FT Double': 'İlk Yarı/Maç Sonucu',
          'ht/ft double': 'İlk Yarı/Maç Sonucu',
          'Half Time / Full Time': 'İlk Yarı/Maç Sonucu',
          'half time / full time': 'İlk Yarı/Maç Sonucu',
        };
        
        if (marketName) {
          // Normalize market name (trim and lowercase for comparison)
          const normalizedName = marketName.trim();
          const lowerName = normalizedName.toLowerCase();
          
          // Check exact match first, then case-insensitive match
          const translatedName = englishToTurkishMarketNames[normalizedName] || englishToTurkishMarketNames[lowerName];
          if (translatedName) {
            marketName = translatedName;
          } else {
            // Try partial matching for combinations (e.g., "Home/Away" variations)
            // Replace common English terms in market names
            marketName = normalizedName
              .replace(/\bHome\/Away\b/gi, 'Ev Sahibi/Deplasman')
              .replace(/\bHome-Away\b/gi, 'Ev Sahibi/Deplasman')
              .replace(/\bHome \/ Away\b/gi, 'Ev Sahibi/Deplasman')
              .replace(/\bMatch Result\b/gi, 'Maç Sonucu')
              .replace(/\bTotal Goals\b/gi, 'Toplam Gol')
              .replace(/\bBoth Teams To Score\b/gi, 'Karşılıklı Gol')
              .replace(/\bFirst Half Result\b/gi, 'İlk Yarı Sonucu')
              .replace(/\bSecond Half Result\b/gi, 'İkinci Yarı Sonucu')
              .replace(/\bHalf Time Result\b/gi, 'İlk Yarı Sonucu')
              .replace(/\bDouble Chance\b/gi, 'Çifte Şans')
              .replace(/\bAsian Handicap\b/gi, 'Asya Handikapı')
              .replace(/\bCorners?\b/gi, 'Kornerler')
              .replace(/\bCards?\b/gi, 'Kartlar')
              .replace(/\bDraw No Bet\b/gi, 'Beraberlik Yok')
              .replace(/\bHT\/FT\b/gi, 'İlk Yarı/Maç Sonucu');
          }
        } else {
          // Map market keys to Turkish names
          const marketNameMap = {
            'totals': 'Toplam Gol',
            'btts': 'Karşılıklı Gol',
            'h2h_1h': 'İlk Yarı Sonucu',
            'totals_1h': 'İlk Yarı Toplam Gol',
            'h2h_2h': 'İkinci Yarı Sonucu',
            'totals_2h': 'İkinci Yarı Toplam Gol',
            'handicap_3way': 'Handikap (3 Yönlü)',
            'handicap_asian': 'Asya Handikapı',
            'double_chance': 'Çifte Şans',
            'draw_no_bet': 'Beraberlik Yok',
            'penalty': 'Penaltı',
            'corners': 'Kornerler',
            'cards': 'Kartlar',
            'player': 'Oyuncu Bahisleri',
          };
          marketName = marketNameMap[market.key] || market.key;
        }
        
        // Extract options from outcomes
        const marketOptions = market.outcomes
          .filter(outcome => outcome.price && outcome.price > 0)
          .map(outcome => {
            let label = outcome.name || 'N/A';
            
            // Translate common outcome names to Turkish
            const labelLower = label.toLowerCase();
            
            // General translations
            if (label === 'Home' || labelLower === 'home') {
              // For h2h markets, use team name, otherwise use "Ev Sahibi"
              label = market.key === 'h2h' ? apiMatch.home_team || 'Ev Sahibi' : 'Ev Sahibi';
            } else if (label === 'Away' || labelLower === 'away') {
              label = market.key === 'h2h' ? apiMatch.away_team || 'Deplasman' : 'Deplasman';
            } else if (label === 'Draw' || label === 'X' || labelLower.includes('draw')) {
              label = 'Beraberlik';
            } else if (label === 'Yes' || label === 'Evet' || labelLower === 'yes') {
              label = 'Var';
            } else if (label === 'No' || label === 'Hayır' || labelLower === 'no') {
              label = 'Yok';
            } else if (label === 'Odd' || labelLower === 'odd') {
              label = 'Tek';
            } else if (label === 'Even' || labelLower === 'even') {
              label = 'Çift';
            } else if (label.includes('/')) {
              // Handle combinations like "Home/Draw", "Home/Away", "Draw/Away"
              if (label.includes('Home') && label.includes('Draw')) {
                label = '1X';
              } else if (label.includes('Home') && label.includes('Away')) {
                label = '12';
              } else if (label.includes('Draw') && label.includes('Away')) {
                label = 'X2';
              } else {
                label = label
                  .replace(/Home/gi, '1')
                  .replace(/Away/gi, '2')
                  .replace(/Draw/gi, 'X');
              }
            }
            
            return {
              label: label,
              value: parseFloat(outcome.price) || 0,
            };
          })
          .filter(opt => opt.value > 0);
        
        if (marketOptions.length > 0) {
          markets.push({
            name: marketName,
            options: marketOptions,
          });
        }
      }
    }
  }
  
  // Get league name from sport_key or league field (StatPal provides league field)
  const league = apiMatch.league || getLeagueNameFromSportKey(apiMatch.sport_key);
  const leagueFlag = getLeagueFlagFromSportKey(apiMatch.sport_key);
  
  // Extract live scores if available (from StatPal API or The Odds API Scores)
  let homeScore = 0;
  let awayScore = 0;
  let isLive = false;
  let minute = null;
  
  // Check if minute is directly provided (StatPal API)
  if (apiMatch.minute !== undefined && apiMatch.minute !== null) {
    minute = parseInt(apiMatch.minute, 10);
    if (isNaN(minute)) minute = null;
  }
  
  // Check if this is a live match with scores
  if (apiMatch.scores && Array.isArray(apiMatch.scores)) {
    // Scores format: [{ name: "Team Name", score: 2 }]
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
    // StatPal API provides: is_live flag
    // The Odds API Scores provides: completed (false = live, true = finished) or is_live flag
    if (apiMatch.is_live === true || apiMatch.completed === false) {
      isLive = true;
      
      // If minute not already set, try to extract from last_update or estimate from commence_time
      if (minute === null && apiMatch.last_update && commenceTime) {
        const lastUpdate = new Date(apiMatch.last_update);
        if (!isNaN(commenceTime.getTime()) && !isNaN(lastUpdate.getTime())) {
          const diffMinutes = Math.floor((lastUpdate - commenceTime) / (1000 * 60));
          if (diffMinutes > 0 && diffMinutes <= 120) { // Max 120 minutes for soccer
            minute = diffMinutes;
          }
        }
      }
    }
  } else if (apiMatch.is_live === true || apiMatch.isLive === true) {
    // StatPal API: is_live flag without scores array (match just started)
    isLive = true;
  }
  
  // Check if match is finished FIRST (before using it in conditions)
  // POSTPONED is NOT considered finished - it's a separate status
  const status = (apiMatch.status || '').toUpperCase();
  const isFinished = status === 'FT' || status === 'FINISHED' || status === 'CANCELLED' || status === 'CANCELED';
  const isPostponed = status === 'POSTPONED';

  // Guardrail: A match cannot be live if its kickoff time is still in the future.
  // StatPal (or our backend transform) may occasionally mark is_live incorrectly for scheduled matches.
  // We treat "future kickoff" as a hard override.
  const FUTURE_KICKOFF_GRACE_MS = 2 * 60 * 1000; // 2 minutes
  const isKickoffInFuture =
    commenceTime instanceof Date &&
    !isNaN(commenceTime.getTime()) &&
    commenceTime.getTime() - Date.now() > FUTURE_KICKOFF_GRACE_MS;
  if (isKickoffInFuture) {
    isLive = false;
    minute = null;
  }
  
  // Also check status field for live indicators (1H, 2H, HT, LIVE, INPLAY, etc.)
  const statusUpper = (apiMatch.status || '').toUpperCase();
  if (!isLive && !isFinished) {
    // Live statuses: LIVE, HT, 1H, 2H, INPLAY, IN_PLAY, etc.
    if (statusUpper === 'LIVE' || statusUpper === 'HT' || statusUpper === '1H' || statusUpper === '2H' || 
        statusUpper === 'INPLAY' || statusUpper === 'IN_PLAY' || statusUpper === 'IN PLAY') {
      isLive = true;
    }
  }
  
  // IMPORTANT: If backend explicitly sets is_live to true, trust it
  // BUT: If match is finished (FT), don't show it as live even if backend says is_live=true
  // (StatPal /live endpoint returns recently finished matches, but we only want truly live ones)
  if ((apiMatch.is_live === true || apiMatch.isLive === true) && !isFinished && !isKickoffInFuture) {
    isLive = true;
  }
  
  return {
    id: apiMatch.id || '',
    league: league,
    leagueFlag: leagueFlag,
    sportKey: apiMatch.sport_key || '', // Add sport_key for filtering
    homeTeam: apiMatch.home_team || 'Home Team',
    awayTeam: apiMatch.away_team || 'Away Team',
    homeTeamLogo: apiMatch.home_team_logo || null, // StatPal API may provide logos
    awayTeamLogo: apiMatch.away_team_logo || null,
    homeScore: homeScore,
    awayScore: awayScore,
    minute: minute,
    isLive: isLive, // Use the final isLive value (respects backend's is_live flag)
    isFinished: isFinished, // Add finished flag
    status: apiMatch.status || '', // Add status for display
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
      
      // Check if it's a draw outcome (StatPal uses "Draw", The Odds API uses team names or "Draw")
      if (name.toLowerCase().includes('draw') || name === 'X' || name === 'Draw') {
        result.draw = price;
        break;
      }
    }
    
    // Then match team names or StatPal format (Home/Away)
    // StatPal API uses "Home" and "Away" as outcome names
    for (const outcome of h2hMarket.outcomes) {
      const name = outcome.name || '';
      const price = outcome.price;
      
      // Skip if already identified as draw
      if (name.toLowerCase().includes('draw') || name === 'X' || name === 'Draw') {
        continue;
      }
      
      // StatPal format: "Home" and "Away"
      if (name === 'Home' || name.toLowerCase() === 'home') {
        result.home = price;
        continue;
      }
      if (name === 'Away' || name.toLowerCase() === 'away') {
        result.away = price;
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
        // Complete failure - try exact name matching one more time (case-sensitive)
        for (const outcome of h2hMarket.outcomes) {
          const name = (outcome.name || '').trim();
          const price = outcome.price;
          
          if (homeTeam && name === homeTeam) {
            result.home = price;
          } else if (awayTeam && name === awayTeam) {
            result.away = price;
          } else if (name.toLowerCase().includes('draw') || name === 'X' || name === 'Draw') {
            result.draw = price;
          }
        }
        
        // If still null, use position as last resort
        if (result.home === null && result.away === null && result.draw === null) {
          result.home = h2hMarket.outcomes[0]?.price || null;
          result.draw = h2hMarket.outcomes[1]?.price || null;
          result.away = h2hMarket.outcomes[2]?.price || null;
        }
      } else {
        // Fill missing ones
        if (result.home === null && nonDrawOutcomes.length >= 1) {
          result.home = nonDrawOutcomes[0]?.price || null;
        }
        if (result.away === null && nonDrawOutcomes.length >= 2) {
          result.away = nonDrawOutcomes[nonDrawOutcomes.length - 1]?.price || null;
        } else if (result.away === null && nonDrawOutcomes.length === 1 && result.home !== null) {
          // Only one non-draw outcome and home is already set, try to find away from all outcomes
          const awayCandidate = h2hMarket.outcomes.find(o => {
            const oName = (o.name || '').toLowerCase();
            return !oName.includes('draw') && o.name !== 'X' && o.name !== 'Draw' && o.price !== result.home;
          });
          if (awayCandidate) {
            result.away = awayCandidate.price;
          }
        }
      }
    }
    
    // Return result only if at least one odds value is found
    if (result.home !== null || result.draw !== null || result.away !== null) {
      return result;
    }
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
 * @returns {string} Formatted time (HH:MM) in Turkey timezone (UTC+3)
 */
function formatTimeFromISO(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Convert to Turkey timezone (Europe/Istanbul, UTC+3)
  // API returns UTC time, we need to show it in Turkey time
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const hours = parts.find(p => p.type === 'hour')?.value || '00';
  const minutes = parts.find(p => p.type === 'minute')?.value || '00';
  
  return `${hours}:${minutes}`;
}

/**
 * Format date from ISO 8601 date string
 * @param {Date} dateObj - Date object
 * @returns {string} Formatted date (YYYY-MM-DD) in Turkey timezone
 */
function formatDateFromISO(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Convert to Turkey timezone (Europe/Istanbul, UTC+3)
  // This ensures the date matches the time shown to users
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(dateObj);
  const year = parts.find(p => p.type === 'year')?.value || '0000';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  
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
  return date;
}

/**
 * Map Sportmonks V3 match (already transformed by backend) to internal match structure
 * @param {Object} sportmonksMatch - Match object from Sportmonks V3 (transformed by backend)
 * @returns {Object} Internal match structure
 */
function mapSportmonksMatchToInternal(sportmonksMatch) {
  if (!sportmonksMatch) return null;
  
  // Parse commence_time/starting_at (ISO 8601 format)
  // Backend sends starting_at, but we also check commence_time for compatibility
  const commenceTime = sportmonksMatch.starting_at 
    ? new Date(sportmonksMatch.starting_at) 
    : (sportmonksMatch.commence_time ? new Date(sportmonksMatch.commence_time) : null);
  const date = commenceTime && !isNaN(commenceTime.getTime()) ? formatDateFromISO(commenceTime) : '';
  const time = commenceTime && !isNaN(commenceTime.getTime()) ? formatTimeFromISO(commenceTime) : '';
  
  // Extract scores (already extracted by backend)
  const homeScore = sportmonksMatch.home_score !== undefined && sportmonksMatch.home_score !== null 
    ? sportmonksMatch.home_score 
    : null;
  const awayScore = sportmonksMatch.away_score !== undefined && sportmonksMatch.away_score !== null 
    ? sportmonksMatch.away_score 
    : null;
  
  // Extract time status (already formatted by backend)
  let status = sportmonksMatch.status || '';
  let minute = sportmonksMatch.minute !== undefined && sportmonksMatch.minute !== null 
    ? parseInt(sportmonksMatch.minute, 10) 
    : null;
  let isLive = sportmonksMatch.is_live === true;
  let isFinished = sportmonksMatch.is_finished === true;
  let isPostponed = sportmonksMatch.is_postponed === true;
  
  // If status is empty but we have events, try to infer from events
  if (!status && sportmonksMatch.events && Array.isArray(sportmonksMatch.events) && sportmonksMatch.events.length > 0) {
    // Get the latest event minute
    const latestEvent = sportmonksMatch.events.reduce((latest, event) => {
      const eventMinute = event.minute || 0;
      const latestMinute = latest.minute || 0;
      return eventMinute > latestMinute ? event : latest;
    }, sportmonksMatch.events[0]);
    
    if (latestEvent && latestEvent.minute !== undefined && latestEvent.minute !== null) {
      minute = parseInt(latestEvent.minute, 10);
      // If minute > 0 and < 120, match is likely live
      if (minute > 0 && minute < 120) {
        status = 'LIVE';
        isLive = true;
      }
    }
  }
  
  // If still no status, check if match has started based on starting_at
  if (!status && commenceTime && !isNaN(commenceTime.getTime())) {
    const now = new Date();
    if (commenceTime <= now) {
      // Match has started - if we have scores or events, it's likely live
      if ((homeScore !== null && homeScore !== undefined) || 
          (awayScore !== null && awayScore !== undefined) ||
          (sportmonksMatch.events && sportmonksMatch.events.length > 0)) {
        status = 'LIVE';
        isLive = true;
      } else {
        status = 'NS'; // Not Started
      }
    } else {
      status = 'NS'; // Not Started
    }
  }
  
  // Extract league info
  const league = sportmonksMatch.league || '';
  const leagueFlag = sportmonksMatch.league_logo 
    ? null // Will use image if available
    : getLeagueFlagFromCountry(sportmonksMatch.country || league);
  
  // Extract team logos
  const homeTeamLogo = sportmonksMatch.home_team_logo || null;
  const awayTeamLogo = sportmonksMatch.away_team_logo || null;
  
  // Build markets from odds data (if available)
  const markets = [];
  
  // Extract odds from odds array (Sportmonks V3 format)
  // Handle both array format and nested data format
  let oddsArray = null;
  if (sportmonksMatch.odds) {
    if (Array.isArray(sportmonksMatch.odds)) {
      oddsArray = sportmonksMatch.odds;
    } else if (sportmonksMatch.odds.data && Array.isArray(sportmonksMatch.odds.data)) {
      oddsArray = sportmonksMatch.odds.data;
    } else if (typeof sportmonksMatch.odds === 'object') {
      // Try to extract from object format
      oddsArray = Object.values(sportmonksMatch.odds).filter(item => Array.isArray(item)).flat();
    }
  }
  
  if (oddsArray && oddsArray.length > 0) {
    try {
      const extractedMarkets = extractMarketsFromSportmonksOdds(oddsArray, sportmonksMatch.home_team, sportmonksMatch.away_team);
      if (extractedMarkets && extractedMarkets.length > 0) {
        markets.push(...extractedMarkets);
      }
    } catch (error) {
      console.warn('Error extracting markets from odds:', error);
    }
  }
  
  // If no markets from odds, try to create basic 1X2 market if we have any odds data
  if (markets.length === 0 && sportmonksMatch.odds) {
    try {
      // Try to extract basic odds if available in a different format
      const basicOdds = extractBasicOdds(sportmonksMatch.odds);
      if (basicOdds && (basicOdds.home || basicOdds.draw || basicOdds.away)) {
        markets.push({
          name: 'Maç Sonucu',
          options: [
            ...(basicOdds.home ? [{ label: '1', value: parseFloat(basicOdds.home) }] : []),
            ...(basicOdds.draw ? [{ label: 'X', value: parseFloat(basicOdds.draw) }] : []),
            ...(basicOdds.away ? [{ label: '2', value: parseFloat(basicOdds.away) }] : []),
          ],
        });
      }
    } catch (error) {
      console.warn('Error extracting basic odds:', error);
    }
  }
  
  return {
    id: String(sportmonksMatch.id || sportmonksMatch.sportmonks_id || ''),
    league: league,
    leagueFlag: leagueFlag,
    sportKey: '', // Sportmonks doesn't use sport_key
    homeTeam: sportmonksMatch.home_team || 'Home Team',
    awayTeam: sportmonksMatch.away_team || 'Away Team',
    homeTeamLogo: homeTeamLogo,
    awayTeamLogo: awayTeamLogo,
    homeScore: homeScore,
    awayScore: awayScore,
    minute: minute,
    isLive: isLive,
    isFinished: isFinished,
    status: status,
    time: time,
    date: date,
    odds: {
      home: null, // Will be extracted from markets if available
      draw: null,
      away: null,
    },
    markets: markets,
    stats: sportmonksMatch.statistics || null, // Keep statistics for detail page
    events: sportmonksMatch.events || [], // Keep events for detail page
    lineups: sportmonksMatch.lineups || [], // Keep lineups for detail page
  };
}

/**
 * Extract markets from Sportmonks V3 odds array
 * @param {Array} oddsArray - Odds array from Sportmonks V3
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Array} Markets array
 */
function extractMarketsFromSportmonksOdds(oddsArray, homeTeam, awayTeam) {
  if (!Array.isArray(oddsArray) || oddsArray.length === 0) return [];
  
  const markets = [];
  const marketMap = new Map(); // Group by market_id and market_description
  
  // Sportmonks V3 format: each odd has market_description, label, value directly
  for (const odd of oddsArray) {
    try {
      // Skip stopped odds
      if (odd && odd.stopped === true) continue;
      
      // Handle nested odd format (if odd is wrapped in data object)
      const oddData = odd.data || odd;
      
      // Get market description (e.g., "Full Time Result", "Goal Line")
      const marketDescription = oddData.market_description || oddData.market?.name || '';
      if (!marketDescription) continue;
      
      // Get market_id to group by
      const marketId = oddData.market_id || oddData.market?.id || marketDescription;
      
      // Get label and value - handle different formats
      let label = oddData.label || oddData.name || oddData.outcome || '';
      let value = oddData.value || oddData.price || oddData.odd;
      
      // If value is an object, try to extract numeric value
      if (typeof value === 'object' && value !== null) {
        value = value.value || value.price || value.odd || null;
      }
      
      // Convert value to number
      const numericValue = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : null);
      
      if (!label || !numericValue || numericValue <= 0 || !isFinite(numericValue)) continue;
      
      // Translate market names to Turkish
      const translatedName = translateMarketName(marketDescription);
      
      // Translate outcome label
      const translatedLabel = translateOutcomeName(label, homeTeam, awayTeam);
      
      // Group by market
      if (!marketMap.has(marketId)) {
        marketMap.set(marketId, {
          name: translatedName,
          options: [],
        });
      }
      
      // Add option (avoid duplicates)
      const market = marketMap.get(marketId);
      const existingOption = market.options.find(opt => opt.label === translatedLabel);
      if (!existingOption) {
        market.options.push({
          label: translatedLabel,
          value: numericValue,
        });
      } else {
        // Update if new value is better (higher odds)
        if (numericValue > existingOption.value) {
          existingOption.value = numericValue;
        }
      }
    } catch (error) {
      // Skip invalid odds entries
      console.warn('Error processing odd entry:', error, odd);
      continue;
    }
  }
  
  // Convert map to markets array and filter popular markets
  const popularMarketIds = [1, 2, 7, 44]; // Full Time Result, Double Chance, Goal Line, Goals Odd/Even
  const popularMarketDescriptions = ['Full Time Result', 'Fulltime Result', 'Double Chance', 'Goal Line', 'Goals Odd/Even'];
  
  for (const [marketId, market] of marketMap.entries()) {
    // Only include popular markets or markets with at least 2 options
    const isPopular = popularMarketIds.includes(marketId) || 
                     popularMarketDescriptions.some(desc => market.name.includes(translateMarketName(desc)));
    
    if (isPopular || market.options.length >= 2) {
      // Sort options by value (ascending)
      market.options.sort((a, b) => a.value - b.value);
      markets.push(market);
    }
  }
  
  // Sort markets: Full Time Result first, then others
  markets.sort((a, b) => {
    if (a.name === 'Maç Sonucu') return -1;
    if (b.name === 'Maç Sonucu') return 1;
    return a.name.localeCompare(b.name);
  });
  
  return markets;
}

/**
 * Translate Sportmonks market names to Turkish
 * @param {string} marketName - English market name
 * @returns {string} Turkish market name
 */
function translateMarketName(marketName) {
  if (!marketName) return marketName;
  
  const translations = {
    '1x2': 'Maç Sonucu',
    'match winner': 'Maç Sonucu',
    'match_winner': 'Maç Sonucu',
    'full time result': 'Maç Sonucu',
    'fulltime result': 'Maç Sonucu',
    'both teams to score': 'Karşılıklı Gol',
    'both_teams_to_score': 'Karşılıklı Gol',
    'btts': 'Karşılıklı Gol',
    'over/under': 'Toplam Gol',
    'over_under': 'Toplam Gol',
    'total goals': 'Toplam Gol',
    'total_goals': 'Toplam Gol',
    'goal line': 'Toplam Gol',
    'double chance': 'Çifte Şans',
    'double_chance': 'Çifte Şans',
    'draw no bet': 'Beraberlik Yok',
    'draw_no_bet': 'Beraberlik Yok',
    'goals odd/even': 'Gol Tek/Çift',
    'asian handicap': 'Asya Handikapı',
    'correct score': 'Kesin Skor',
  };
  
  const lowerName = marketName.toLowerCase().trim();
  
  // Check exact match first
  if (translations[lowerName]) {
    return translations[lowerName];
  }
  
  // Check partial match
  for (const [key, value] of Object.entries(translations)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  
  return marketName;
}

/**
 * Translate outcome names to Turkish
 * @param {string} outcomeName - Outcome name
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {string} Translated outcome name
 */
function translateOutcomeName(outcomeName, homeTeam, awayTeam) {
  const lower = outcomeName.toLowerCase();
  
  if (lower === 'home' || lower === '1') return '1';
  if (lower === 'away' || lower === '2') return '2';
  if (lower === 'draw' || lower === 'x') return 'X';
  if (lower === 'yes') return 'Var';
  if (lower === 'no') return 'Yok';
  if (lower === 'over') return 'Üst';
  if (lower === 'under') return 'Alt';
  
  // If it matches team names, use 1 or 2
  if (homeTeam && outcomeName.toLowerCase().includes(homeTeam.toLowerCase())) return '1';
  if (awayTeam && outcomeName.toLowerCase().includes(awayTeam.toLowerCase())) return '2';
  
  return outcomeName;
}

/**
 * Extract basic odds from Sportmonks odds structure
 * @param {Object|Array} odds - Odds data
 * @returns {Object} Basic odds { home, draw, away }
 */
function extractBasicOdds(odds) {
  const result = { home: null, draw: null, away: null };
  
  if (Array.isArray(odds)) {
    for (const odd of odds) {
      const market = odd.market || {};
      const marketName = (market.name || '').toLowerCase();
      
      if (marketName.includes('1x2') || marketName.includes('match winner')) {
        const values = odd.values || [];
        for (const val of values) {
          const name = (val.name || val.label || '').toLowerCase();
          const value = parseFloat(val.value);
          
          if (name === 'home' || name === '1') result.home = value;
          else if (name === 'draw' || name === 'x') result.draw = value;
          else if (name === 'away' || name === '2') result.away = value;
        }
      }
    }
  }
  
  return result;
}

/**
 * Get league flag from country name
 * @param {string} country - Country name
 * @returns {string} Flag emoji
 */
function getLeagueFlagFromCountry(country) {
  if (!country) return '🏆';
  
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
  };
  
  for (const [key, flag] of Object.entries(flagMap)) {
    if (country.includes(key)) {
      return flag;
    }
  }
  
  return '🏆';
}

