import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching team details
 */
export function useTeamDetails(teamId) {
  const query = useQuery({
    queryKey: ['teamDetails', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const team = await matchAPI.getTeamDetails(teamId);
      return team;
    },
    enabled: !!teamId,
    staleTime: 300000, // 5 minutes
    cacheTime: 900000, // 15 minutes
    refetchOnWindowFocus: false,
  });

  return {
    team: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

