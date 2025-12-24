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

// Debug: Log API URL (always log to help debug production issues)
console.log('🔧 API Configuration:');
console.log('  - REACT_APP_API_URL:', process.env.REACT_APP_API_URL || 'NOT SET');
console.log('  - Raw API URL:', rawApiUrl);
console.log('  - Clean API URL:', cleanApiUrl);
console.log('  - Final API_BASE_URL:', API_BASE_URL);

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
  
  // Debug: Log the full URL being called
  console.log('🌐 API Call:', url);
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
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
    if (error instanceof ApiError) {
      throw error;
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
 */
export const matchAPI = {
  /**
   * Get matches with optional filters
   * @param {Object} filters - { matchType, league, date, country }
   * @returns {Promise<Array>} List of matches
   */
  async getMatches(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.matchType) params.append('match_type', filters.matchType);
    if (filters.league) params.append('league', filters.league);
    if (filters.date) params.append('date', filters.date);
    if (filters.country) params.append('country', filters.country);

    const queryString = params.toString();
    const endpoint = `/matches${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get live matches
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
    const response = await fetchAPI(`/matches/${matchId}`);
    return response.data || null;
  },

  /**
   * Get popular matches
   * @param {number} matchType - Match type
   * @returns {Promise<Array>} List of popular matches
   */
  async getPopularMatches(matchType = 1) {
    const response = await fetchAPI(`/matches/popular?match_type=${matchType}`);
    return response.data || [];
  },

  /**
   * Get available leagues
   * @param {Object} filters - { matchType, country }
   * @returns {Promise<Array>} List of leagues
   */
  async getLeagues(filters = {}) {
    const params = new URLSearchParams();
    if (filters.matchType) params.append('match_type', filters.matchType);
    if (filters.country) params.append('country', filters.country);

    const queryString = params.toString();
    const endpoint = `/leagues${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get available countries
   * @param {number} matchType - Match type
   * @returns {Promise<Array>} List of countries
   */
  async getCountries(matchType = 1) {
    const response = await fetchAPI(`/countries?match_type=${matchType}`);
    return response.data || [];
  },
};

/**
 * StatPal API Service
 */
export const statpalAPI = {
  /**
   * Get matches from StatPal API
   * @param {Object} filters - { date, leagueId, teamId }
   * @returns {Promise<Array>} List of matches
   */
  async getMatches(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.date) params.append('date', filters.date);
    if (filters.leagueId) params.append('league_id', filters.leagueId);
    if (filters.teamId) params.append('team_id', filters.teamId);

    const queryString = params.toString();
    const endpoint = `/matches/statpal${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get live matches from StatPal API
   * @returns {Promise<Array>} List of live matches
   */
  async getLiveMatches() {
    const response = await fetchAPI('/matches/statpal/live');
    return response.data || [];
  },

  /**
   * Get match details by ID from StatPal API
   * @param {string} matchId - Match ID
   * @returns {Promise<Object>} Match details
   */
  async getMatchDetails(matchId) {
    const response = await fetchAPI(`/matches/statpal/${matchId}`);
    return response.data || null;
  },

  /**
   * Get live in-depth match stats from StatPal API
   * @param {string} matchId - Match ID
   * @returns {Promise<Object>} Match statistics
   */
  async getMatchStats(matchId) {
    const response = await fetchAPI(`/matches/statpal/${matchId}/stats`);
    return response.data || null;
  },


  /**
   * Get match results from StatPal API
   * @param {string} date - Date filter (YYYY-MM-DD, optional)
   * @returns {Promise<Array>} List of finished matches
   */
  async getResults(date = null) {
    const params = date ? `?date=${date}` : '';
    const response = await fetchAPI(`/matches/statpal/results${params}`);
    return response.data || [];
  },

  /**
   * Get upcoming schedules from StatPal API
   * @param {number} leagueId - League ID filter (optional)
   * @param {string} date - Date filter (YYYY-MM-DD, optional)
   * @returns {Promise<Array>} List of upcoming matches
   */
  async getUpcomingSchedules(leagueId = null, date = null) {
    const params = new URLSearchParams();
    if (leagueId) params.append('league_id', leagueId);
    if (date) params.append('date', date);
    const queryString = params.toString();
    const endpoint = `/matches/statpal/upcoming${queryString ? `?${queryString}` : ''}`;
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get available leagues from StatPal API
   * @returns {Promise<Array>} List of leagues
   */
  async getLeagues() {
    const response = await fetchAPI('/leagues/statpal');
    return response.data || [];
  },

  /**
   * Get teams from StatPal API
   * @param {Object} filters - { leagueId }
   * @returns {Promise<Array>} List of teams
   */
  async getTeams(filters = {}) {
    const params = new URLSearchParams();
    if (filters.leagueId) params.append('league_id', filters.leagueId);

    const queryString = params.toString();
    const endpoint = `/teams/statpal${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchAPI(endpoint);
    return response.data || [];
  },

  /**
   * Get league standings from StatPal API
   * @param {number} leagueId - League ID
   * @returns {Promise<Array>} League standings
   */
  async getStandings(leagueId) {
    const response = await fetchAPI(`/standings/statpal/${leagueId}`);
    return response.data || [];
  },

  /**
   * Get league top scorers from StatPal API
   * @param {number} leagueId - League ID
   * @returns {Promise<Array>} List of top scorers
   */
  async getTopScorers(leagueId) {
    const response = await fetchAPI(`/leagues/statpal/${leagueId}/top-scorers`);
    return response.data || [];
  },

  /**
   * Get injuries and suspensions from StatPal API
   * @param {number} teamId - Team ID filter (optional)
   * @returns {Promise<Array>} List of injuries/suspensions
   */
  async getInjuries(teamId = null) {
    const params = teamId ? `?team_id=${teamId}` : '';
    const response = await fetchAPI(`/injuries/statpal${params}`);
    return response.data || [];
  },

  /**
   * Get head-to-head statistics from StatPal API
   * @param {number} team1Id - First team ID
   * @param {number} team2Id - Second team ID
   * @returns {Promise<Object>} Head-to-head statistics
   */
  async getHeadToHead(team1Id, team2Id) {
    const response = await fetchAPI(`/teams/statpal/${team1Id}/vs/${team2Id}`);
    return response.data || null;
  },

  /**
   * Get team statistics from StatPal API
   * @param {number} teamId - Team ID
   * @returns {Promise<Object>} Team statistics
   */
  async getTeamStats(teamId) {
    const response = await fetchAPI(`/teams/statpal/${teamId}/stats`);
    return response.data || null;
  },

  /**
   * Get player statistics from StatPal API
   * @param {number} playerId - Player ID
   * @returns {Promise<Object>} Player statistics
   */
  async getPlayerStats(playerId) {
    const response = await fetchAPI(`/players/statpal/${playerId}/stats`);
    return response.data || null;
  },

  /**
   * Get team transfers from StatPal API
   * @param {number} teamId - Team ID
   * @returns {Promise<Array>} List of transfers
   */
  async getTeamTransfers(teamId) {
    const response = await fetchAPI(`/teams/statpal/${teamId}/transfers`);
    return response.data || [];
  },

  /**
   * Get match odds (pre-match or inplay) from StatPal API
   * @param {string} matchId - Match ID
   * @param {boolean} inplay - Get inplay odds if true
   * @returns {Promise<Object>} Odds data
   */
  async getMatchOdds(matchId, inplay = false) {
    const response = await fetchAPI(`/matches/statpal/${matchId}/odds?inplay=${inplay}`);
    return response.data || null;
  },
};

/**
 * Banner API Service
 */
export const bannerAPI = {
  /**
   * Get all banners
   * @param {boolean} activeOnly - Return only active banners
   * @returns {Promise<Array>} List of banners
   */
  async getBanners(activeOnly = false) {
    const response = await fetch(`${API_BASE_URL}/banners${activeOnly ? '?active_only=true' : ''}`);
    if (!response.ok) {
      throw new ApiError(
        `Failed to fetch banners: ${response.statusText}`,
        response.status,
        null
      );
    }
    return await response.json();
  },

  /**
   * Create a new banner
   * @param {Object} bannerData - Banner data
   * @returns {Promise<Object>} Created banner
   */
  async createBanner(bannerData) {
    const response = await fetch(`${API_BASE_URL}/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bannerData),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.detail || data.message || 'Failed to create banner',
        response.status,
        data
      );
    }
    return await response.json();
  },

  /**
   * Update a banner
   * @param {string} bannerId - Banner ID
   * @param {Object} bannerData - Updated banner data
   * @returns {Promise<Object>} Updated banner
   */
  async updateBanner(bannerId, bannerData) {
    const response = await fetch(`${API_BASE_URL}/banners/${bannerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bannerData),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.detail || data.message || 'Failed to update banner',
        response.status,
        data
      );
    }
    return await response.json();
  },

  /**
   * Delete a banner
   * @param {string} bannerId - Banner ID
   * @returns {Promise<Object>} Success message
   */
  async deleteBanner(bannerId) {
    const response = await fetch(`${API_BASE_URL}/banners/${bannerId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.detail || data.message || 'Failed to delete banner',
        response.status,
        data
      );
    }
    return await response.json();
  },
};

export { ApiError };

