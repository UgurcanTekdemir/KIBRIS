/**
 * Match Data Mapper
 * Transforms API response format to our internal match structure
 */

/**
 * Map Sportmonks V3 fixture to internal match structure
 * @param {Object} fixture - Sportmonks V3 fixture object
 * @returns {Object} Internal match structure
 */
function mapSportmonksFixtureToInternal(fixture) {
  if (!fixture) return null;

  // Extract participants (home/away teams)
  let homeTeam = 'Home Team';
  let awayTeam = 'Away Team';
  let homeTeamLogo = null;
  let awayTeamLogo = null;

  if (fixture.participants && Array.isArray(fixture.participants)) {
    // Participants array: find home and away by meta.position or meta.type
    const homeParticipant = fixture.participants.find(p => 
      p.meta?.position === 'home' || 
      p.meta?.type === 'home' || 
      p.meta?.position === 1 ||
      p.meta?.type === 1
    );
    const awayParticipant = fixture.participants.find(p => 
      p.meta?.position === 'away' || 
      p.meta?.type === 'away' || 
      p.meta?.position === 2 ||
      p.meta?.type === 2
    );

    // Fallback: if no meta, use first two participants
    if (!homeParticipant && fixture.participants.length >= 1) {
      homeTeam = fixture.participants[0].name || homeTeam;
      homeTeamLogo = fixture.participants[0].image_path || null;
    } else if (homeParticipant) {
      homeTeam = homeParticipant.name || homeTeam;
      homeTeamLogo = homeParticipant.image_path || null;
    }

    if (!awayParticipant && fixture.participants.length >= 2) {
      awayTeam = fixture.participants[1].name || awayTeam;
      awayTeamLogo = fixture.participants[1].image_path || null;
    } else if (awayParticipant) {
      awayTeam = awayParticipant.name || awayTeam;
      awayTeamLogo = awayParticipant.image_path || null;
    }
  } else if (fixture.name) {
    // Fallback: parse from name field "Team A vs Team B"
    const nameParts = fixture.name.split(' vs ');
    if (nameParts.length === 2) {
      homeTeam = nameParts[0].trim();
      awayTeam = nameParts[1].trim();
    }
  }

  // Parse starting_at or commence_time timestamp
  // Backend sends commence_time already in Turkey timezone (UTC+3)
  // If commence_time exists, use it directly (already converted by backend)
  // Otherwise, parse starting_at (may be UTC) and convert to Turkey timezone
  let date = '';
  let time = '';
  
  if (fixture.commence_time) {
    // Backend already converted to Turkey timezone, parse and use directly
    const timeStr = fixture.commence_time;
    if (timeStr.includes(' ')) {
      const [datePart, timePart] = timeStr.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      
      // Format date as DD.MM.YYYY (already in Turkey timezone)
      date = `${day}.${month}.${year}`;
      // Format time as HH:mm (already in Turkey timezone)
      time = `${hour}:${minute}`;
    } else {
      // ISO format - parse as Turkey timezone (backend already converted)
      const commenceTime = new Date(timeStr);
      if (!isNaN(commenceTime.getTime())) {
        // Extract date and time directly (already in Turkey timezone)
        const year = commenceTime.getFullYear();
        const month = String(commenceTime.getMonth() + 1).padStart(2, '0');
        const day = String(commenceTime.getDate()).padStart(2, '0');
        const hours = String(commenceTime.getHours()).padStart(2, '0');
        const minutes = String(commenceTime.getMinutes()).padStart(2, '0');
        
        date = `${day}.${month}.${year}`;
        time = `${hours}:${minutes}`;
      }
    }
  } else if (fixture.starting_at) {
    // Parse starting_at (may be UTC) and convert to Turkey timezone
    // Format: "2025-11-10 10:30:00" (YYYY-MM-DD HH:mm:ss) or ISO format
    let startingAt = null;
    
    if (fixture.starting_at.includes('T') || fixture.starting_at.includes('Z') || fixture.starting_at.includes('+')) {
      // ISO format with timezone info - parse as UTC and convert
      startingAt = new Date(fixture.starting_at);
    } else {
      // Simple format - assume UTC and add 'Z' for parsing
      startingAt = new Date(fixture.starting_at.replace(' ', 'T') + 'Z');
    }
    
    if (isNaN(startingAt.getTime()) && fixture.starting_at_timestamp) {
      // Fallback to timestamp
      startingAt = new Date(fixture.starting_at_timestamp * 1000);
    }
    
    if (startingAt && !isNaN(startingAt.getTime())) {
      // Convert to Turkey timezone
      date = startingAt ? formatDateFromISO(startingAt) : '';
      time = startingAt ? formatTimeFromISO(startingAt, true) : '';
    }
  } else if (fixture.starting_at_timestamp) {
    // Fallback: use timestamp
    const startingAt = new Date(fixture.starting_at_timestamp * 1000);
    if (!isNaN(startingAt.getTime())) {
      date = formatDateFromISO(startingAt);
      time = formatTimeFromISO(startingAt, true);
    }
  }

  // Determine match status from state_id
  // state_id: 1,2 = Not Started (NS), 3 = Live (LIVE), 5 = Finished (FT)
  const stateId = fixture.state_id;
  let status = 'NS';
  let isLive = false;
  let isFinished = false;
  let homeScore = null;
  let awayScore = null;
  let minute = null;

  if (stateId === 3) {
    status = 'LIVE';
    isLive = true;
  } else if (stateId === 5) {
    status = 'FT';
    isFinished = true;
  } else if (stateId === 1 || stateId === 2) {
    status = 'NS';
  }

  // Extract scores from result_info or scores data if available
  if (fixture.result_info) {
    // Try to parse scores from result_info (e.g., "Team A won 2-1")
    const scoreMatch = fixture.result_info.match(/(\d+)[\s-]+(\d+)/);
    if (scoreMatch) {
      homeScore = parseInt(scoreMatch[1], 10);
      awayScore = parseInt(scoreMatch[2], 10);
    }
  }

  // Extract league information
  let league = 'Unknown League';
  let leagueFlag = '🏆';
  let leagueLogo = null;

  if (fixture.leagues) {
    const leagueData = Array.isArray(fixture.leagues) ? fixture.leagues[0] : fixture.leagues;
    if (leagueData) {
      league = leagueData.name || league;
      leagueLogo = leagueData.image_path || null;
      if (leagueData.country) {
        const countryData = Array.isArray(leagueData.country) ? leagueData.country[0] : leagueData.country;
        if (countryData && countryData.name) {
          leagueFlag = getLeagueFlag(countryData.name);
        }
      }
    }
  }

  // Extract odds and markets (Market ID 1 = Match Winner / Fulltime Result)
  const markets = [];
  let homeOdds = null;
  let drawOdds = null;
  let awayOdds = null;

  // Extract odds and markets (Market ID 1 = Match Winner / Fulltime Result)
  // Sportmonks V3 odds structure can vary, handle multiple formats
  if (fixture.odds) {
    let oddsArray = [];
    
    // Handle different odds formats
    if (Array.isArray(fixture.odds)) {
      oddsArray = fixture.odds;
    } else if (fixture.odds.data && Array.isArray(fixture.odds.data)) {
      oddsArray = fixture.odds.data;
    }
    
    if (oddsArray.length > 0) {
      // Find Market ID 1 (Match Winner / Fulltime Result)
      const matchWinnerOdds = oddsArray.filter(odd => {
        const marketId = odd.market_id || odd.market?.id || odd.market_id;
        return marketId === 1;
      });
      
      if (matchWinnerOdds.length > 0) {
        const matchWinnerOptions = [];
        
        for (const odd of matchWinnerOdds) {
          // Handle different odds formats
          let label = odd.label || odd.name || '';
          let value = odd.value || odd.odd || odd.price || null;
          let selectionId = odd.id || odd.selection_id || null;

          // If values array exists (Sportmonks V3 format)
          if (odd.values && Array.isArray(odd.values) && odd.values.length > 0) {
            for (const val of odd.values) {
              const valLabel = val.label || val.name || val.outcome || '';
              const valValue = val.value || val.odd || val.price || null;
              const valSelectionId = val.id || val.selection_id || selectionId;

              // Map labels: "1", "X", "2" or "Home", "Draw", "Away"
              let mappedLabel = valLabel;
              if (valLabel.toLowerCase() === 'home' || valLabel === '1' || valLabel.toLowerCase().includes('home')) {
                mappedLabel = '1';
                if (homeOdds === null && valValue) homeOdds = parseFloat(valValue);
              } else if (valLabel.toLowerCase() === 'draw' || valLabel === 'X' || valLabel === 'x' || valLabel.toLowerCase().includes('draw')) {
                mappedLabel = 'X';
                if (drawOdds === null && valValue) drawOdds = parseFloat(valValue);
              } else if (valLabel.toLowerCase() === 'away' || valLabel === '2' || valLabel.toLowerCase().includes('away')) {
                mappedLabel = '2';
                if (awayOdds === null && valValue) awayOdds = parseFloat(valValue);
              }

              if (valValue && parseFloat(valValue) > 0) {
                matchWinnerOptions.push({
                  label: mappedLabel,
                  value: parseFloat(valValue),
                  selectionId: valSelectionId,
                });
              }
            }
          } else if (value && parseFloat(value) > 0) {
            // Single odd entry (direct format)
            if (label.toLowerCase() === 'home' || label === '1' || label.toLowerCase().includes('home')) {
              label = '1';
              if (homeOdds === null) homeOdds = parseFloat(value);
            } else if (label.toLowerCase() === 'draw' || label === 'X' || label === 'x' || label.toLowerCase().includes('draw')) {
              label = 'X';
              if (drawOdds === null) drawOdds = parseFloat(value);
            } else if (label.toLowerCase() === 'away' || label === '2' || label.toLowerCase().includes('away')) {
              label = '2';
              if (awayOdds === null) awayOdds = parseFloat(value);
            }

            matchWinnerOptions.push({
              label,
              value: parseFloat(value),
              selectionId,
            });
          }
        }

        // Remove duplicates and sort: 1, X, 2
        const uniqueOptions = [];
        const seenLabels = new Set();
        for (const opt of matchWinnerOptions) {
          if (!seenLabels.has(opt.label)) {
            seenLabels.add(opt.label);
            uniqueOptions.push(opt);
          }
        }
        
        // Sort: 1, X, 2
        uniqueOptions.sort((a, b) => {
          const order = { '1': 0, 'X': 1, '2': 2 };
          return (order[a.label] ?? 99) - (order[b.label] ?? 99);
        });

        if (uniqueOptions.length > 0) {
          markets.push({
            name: 'Maç Sonucu',
            options: uniqueOptions,
            marketId: 1,
          });
        }
      }
    }
  }

  // If no markets found but we have basic odds, create market
  if (markets.length === 0 && (homeOdds || drawOdds || awayOdds)) {
    markets.push({
      name: 'Maç Sonucu',
      options: [
        ...(homeOdds ? [{ label: '1', value: homeOdds }] : []),
        ...(drawOdds ? [{ label: 'X', value: drawOdds }] : []),
        ...(awayOdds ? [{ label: '2', value: awayOdds }] : []),
      ],
      marketId: 1,
    });
  }

  return {
    id: String(fixture.id || ''),
    league,
    leagueFlag: leagueLogo || leagueFlag,
    sportKey: 'soccer',
    homeTeam,
    awayTeam,
    homeTeamLogo,
    awayTeamLogo,
    homeScore,
    awayScore,
    minute,
    isLive,
    isFinished,
    status,
    time,
    date,
    odds: {
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds,
    },
    markets,
    // Store Sportmonks-specific data for bet slip
    fixtureId: fixture.id,
    league_id: fixture.league_id, // Add league_id for Sidebar extraction
    sportmonksData: {
      fixtureId: fixture.id,
      stateId: fixture.state_id,
      leagueId: fixture.league_id,
    },
  };
}

