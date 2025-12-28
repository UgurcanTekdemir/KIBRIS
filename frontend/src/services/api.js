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
 * NOTE: This is a placeholder API that uses football service.
 * These methods should be implemented based on your backend API or use football service directly.
 * 
 * @deprecated Consider using football service directly instead
 */
export const matchAPI = {
  async getLeagueStandings(leagueId, season) {
    // TODO: Implement league standings endpoint
    console.warn('matchAPI.getLeagueStandings() is not implemented yet');
    throw new Error('getLeagueStandings is not implemented');
  },

  async getTeamDetails(teamId) {
    // TODO: Implement team details endpoint
    console.warn('matchAPI.getTeamDetails() is not implemented yet');
    throw new Error('getTeamDetails is not implemented');
  },

  async getPlayerDetails(playerId) {
    // TODO: Implement player details endpoint
    console.warn('matchAPI.getPlayerDetails() is not implemented yet');
    throw new Error('getPlayerDetails is not implemented');
  },

  async getMatchLineups(matchId) {
    // TODO: Implement match lineups endpoint
    console.warn('matchAPI.getMatchLineups() is not implemented yet');
    throw new Error('getMatchLineups is not implemented');
  },

  async getInjuriesSuspensions(teamId, leagueId) {
    // TODO: Implement injuries/suspensions endpoint
    console.warn('matchAPI.getInjuriesSuspensions() is not implemented yet');
    throw new Error('getInjuriesSuspensions is not implemented');
  },

  async getHeadToHead(team1Id, team2Id) {
    // TODO: Implement head to head endpoint
    console.warn('matchAPI.getHeadToHead() is not implemented yet');
    throw new Error('getHeadToHead is not implemented');
  },

  async getLiveMatches() {
    // Use football service for live matches
    const { getLivescores } = await import('./football');
    return getLivescores();
  },

  async getLeagueSeasons(leagueId) {
    // TODO: Implement league seasons endpoint
    console.warn('matchAPI.getLeagueSeasons() is not implemented yet');
    throw new Error('getLeagueSeasons is not implemented');
  },

  async getMatchStatistics(matchId) {
    // TODO: Implement match statistics endpoint
    console.warn('matchAPI.getMatchStatistics() is not implemented yet');
    throw new Error('getMatchStatistics is not implemented');
  },

  async getMatchEvents(matchId) {
    // TODO: Implement match events endpoint
    console.warn('matchAPI.getMatchEvents() is not implemented yet');
    throw new Error('getMatchEvents is not implemented');
  },
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

