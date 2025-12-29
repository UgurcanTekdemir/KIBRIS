import { useQuery } from '@tanstack/react-query';
import { getLeagues } from '../services/football';

/**
 * Custom hook for fetching leagues with React Query caching
 * Uses Sportmonks V3 API via backend proxy
 * Fetches all available leagues
 * @param {Object} options - Query options (enabled, staleTime, etc.)
 */
export function useLeagues(options = {}) {
  const query = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const response = await getLeagues();
      
      // Handle response format (could be { data: [...], success: true } or direct array)
      let leaguesData = [];
      if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          leaguesData = response.data;
        } else if (response.success && response.data && Array.isArray(response.data)) {
          leaguesData = response.data;
        } else if (Array.isArray(response)) {
          leaguesData = response;
        }
      }
      
      // Transform leagues data to match our format
      const transformedLeagues = leaguesData.map(league => {
        // Extract country name from nested structure
        let countryName = '';
        if (league.country) {
          if (typeof league.country === 'string') {
            countryName = league.country;
          } else if (league.country.name) {
            countryName = league.country.name;
          } else if (league.country.data && league.country.data.name) {
            countryName = league.country.data.name;
          }
        }
        
        // Extract season info if available
        let season = '';
        if (league.current_season) {
          if (typeof league.current_season === 'object') {
            const seasonData = league.current_season.data || league.current_season;
            if (seasonData && seasonData.name) {
              season = seasonData.name;
            } else if (seasonData && seasonData.year) {
              season = seasonData.year.toString();
            }
          }
        }
        
        return {
          id: league.id,
          league_id: league.id,
          name: league.name || '',
          league_name: league.name || '',
          country: countryName,
          image_path: league.image_path || null,
          short_code: league.short_code || null,
          type: league.type || '',
          sub_type: league.sub_type || '',
          active: league.active !== false, // Default to true if not specified
          season: season,
          last_played_at: league.last_played_at || null,
        };
      }).filter(league => league.active); // Only show active leagues
      
      return transformedLeagues;
    },
    enabled: options.enabled !== undefined ? options.enabled : true,
    staleTime: options.staleTime || 300000, // Data is fresh for 5 minutes
    cacheTime: options.cacheTime || 600000, // Cache unused data for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Use cache if available
  });

  return {
    leagues: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

