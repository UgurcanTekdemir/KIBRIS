/**
 * API Service Layer
 * Handles all API calls to the backend
 */

// Get API base URL - remove trailing /api if present to avoid double /api
const isProduction = process.env.NODE_ENV === 'production';
const rawApiUrl = process.env.REACT_APP_API_URL || (isProduction ? null : 'http://localhost:8000');

// Validate and construct API base URL
if (isProduction && !rawApiUrl) {
  const errorMsg = 
    'REACT_APP_API_URL environment variable is not set in production. ' +
    'Please set it to your backend URL (e.g., https://your-backend.railway.app) ' +
    'in your Vercel/Railway environment variables. ' +
    'The URL should NOT include /api suffix.';
  console.error('❌ API Configuration Error:', errorMsg);
  throw new Error(errorMsg);
}

// Clean the URL (remove trailing /api if present) and add /api
const cleanApiUrl = rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, '') : null;
const API_BASE_URL = cleanApiUrl ? `${cleanApiUrl}/api` : 'http://localhost:8000/api';

// Log API URL only in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:');
  console.log('  - REACT_APP_API_URL:', process.env.REACT_APP_API_URL || 'NOT SET');
  console.log('  - Raw API URL:', rawApiUrl);
  console.log('  - Clean API URL:', cleanApiUrl);
  console.log('  - Final API_BASE_URL:', API_BASE_URL);
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make a fetch request with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Log API calls only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🌐 API Call:', url);
  }
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add timeout for fetch requests (60 seconds for large date ranges)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
  
  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    // Check if response is ok before trying to parse JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, try to get text
        const text = await response.text();
        console.error('JSON parse error. Response text:', text);
        throw new ApiError(
          `Invalid JSON response: ${text.substring(0, 100)}`,
          response.status,
          { raw: text }
        );
      }
    } else {
      // Non-JSON response
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      throw new ApiError(
        data.detail || data.message || `API request failed (${response.status})`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      throw new ApiError(
        'İstek zaman aşımına uğradı. Lütfen daha sonra tekrar deneyin.',
        408,
        { originalError: error.message, url }
      );
    }
    
    // Network errors (CORS, connection refused, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Network error:', error);
      console.error('Attempted URL:', url);
      throw new ApiError(
        `Backend'e bağlanılamıyor. Lütfen backend URL'ini kontrol edin: ${API_BASE_URL}`,
        0,
        { originalError: error.message, url }
      );
    }
    
    throw new ApiError(
      error.message || 'Bilinmeyen bir hata oluştu',
      0,
      { originalError: error.message }
    );
  }
}

/**
 * Match API Service
 * Uses Sportmonks V3 API via backend proxy
 */
