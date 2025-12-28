import { useQuery } from '@tanstack/react-query';
import * as footballService from '../services/football';
import { mapApiMatchesToInternal } from '../utils/matchMapper';

/**
 * Custom hook for fetching matches with React Query caching
 * Uses Sportmonks V3 API via backend proxy
 * Fetches all matches (upcoming, live, finished) for a date range
 * @param {Object} filters - Filter options (date_from, date_to, league_id, matchType)
 * @param {Object} options - Query options (enabled, staleTime, etc.)
 */
export function useMatches(filters = {}, options = {}) {
  // Calculate default date range (today to 7 days ahead)
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Build filters with defaults
  const queryFilters = {
    date_from: filters.date_from || today,
    date_to: filters.date_to || sevenDaysLater,
    league_id: filters.league_id || null,
    ...filters
  };
  
  // Create a stable query key from filters
  const queryKey = ['matches', queryFilters.date_from, queryFilters.date_to, queryFilters.league_id];
  
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // Use Backend API to get matches with filters
      const apiMatches = await footballService.getUpcomingFixtures(queryFilters);
      // Ensure it's an array
      const matchesArray = Array.isArray(apiMatches) ? apiMatches : [apiMatches].filter(Boolean);
      return mapApiMatchesToInternal(matchesArray);
    },
    enabled: options.enabled !== undefined ? options.enabled : true, // Allow conditional fetching
    staleTime: options.staleTime || 60000, // Data is fresh for 60 seconds (optimized from 30s)
    cacheTime: options.cacheTime || 300000, // Cache unused data for 5 minutes (optimized from 3min)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Use cache if available
    refetchInterval: options.refetchInterval !== undefined ? options.refetchInterval : 60000, // Auto-refetch every 60 seconds for general matches (optimized from 45s)
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
export function useLiveMatches(matchType = 1) {
  const query = useQuery({
    queryKey: ['liveMatches', matchType],
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
    staleTime: 15000, // Live matches are fresh for 15 seconds (optimized for live data)
    cacheTime: 60000, // Cache live matches for 1 minute
    refetchInterval: 20000, // Auto-refetch every 20 seconds for live matches (optimized from 30s for better real-time updates)
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
    staleTime: 20000, // Data is fresh for 20 seconds (optimized from 30s)
    cacheTime: 300000, // Cache unused data for 5 minutes
    // Dynamic refetch interval based on match status
    refetchInterval: (query) => {
      const match = query.state.data;
      if (match?.isLive) {
        return 20000; // 20 seconds for live matches (optimized from 30s for better real-time updates)
      } else if (match?.isFinished) {
        return 60000; // 60 seconds for finished matches
      }
      return false; // No auto-refresh for upcoming matches
    },
  });

  return {
    match: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}