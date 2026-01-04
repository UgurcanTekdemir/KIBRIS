/**
 * Match utility functions
 * Optimized match filtering and processing helpers
 */

import { 
  getMatchDate, 
  getMatchDateTime, 
  parseMatchDateTime,
  isMatchFinished,
  isMatchLive,
  isMatchHalfTime,
  isMatchPostponed,
  normalizeDateForComparison,
  getToday,
  getDateFromToday
} from './dateHelpers';

/**
 * Group matches by league ID (optimized single pass)
 */
export function groupMatchesByLeague(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return new Map();
  }
  
  const grouped = new Map();
  
  for (const match of matches) {
    const matchLeagueId = match.sportmonksData?.leagueId || 
                         match.leagueId || 
                         match.league_id || 
                         match.league?.id;
    
    if (matchLeagueId) {
      const leagueId = typeof matchLeagueId === 'string' 
        ? parseInt(matchLeagueId, 10) 
        : matchLeagueId;
      
      if (!isNaN(leagueId)) {
        if (!grouped.has(leagueId)) {
          grouped.set(leagueId, []);
        }
        grouped.get(leagueId).push(match);
      }
    }
  }
  
  return grouped;
}

/**
 * Filter valid matches (not finished, not postponed, within date range)
 * Optimized single-pass filter
 */
export function filterValidMatches(matches, dateFrom, dateTo) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }
  
  const normalizedFrom = normalizeDateForComparison(dateFrom);
  const normalizedTo = normalizeDateForComparison(dateTo);
  
  return matches.filter(match => {
    // Exclude finished matches
    if (isMatchFinished(match)) return false;
    
    // Exclude postponed matches
    if (isMatchPostponed(match)) return false;
    
    // Check date range
    const matchDate = normalizeDateForComparison(getMatchDate(match));
    if (!matchDate) return false;
    
    return matchDate >= normalizedFrom && matchDate <= normalizedTo;
  });
}

/**
 * Sort matches by date and time (earliest first)
 */
export function sortMatchesByDateTime(matches) {
  return [...matches].sort((a, b) => {
    const aTime = parseMatchDateTime(getMatchDateTime(a));
    const bTime = parseMatchDateTime(getMatchDateTime(b));
    
    if (!aTime || !bTime) return 0;
    return aTime - bTime;
  });
}

/**
 * Filter today's matches within time window
 * If no matches in window, returns all today's upcoming matches
 */
export function filterTodayMatchesWithinWindow(matches, hoursAhead = 1) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }
  
  const today = getToday();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  // First, get all today's upcoming matches (not finished, not live, not postponed)
  const todayUpcoming = matches.filter(match => {
    const matchDate = getMatchDate(match);
    if (normalizeDateForComparison(matchDate) !== today) return false;
    
    // Exclude finished/postponed
    if (isMatchFinished(match) || isMatchPostponed(match)) return false;
    
    // Exclude live/half-time
    if (isMatchLive(match) || isMatchHalfTime(match)) return false;
    
    // Must be in the future
    const matchDateTime = parseMatchDateTime(getMatchDateTime(match));
    if (!matchDateTime || matchDateTime < now) return false;
    
    return true;
  });
  
  // Filter by time window
  const inWindow = todayUpcoming.filter(match => {
    const matchDateTime = parseMatchDateTime(getMatchDateTime(match));
    return matchDateTime && matchDateTime <= windowEnd;
  });
  
  // If matches found in window, return them; otherwise return all today's upcoming matches
  return inWindow.length > 0 ? inWindow : todayUpcoming;
}

/**
 * Filter upcoming matches (future matches, not live/finished)
 */
export function filterUpcomingMatches(matches, dateFrom, dateTo) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }
  
  const normalizedFrom = normalizeDateForComparison(dateFrom);
  const normalizedTo = normalizeDateForComparison(dateTo);
  const now = new Date();
  
  return matches.filter(match => {
    // Exclude finished/postponed
    if (isMatchFinished(match) || isMatchPostponed(match)) return false;
    
    // Exclude live/half-time
    if (isMatchLive(match) || isMatchHalfTime(match)) return false;
    
    // Check date range
    const matchDate = normalizeDateForComparison(getMatchDate(match));
    if (!matchDate) return false;
    if (matchDate < normalizedFrom || matchDate > normalizedTo) return false;
    
    // Exclude past matches (by datetime)
    const matchDateTime = parseMatchDateTime(getMatchDateTime(match));
    if (matchDateTime && matchDateTime < now) return false;
    
    return true;
  });
}