export const matchAPI = {
  /**
   * Get all matches (upcoming, live, finished) with optional filters
   * Uses Sportmonks V3 fixtures endpoint via backend
   * @param {Object} filters - { matchType, league_id, date_from, date_to }
   * @returns {Promise<Array>} List of matches with odds
   */
  async getMatches(filters = {}) {
    const params = new URLSearchParams();
    
    // Date range filters
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    
    // League filter
    if (filters.league_id) params.append('league_id', filters.league_id);

    const queryString = params.toString();
    const endpoint = `/matches${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get live matches from Sportmonks V3
   * @param {number} matchType - Match type (1=Futbol, 2=Basketbol, etc.)
   * @returns {Promise<Array>} List of live matches
   */
  async getLiveMatches(matchType = 1) {
    const response = await fetchAPI(`/matches/live?match_type=${matchType}`);
    return response.data || [];
  },

  /**
   * Get match details by ID
   * @param {string} matchId - Match ID
   * @returns {Promise<Object>} Match details
   */
  async getMatchDetails(matchId) {
    try {
      const response = await fetchAPI(`/matches/${matchId}`);
      return response.data || null;
    } catch (error) {
      // Match not found is a valid scenario for some IDs; callers can decide how to fallback.
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // NOTE: StatPal endpoints removed - backend no longer supports StatPal API
  // These methods are commented out as they depend on StatPal backend endpoints
  // TODO: Implement these features using Sportmonks V3 API in the future
  
  // /**
  //  * Get popular matches
  //  * @param {number} matchType - Match type
  //  * @returns {Promise<Array>} List of popular matches
  //  */
  // async getPopularMatches(matchType = 1) {
  //   const response = await fetchAPI(`/matches/popular?match_type=${matchType}`);
  //   return response.data || [];
  // },

  /**
   * Get available leagues
   * Extracts unique leagues from matches data (Sportmonks V3)
   * @param {Object} filters - { matchType, country }
   * @returns {Promise<Array>} List of leagues
   */
  async getLeagues(filters = {}) {
    try {
      // Fetch matches to extract leagues from
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const matches = await this.getMatches({
        date_from: today,
        date_to: sevenDaysLater,
        ...filters
      });
      
      // Extract unique leagues from matches
      const leagueMap = new Map();
      
      matches.forEach(match => {
        if (match.league && match.league_id) {
          const leagueId = String(match.league_id);
          if (!leagueMap.has(leagueId)) {
            leagueMap.set(leagueId, {
              id: leagueId,
              name: match.league,
              country: match.country || '',
              logo: match.league_logo || null,
              sport_key: match.sportKey || 'soccer'
            });
          }
        }
      });
      
      // Convert map to array and filter by country if specified
      let leagues = Array.from(leagueMap.values());
      
      if (filters.country) {
        leagues = leagues.filter(league => 
          league.country && league.country.toLowerCase().includes(filters.country.toLowerCase())
        );
      }
      
      // Sort by name
      leagues.sort((a, b) => a.name.localeCompare(b.name));
      
      return leagues;
    } catch (error) {
      console.error('Error fetching leagues:', error);
      return [];
    }
  },

  // /**
  //  * Get available countries
  //  * @param {number} matchType - Match type
  //  * @returns {Promise<Array>} List of countries
  //  */
  // async getCountries(matchType = 1) {
  //   const response = await fetchAPI(`/countries?match_type=${matchType}`);
  //   return response.data || [];
  // },

  /**
   * Get match events (goals, cards, substitutions) from Sportmonks V3
   * @param {string} matchId - Match ID (Sportmonks fixture ID)
   * @returns {Promise<Array>} List of match events
   */
  async getMatchEvents(matchId) {
    const response = await fetchAPI(`/matches/${matchId}/events`);
    return response.data || [];
  },

  /**
   * Get match statistics (possession, shots, etc.) from Sportmonks V3
   * @param {string} matchId - Match ID (Sportmonks fixture ID)
   * @returns {Promise<Array>} Match statistics array
   */
  async getMatchStatistics(matchId) {
    try {
      const response = await fetchAPI(`/matches/${matchId}/statistics`);
      return response.data || null;
    } catch (error) {
      // Some matches simply don't have statistics available; treat as empty instead of error.
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get match lineups (starting XI and substitutes) from Sportmonks V3
   * @param {string} matchId - Match ID (Sportmonks fixture ID)
   * @returns {Promise<Array>} Match lineups array
   */
  async getMatchLineups(matchId) {
    const response = await fetchAPI(`/matches/${matchId}/lineups`);
    return response.data || null;
  },

  /**
   * Get match odds from Sportmonks V3
   * @param {string} matchId - Match ID (Sportmonks fixture ID)
   * @returns {Promise<Array>} Match odds array (filtered to popular markets)
   */
  async getMatchOdds(matchId) {
    try {
      const response = await fetchAPI(`/matches/${matchId}/odds`);
      return response.data || [];
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return [];
      }
      throw error;
    }
  },

  // NOTE: StatPal endpoints removed - backend no longer supports StatPal API
  // These methods are commented out as they depend on StatPal backend endpoints
  // TODO: Implement these features using Sportmonks V3 API in the future
  
  // /**
  //  * Get league standings from StatPal Soccer(V2) via backend passthrough
  //  * @param {string} leagueId - StatPal league id
  //  * @param {string|null} season - Optional season (backend may ignore if not supported)
  //  * @returns {Promise<Object|null>} Standings payload
  //  */
  // async getLeagueStandings(leagueId, season = null) {
  //   if (!leagueId) return null;
  //   const qs = season ? `?season=${encodeURIComponent(season)}` : '';
  //   const response = await fetchAPI(`/standings/statpal/${leagueId}${qs}`);
  //   return response.data || null;
  // },

  // /**
  //  * Get available seasons from StatPal Soccer(V2)
  //  * Note: current backend endpoint returns a global seasons list (leagueId is kept for compatibility).
  //  * @param {string|null} leagueId
  //  * @returns {Promise<Array>}
  //  */
  // async getLeagueSeasons(leagueId = null) {
  //   const response = await fetchAPI('/seasons/statpal');
  //   return response.data || [];
  // },

  // /**
  //  * Get head-to-head data from StatPal Soccer(V2)
  //  */
  // async getHeadToHead(team1Id, team2Id) {
  //   if (!team1Id || !team2Id) return null;
  //   const response = await fetchAPI(`/head-to-head/statpal?team1_id=${team1Id}&team2_id=${team2Id}`);
  //   return response.data || null;
  // },

  // /**
  //  * Get injuries & suspensions from StatPal Soccer(V2)
  //  * @param {string|null} teamId
  //  * @param {string|null} leagueId - kept for compatibility (may be ignored if backend doesn't support)
  //  */
  // async getInjuriesSuspensions(teamId = null, leagueId = null) {
  //   const qs = new URLSearchParams();
  //   if (teamId) qs.set('team_id', teamId);
  //   if (leagueId) qs.set('league_id', leagueId);
  //   const query = qs.toString();
  //   const response = await fetchAPI(`/injuries-suspensions/statpal${query ? `?${query}` : ''}`);
  //   return response.data || [];
  // },
};

/**
 * Banner API Service
 * NOTE: Banner management has been moved to Firestore.
 * Use bannerService.js instead of bannerAPI for banner operations.
 * This export is kept for backward compatibility but will be removed in the future.
 * 
 * @deprecated Use bannerService.js instead
 */
export const bannerAPI = {
  /**
   * @deprecated Use bannerService.getBanners() instead
   */
  async getBanners(activeOnly = false) {
    console.warn('bannerAPI.getBanners() is deprecated. Use bannerService.getBanners() instead.');
    const { getBanners } = await import('./bannerService');
    return getBanners(activeOnly);
  },

  /**
   * @deprecated Use bannerService.createBanner() instead
   */
  async createBanner(bannerData) {
    console.warn('bannerAPI.createBanner() is deprecated. Use bannerService.createBanner() instead.');
    const { createBanner } = await import('./bannerService');
    return createBanner(bannerData);
  },

  /**
   * @deprecated Use bannerService.updateBanner() instead
   */
  async updateBanner(bannerId, bannerData) {
    console.warn('bannerAPI.updateBanner() is deprecated. Use bannerService.updateBanner() instead.');
    const { updateBanner } = await import('./bannerService');
    return updateBanner(bannerId, bannerData);
  },

  /**
   * @deprecated Use bannerService.deleteBanner() instead
   */
  async deleteBanner(bannerId) {
    console.warn('bannerAPI.deleteBanner() is deprecated. Use bannerService.deleteBanner() instead.');
    const { deleteBanner } = await import('./bannerService');
    return deleteBanner(bannerId);
  },
};

export { ApiError };

