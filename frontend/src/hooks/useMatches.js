import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';
import { mapApiMatchesToInternal } from '../utils/matchMapper';

/**
 * Custom hook for fetching matches with React Query caching
 */
export function useMatches(filters = {}) {
  // Create a stable query key from filters
  const queryKey = ['matches', filters.matchType, filters.league, filters.date, filters.country];
  
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const apiMatches = await matchAPI.getMatches(filters);
      return mapApiMatchesToInternal(apiMatches);
    },
    staleTime: 30000, // Data is fresh for 30 seconds (reduced for faster updates)
    cacheTime: 180000, // Cache unused data for 3 minutes (reduced memory usage)
    refetchOnWindowFocus: false, // Don't refetch on window focus (improve performance)
    refetchOnMount: false, // Use cache if available (improve performance)
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
 */
export function useLiveMatches(matchType = 1) {
  const query = useQuery({
    queryKey: ['liveMatches', matchType],
    queryFn: async () => {
      const apiMatches = await matchAPI.getLiveMatches(matchType);
      const mappedMatches = mapApiMatchesToInternal(apiMatches || []);
      // Filter only live matches that are NOT finished
      return mappedMatches.filter(m => m.isLive === true && m.isFinished !== true);
    },
    staleTime: 30000, // Live matches are fresh for 30 seconds
    cacheTime: 60000, // Cache live matches for 1 minute
    refetchInterval: 30000, // Auto-refetch every 30 seconds for live matches
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
 */
export function useMatchDetails(matchId) {
  const query = useQuery({
    queryKey: ['matchDetails', matchId],
    queryFn: async () => {
      if (!matchId) return null;

      const { mapApiMatchToInternal } = await import('../utils/matchMapper');

      // 1) Prefer the dedicated detail endpoint
      const apiMatch = await matchAPI.getMatchDetails(matchId);
      if (apiMatch) {
        const mappedMatch = mapApiMatchToInternal(apiMatch);
        if (!mappedMatch) {
          throw new Error('Maç verileri işlenemedi');
        }
        return mappedMatch;
      }

      // 2) Fallback: some IDs cannot be resolved via /matches/{id} even though they exist in the match list.
      // In that case, pull the match list and locate the item by ID.
      const apiMatches = await matchAPI.getMatches({});
      const fallbackApiMatch = apiMatches.find(m => String(m?.id) === String(matchId));

      if (!fallbackApiMatch) {
        throw new Error('Maç bulunamadı');
      }

      const fallbackMapped = mapApiMatchToInternal(fallbackApiMatch);
      if (!fallbackMapped) {
        throw new Error('Maç verileri işlenemedi');
      }

      return fallbackMapped;
    },
    enabled: !!matchId, // Only run query if matchId exists
    staleTime: 60000, // Data is fresh for 1 minute
    cacheTime: 300000, // Cache unused data for 5 minutes
  });

  return {
    match: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}