/**
 * Map Backend transformed match to internal match structure
 * @param {Object} backendMatch - Match object from backend (already transformed)
 * @returns {Object} Internal match structure
 */
function mapBackendMatchToInternal(backendMatch) {
  if (!backendMatch) return null;
  
  // Parse commence_time (format: "2025-12-28 22:45:00" - already in Turkey timezone)
  // Backend sends time in Turkey timezone (UTC+3), so we should NOT do timezone conversion
  let startingAt = null;
  let date = '';
  let time = '';
  
  if (backendMatch.commence_time) {
    const timeStr = backendMatch.commence_time;
    // Backend already sends time in Turkey timezone (UTC+3), so use it directly
    if (timeStr.includes(' ')) {
      const [datePart, timePart] = timeStr.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      
      // Format date as DD.MM.YYYY
      date = `${day}.${month}.${year}`;
      // Format time as HH:mm (already in Turkey timezone from backend)
      time = `${hour}:${minute}`;
      
      // Also create Date object for other uses (treat as local time, no conversion needed)
      startingAt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), 0);
    } else {
      // ISO format - backend already sends in Turkey timezone, parse directly
      startingAt = new Date(timeStr);
      if (!isNaN(startingAt.getTime())) {
        // Extract date and time directly (backend already converted to Turkey timezone)
        const year = startingAt.getFullYear();
        const month = String(startingAt.getMonth() + 1).padStart(2, '0');
        const day = String(startingAt.getDate()).padStart(2, '0');
        const hours = String(startingAt.getHours()).padStart(2, '0');
        const minutes = String(startingAt.getMinutes()).padStart(2, '0');
        
        date = `${day}.${month}.${year}`;
        time = `${hours}:${minutes}`;
      }
    }
  }
  
  // Extract odds and convert to markets format
  const markets = [];
  if (backendMatch.odds && Array.isArray(backendMatch.odds) && backendMatch.odds.length > 0) {
    // Group odds by market_id first (to handle multiple bookmakers for same market)
    // If no market_id, group by market_name
    const oddsByMarket = {};
    backendMatch.odds.forEach(odd => {
      const marketId = odd.market_id || null;
      const marketName = odd.market_name || odd.market_description || 'Unknown';
      // Use market_id as primary key, fallback to market_name
      const marketKey = marketId ? `id_${marketId}` : `name_${marketName}`;
      
      if (!oddsByMarket[marketKey]) {
        oddsByMarket[marketKey] = {
          marketId: marketId,
          name: marketName,
          options: {}
        };
      }
      
      // Group options by label
      const label = odd.label || odd.name || '';
      if (!label) return;
      
      const value = odd.value || odd.odd || odd.price || 0;
      if (value <= 0) return;
      
      // Check if this is a correct score market
      const marketNameLower = marketName.toLowerCase();
      const isCorrectScoreMarket = marketNameLower.includes('correct score');
      
      const existingValue = oddsByMarket[marketKey].options[label];
      
      if (!existingValue) {
        oddsByMarket[marketKey].options[label] = value;
      } else {
        // For correct score markets, prefer lower (more reasonable) odds
        // For other markets, prefer higher odds (better for user)
        if (isCorrectScoreMarket) {
          // Use the lower (more reasonable) odds for correct score
          // But exclude very low odds (< 1.5) as they might be errors
          if (value < existingValue && value >= 1.5) {
            oddsByMarket[marketKey].options[label] = value;
          } else if (existingValue < 1.5 && value >= 1.5) {
            // If existing is too low, use the new one if it's reasonable
            oddsByMarket[marketKey].options[label] = value;
          }
        } else {
          // Update if new value is better (higher odds for user)
          if (value > existingValue) {
            oddsByMarket[marketKey].options[label] = value;
          }
        }
      }
    });
    
    // Convert to markets array
    Object.values(oddsByMarket).forEach(market => {
      const options = Object.entries(market.options).map(([label, value]) => ({
        label,
        value
      }));
      
      if (options.length > 0) {
        markets.push({
          marketId: market.marketId,
          name: market.name,
          options: options
        });
      }
    });
  }
  
  return {
    id: backendMatch.id || backendMatch.sportmonks_id?.toString() || '',
    sportmonksId: backendMatch.sportmonks_id || backendMatch.id,
    homeTeam: backendMatch.home_team || 'Home Team',
    awayTeam: backendMatch.away_team || 'Away Team',
    homeTeamId: backendMatch.home_team_id,
    awayTeamId: backendMatch.away_team_id,
    homeTeamLogo: backendMatch.home_team_logo,
    awayTeamLogo: backendMatch.away_team_logo,
    homeScore: backendMatch.home_score,
    awayScore: backendMatch.away_score,
    league: backendMatch.league || '',
    leagueId: backendMatch.league_id,
    leagueLogo: backendMatch.league_logo,
    country: backendMatch.country || '',
    status: backendMatch.status || '',
    minute: backendMatch.minute,
    isLive: backendMatch.is_live || false,
    isFinished: backendMatch.is_finished || false,
    isPostponed: backendMatch.is_postponed || false,
    date,
    time,
    commenceTime: backendMatch.commence_time,
    events: backendMatch.events || [],
    statistics: backendMatch.statistics || [],
    lineups: backendMatch.lineups || [],
    markets,
    odds: backendMatch.odds || [],
    venue: backendMatch.venue,
  };
}

