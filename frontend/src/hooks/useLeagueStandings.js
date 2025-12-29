import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching league standings
 */
export function useLeagueStandings(leagueId, season = null) {
  const query = useQuery({
    queryKey: ['leagueStandings', leagueId, season],
    queryFn: async () => {
      const standings = await matchAPI.getLeagueStandings(leagueId, season);
      return standings;
    },
    enabled: !!leagueId,
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    standings: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}






