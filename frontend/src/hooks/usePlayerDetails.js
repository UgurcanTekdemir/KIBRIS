import { useQuery } from '@tanstack/react-query';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching player details
 */
export function usePlayerDetails(playerId) {
  const query = useQuery({
    queryKey: ['playerDetails', playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const player = await matchAPI.getPlayerDetails(playerId);
      return player;
    },
    enabled: !!playerId,
    staleTime: 300000, // 5 minutes
    cacheTime: 900000, // 15 minutes
    refetchOnWindowFocus: false,
  });

  return {
    player: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