/**
 * Map API response to internal match structure
 * @param {Object} apiMatch - Match object from API
 * @returns {Object} Internal match structure
 */
export function mapApiMatchToInternal(apiMatch) {
  if (!apiMatch) return null;
  
  // Check if this is already transformed by backend (has home_team, away_team, league fields)
  if (apiMatch.home_team && apiMatch.away_team && !apiMatch.sport_id) {
    return mapBackendMatchToInternal(apiMatch);
  }
  
  // Check if this is a Sportmonks V3 fixture (has sport_id, state_id, starting_at fields)
  if (apiMatch.sport_id !== undefined && apiMatch.state_id !== undefined && apiMatch.starting_at) {
    return mapSportmonksFixtureToInternal(apiMatch);
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
  const time = commenceTime ? formatTimeFromISO(commenceTime, true) : ''; // Convert to Turkey timezone for consistency
  
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
 * Format time from Date object
 * @param {Date} dateObj - Date object
 * @param {boolean} useTimezoneConversion - Whether to convert to Turkey timezone (default: false, backend already sends in Turkey timezone)
 * @returns {string} Formatted time (HH:MM)
 */
function formatTimeFromISO(dateObj, useTimezoneConversion = false) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Convert to Turkey timezone (Europe/Istanbul, UTC+3) by default
  // Backend sends UTC time, so we need to add 3 hours for Turkey timezone
  if (useTimezoneConversion) {
    // Use Intl.DateTimeFormat to properly convert to Turkey timezone
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
  
  // Direct format from Date object (backend already in Turkey timezone, no conversion needed)
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
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
 * Extract markets from Sportmonks V3 odds array
 * @param {Array} oddsArray - Odds array from Sportmonks V3
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Array} Markets array
 */
function extractMarketsFromSportmonksOdds(oddsArray, homeTeam, awayTeam) {
  if (!Array.isArray(oddsArray) || oddsArray.length === 0) return [];
  
  const markets = [];
  const marketMap = new Map(); // Group by market_id and market_name
  
  // Backend now sends normalized odds format with: market_name, market_description, label, value, odd, price
  for (const odd of oddsArray) {
    try {
      // Skip stopped odds
      if (odd && odd.stopped === true) continue;
      
      // Get market name/description (backend normalizes this)
      const marketName = odd.market_name || odd.market_description || '';
      if (!marketName) continue;
      
      // Get market_id to group by (use market_id if available, otherwise use market name)
      const marketId = odd.market_id || marketName;
      
      // Get label and value - backend normalizes these
      let label = odd.label || odd.name || '';
      let value = odd.value || odd.odd || odd.price;
      
      // Convert value to number
      const numericValue = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : null);
      
      if (!label || !numericValue || numericValue <= 0 || !isFinite(numericValue)) continue;
      
      // Translate market names to Turkish
      const translatedName = translateMarketName(marketName);
      
      // Check if this is a correct score market
      const marketNameLower = marketName.toLowerCase();
      const isCorrectScoreMarket = marketNameLower.includes('correct score');
      
      // Translate outcome label
      let translatedLabel = translateOutcomeName(label, homeTeam, awayTeam);
      
      // For "Half Time Correct Score" and similar markets, handle score formats
      // If label is a score format (e.g., "1-0", "0-1"), keep it as is
      if (/^\d+-\d+$/.test(label) || /^\d+:\d+$/.test(label)) {
        translatedLabel = label.replace(':', '-'); // Normalize score format
      }
      
      // For "Half Time Correct Score", ensure "1", "2", "Draw" labels are correct
      // API might send "1", "2", "Draw" or "Home", "Away", "Draw"
      if (marketNameLower.includes('correct score') && marketNameLower.includes('half')) {
        // For half time correct score, labels should be score formats or "1", "2", "Draw"
        if (label === '1' || label === 'Home' || label.toLowerCase() === 'home') {
          translatedLabel = '1';
        } else if (label === '2' || label === 'Away' || label.toLowerCase() === 'away') {
          translatedLabel = '2';
        } else if (label === 'Draw' || label === 'X' || label.toLowerCase() === 'draw') {
          translatedLabel = 'Beraberlik';
        }
      }
      
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
      
      // For "Correct Score" markets, use the most reasonable (lowest) odds instead of highest
      // because high odds (500+) are usually for very unlikely scores
      // (isCorrectScoreMarket already defined above)
      
      if (!existingOption) {
        market.options.push({
          label: translatedLabel,
          value: numericValue,
        });
      } else {
        // For correct score markets, prefer lower (more reasonable) odds
        // For other markets, prefer higher odds (better for user)
        if (isCorrectScoreMarket) {
          // Use the lower (more reasonable) odds for correct score
          // But exclude very low odds (< 1.5) as they might be errors
          if (numericValue < existingOption.value && numericValue >= 1.5) {
            existingOption.value = numericValue;
          } else if (existingOption.value < 1.5 && numericValue >= 1.5) {
            // If existing is too low, use the new one if it's reasonable
            existingOption.value = numericValue;
          }
        } else {
          // Update if new value is better (higher odds for user)
          if (numericValue > existingOption.value) {
            existingOption.value = numericValue;
          }
        }
      }
    } catch (error) {
      // Skip invalid odds entries
      console.warn('Error processing odd entry:', error, odd);
      continue;
    }
  }
  
  // Include all markets with at least 2 options (removed popular market filter to show all markets)
  for (const [marketId, market] of marketMap.entries()) {
    // Include markets with at least 2 options, or single option markets if they're important (1X2)
    if (market.options.length >= 2 || (market.options.length === 1 && market.name === 'Maç Sonucu')) {
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
    'half time correct score': 'İlk Yarı Kesin Skor',
    'first half correct score': 'İlk Yarı Kesin Skor',
    'ht correct score': 'İlk Yarı Kesin Skor',
    'full time correct score': 'Maç Kesin Skor',
    'ft correct score': 'Maç Kesin Skor',
    'handicap': 'Handikap',
    'european handicap': 'Avrupa Handikapı',
    'first half result': 'İlk Yarı Sonucu',
    'half time result': 'İlk Yarı Sonucu',
    'ht result': 'İlk Yarı Sonucu',
    'first half goals': 'İlk Yarı Golleri',
    'half time goals': 'İlk Yarı Golleri',
    'ht goals': 'İlk Yarı Golleri',
    'first team to score': 'İlk Golü Atan',
    'first goal scorer': 'İlk Golü Atan',
    'anytime goal scorer': 'Gol Atan',
    'win margin': 'Kazanma Farkı',
    'winning margin': 'Kazanma Farkı',
    'exact goals': 'Kesin Gol Sayısı',
    'team total': 'Takım Toplamı',
    'player goals': 'Oyuncu Golleri',
    'player assists': 'Oyuncu Asistleri',
    'clean sheet': 'Kaleci Sıfırı',
    'to win to nil': 'Sıfırla Kazanma',
    'to win both halves': 'Her İki Yarıyı Kazanma',
    'to score in both halves': 'Her İki Yarıda Gol',
    'highest scoring half': 'En Çok Gol Atılan Yarı',
    'corners': 'Kornerler',
    'total corners': 'Toplam Korner',
    'cards': 'Kartlar',
    'total cards': 'Toplam Kart',
    'yellow cards': 'Sarı Kartlar',
    'red cards': 'Kırmızı Kartlar',
    'penalties': 'Penaltılar',
    'offsides': 'Ofsaytlar',
    'fouls': 'Fauller',
  };
  
  const lowerName = marketName.toLowerCase().trim();
  
  // Check exact match first
  if (translations[lowerName]) {
    return translations[lowerName];
  }
  
  // Check partial match (contains)
  for (const [key, value] of Object.entries(translations)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  
  // If no translation found, try to translate common English words
  let translated = marketName;
  
  // Translate common words
  translated = translated.replace(/\bhalf time\b/gi, 'İlk Yarı');
  translated = translated.replace(/\bfirst half\b/gi, 'İlk Yarı');
  translated = translated.replace(/\bfull time\b/gi, 'Maç');
  translated = translated.replace(/\bcorrect score\b/gi, 'Kesin Skor');
  translated = translated.replace(/\bresult\b/gi, 'Sonuç');
  translated = translated.replace(/\bgoals\b/gi, 'Goller');
  translated = translated.replace(/\bgoal\b/gi, 'Gol');
  translated = translated.replace(/\bover\b/gi, 'Üst');
  translated = translated.replace(/\bunder\b/gi, 'Alt');
  translated = translated.replace(/\btotal\b/gi, 'Toplam');
  translated = translated.replace(/\bto score\b/gi, 'Gol Atma');
  translated = translated.replace(/\bto win\b/gi, 'Kazanma');
  translated = translated.replace(/\bdraw\b/gi, 'Beraberlik');
  translated = translated.replace(/\bhome\b/gi, 'Ev Sahibi');
  translated = translated.replace(/\baway\b/gi, 'Deplasman');
  
  return translated;
}

/**
 * Translate outcome names to Turkish
 * @param {string} outcomeName - Outcome name
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {string} Translated outcome name
 */
function translateOutcomeName(outcomeName, homeTeam, awayTeam) {
  if (!outcomeName) return outcomeName;
  
  const lower = outcomeName.toLowerCase().trim();
  
  // Basic translations
  if (lower === 'home' || lower === '1' || lower === 'h') return '1';
  if (lower === 'away' || lower === '2' || lower === 'a') return '2';
  if (lower === 'draw' || lower === 'x' || lower === 'd') return 'X';
  if (lower === 'yes' || lower === 'evet') return 'Var';
  if (lower === 'no' || lower === 'hayır') return 'Yok';
  if (lower === 'over' || lower === 'üst') return 'Üst';
  if (lower === 'under' || lower === 'alt') return 'Alt';
  if (lower === 'odd' || lower === 'tek') return 'Tek';
  if (lower === 'even' || lower === 'çift') return 'Çift';
  
  // Score formats (e.g., "1-0", "0-1", "2-1")
  if (/^\d+-\d+$/.test(outcomeName)) {
    return outcomeName; // Keep score format as is
  }
  
  // If it matches team names, use 1 or 2
  if (homeTeam && outcomeName.toLowerCase().includes(homeTeam.toLowerCase())) return '1';
  if (awayTeam && outcomeName.toLowerCase().includes(awayTeam.toLowerCase())) return '2';
  
  // Try to translate common English words in outcome names
  let translated = outcomeName;
  translated = translated.replace(/\bhome\b/gi, '1');
  translated = translated.replace(/\baway\b/gi, '2');
  translated = translated.replace(/\bdraw\b/gi, 'X');
  translated = translated.replace(/\byes\b/gi, 'Var');
  translated = translated.replace(/\bno\b/gi, 'Yok');
  translated = translated.replace(/\bover\b/gi, 'Üst');
  translated = translated.replace(/\bunder\b/gi, 'Alt');
  
  return translated;
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

