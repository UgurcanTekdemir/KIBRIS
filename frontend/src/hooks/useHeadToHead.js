import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching head-to-head statistics
 */
export function useHeadToHead(team1Id, team2Id) {
  const query = useQuery({
    queryKey: ['headToHead', team1Id, team2Id],
    queryFn: async () => {
      if (!team1Id || !team2Id) return null;
      const h2h = await matchAPI.getHeadToHead(team1Id, team2Id);
      return h2h;
    },
    enabled: !!team1Id && !!team2Id,
    staleTime: 600000, // 10 minutes
    cacheTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  return {
    h2h: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}






