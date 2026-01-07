import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as footballService from '../services/football';
import { mapApiMatchesToInternal } from '../utils/matchMapper';
import { getToday, getDateFromToday } from '../utils/dateHelpers';

/**
 * Custom hook for fetching matches with React Query caching
 * Uses Sportmonks V3 API via backend proxy
 * Optimized with memoized date calculations
 * @param {Object} filters - Filter options (date_from, date_to, league_id, matchType)
 * @param {Object} options - Query options (enabled, staleTime, etc.)
 */
export function useMatches(filters = {}, options = {}) {
  // Memoize default date range (only recalculate once per day)
  const defaultToday = useMemo(() => getToday(), []);
  const defaultSevenDaysLater = useMemo(() => getDateFromToday(7), []);
  
  // Build filters with defaults (memoized)
  const queryFilters = useMemo(() => ({
    date_from: filters.date_from || defaultToday,
    date_to: filters.date_to || defaultSevenDaysLater,
    league_id: filters.league_id || null,
    ...filters
  }), [filters.date_from, filters.date_to, filters.league_id, defaultToday, defaultSevenDaysLater]);
  
  // Create a stable query key from filters
  const queryKey = useMemo(() => [
    'matches', 
    queryFilters.date_from, 
    queryFilters.date_to, 
    queryFilters.league_id
  ], [queryFilters.date_from, queryFilters.date_to, queryFilters.league_id]);
  
  // Check if query is enabled
  const isEnabled = options.enabled !== undefined ? options.enabled : true;
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 useMatches hook called:', { queryFilters, isEnabled, queryKey });
  }
  
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        console.log('🔄 useMatches queryFn called with filters:', queryFilters);
        // Use Backend API to get matches with filters
        const apiMatches = await footballService.getUpcomingFixtures(queryFilters);
        console.log('📥 useMatches received data:', Array.isArray(apiMatches) ? `${apiMatches.length} matches` : typeof apiMatches);
        // Ensure it's an array
        const matchesArray = Array.isArray(apiMatches) 
          ? apiMatches 
          : [apiMatches].filter(Boolean);
        const mapped = mapApiMatchesToInternal(matchesArray);
        console.log('✅ useMatches mapped:', mapped.length, 'matches');
        return mapped;
      } catch (error) {
        console.error('❌ Error fetching matches:', error);
        throw error;
      }
    },
    enabled: options.enabled !== undefined ? options.enabled : true,
    staleTime: options.staleTime !== undefined ? options.staleTime : 0,
    cacheTime: options.cacheTime || 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: (query) => {
      // Only poll when page is visible (not in background)
      if (typeof document !== 'undefined' && document.hidden) {
        return false; // Stop polling when page is hidden
      }
      // Pre-match matches: poll every 60-120 seconds (use 90 seconds as average)
      return options.refetchInterval !== undefined ? options.refetchInterval : 90000;
    },
  });

  return {
    matches: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Custom hook for fetching live matches with React Query caching
 * Uses Sportmonks V3 API via backend proxy
 * Auto-refreshes every 30 seconds for live data
 */
export function useLiveMatches(matchType = 1, leagueIds = null) {
  const query = useQuery({
    queryKey: ['liveMatches', matchType, leagueIds],
    queryFn: async () => {
      // Use Sportmonks V3 API to get live scores
      const apiMatches = await footballService.getLivescores(leagueIds);
      // Ensure it's an array
      const matchesArray = Array.isArray(apiMatches) ? apiMatches : [apiMatches].filter(Boolean);
      const mappedMatches = mapApiMatchesToInternal(matchesArray);
      // Filter only live matches that are NOT finished
      // Also include matches with scores/events even if isLive is not explicitly true
      return mappedMatches.filter(m => {
        // Explicitly live and not finished
        if (m.isLive === true && m.isFinished !== true) return true;
        // Has scores (indicates match has started)
        if ((m.homeScore !== null && m.homeScore !== undefined) || 
            (m.awayScore !== null && m.awayScore !== undefined)) {
          // Not finished
          if (m.isFinished !== true) return true;
        }
        // Has events (indicates match activity)
        if (m.events && Array.isArray(m.events) && m.events.length > 0) {
          // Not finished
          if (m.isFinished !== true) return true;
        }
        return false;
      });
    },
    staleTime: 5000, // Live matches are fresh for 5 seconds (in-play data updates frequently)
    cacheTime: 60000, // Cache live matches for 1 minute
    refetchInterval: (query) => {
      // Only poll when page is visible (not in background)
      if (typeof document !== 'undefined' && document.hidden) {
        return false; // Stop polling when page is hidden
      }
      return 10000; // Auto-refetch every 10 seconds for live matches (in-play data updates every 5-15 seconds)
    },
  });

  return {
    matches: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Custom hook for fetching a single match by ID
 * Uses Sportmonks V3 API via backend proxy
 * Auto-refreshes every 30 seconds if match is live, 60 seconds if finished
 */
export function useMatchDetails(matchId) {
  const query = useQuery({
    queryKey: ['matchDetails', matchId],
    queryFn: async () => {
      if (!matchId) return null;

      const { mapApiMatchToInternal } = await import('../utils/matchMapper');

      // Get match details from Sportmonks V3
      const apiMatch = await footballService.getFixtureById(parseInt(matchId, 10));
      if (apiMatch) {
        const mappedMatch = mapApiMatchToInternal(apiMatch);
        if (!mappedMatch) {
          throw new Error('Maç verileri işlenemedi');
        }
        return mappedMatch;
      }

      throw new Error('Maç bulunamadı');
    },
    enabled: !!matchId, // Only run query if matchId exists
    staleTime: 7000, // Data is fresh for 7 seconds (in-play cache 5-10s, pre-match 60-120s)
    cacheTime: 300000, // Cache unused data for 5 minutes
    // Dynamic refetch interval based on match status
    refetchInterval: (query) => {
      // Only poll when page is visible (not in background)
      if (typeof document !== 'undefined' && document.hidden) {
        return false; // Stop polling when page is hidden
      }
      
      const match = query.state.data;
      const isHalfTime = match?.status === 'HT' || match?.status === 'HALF_TIME';
      if (match?.isLive && !match?.isFinished) {
        return 10000; // 10 seconds for live matches (in-play data updates every 5-15 seconds)
      } else if (isHalfTime || match?.isFinished) {
        return 120000; // 120 seconds for half-time and finished matches (pre-match cache)
      }
      return 120000; // 120 seconds for upcoming matches (pre-match cache 60-300s)
    },
  });

  return {
    match: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}