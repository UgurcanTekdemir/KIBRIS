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
  }), [filters, defaultToday, defaultSevenDaysLater]);
  
  // Create a stable query key from filters
  const queryKey = useMemo(() => [
    'matches', 
    queryFilters.date_from, 
    queryFilters.date_to, 
    queryFilters.league_id
  ], [queryFilters.date_from, queryFilters.date_to, queryFilters.league_id]);
  
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        // Use Backend API to get matches with filters
        const apiMatches = await footballService.getUpcomingFixtures(queryFilters);
        // Ensure it's an array
        const matchesArray = Array.isArray(apiMatches) 
          ? apiMatches 
          : [apiMatches].filter(Boolean);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Fetched matches:', matchesArray.length, 'items');
        }
        
        const mapped = mapApiMatchesToInternal(matchesArray);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Mapped matches:', mapped.length, 'items');
        }
        
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
    refetchInterval: options.refetchInterval !== undefined ? options.refetchInterval : 90000, // 90 seconds
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
      const apiMatches = await footballService.getLivescores();
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
    staleTime: 0, // Live matches are never stale (always refetch for freshness)
    cacheTime: 60000, // Cache live matches for 1 minute
    refetchInterval: 5000, // Auto-refetch every 5 seconds for live matches (aligns with backend cache of 4s)
    refetchIntervalInBackground: true, // Continue refetching even when tab is in background
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
    staleTime: 0, // Data is never stale (always refetch for freshness)
    cacheTime: 300000, // Cache unused data for 5 minutes
    refetchIntervalInBackground: true, // Continue refetching even when tab is in background
    // Dynamic refetch interval based on match status
    refetchInterval: (query) => {
      const match = query.state.data;
      if (match?.isLive && !match?.isFinished) {
        return 5000; // 5 seconds for live matches (aligns with backend cache of 4s)
      } else if (match?.isFinished) {
        return false; // Disable refetch for finished matches (they don't change)
      }
      return 180000; // 180 seconds (3 minutes) for upcoming matches (aligns with backend cache)
    },
  });

  return {
    match: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}