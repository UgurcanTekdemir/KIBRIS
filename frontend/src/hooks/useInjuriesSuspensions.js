import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching injuries and suspensions
 */
export function useInjuriesSuspensions(teamId = null, leagueId = null) {
  const query = useQuery({
    queryKey: ['injuriesSuspensions', teamId, leagueId],
    queryFn: async () => {
      const injuries = await matchAPI.getInjuriesSuspensions(teamId, leagueId);
      return injuries;
    },
    staleTime: 60000, // 1 minute (changes frequently)
    cacheTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    injuries: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}










