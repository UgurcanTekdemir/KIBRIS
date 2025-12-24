/**
 * API Service Layer
 * Handles all API calls to the backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

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
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.detail || data.message || 'API request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Network error',
      0,
      null
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

  /**
   * Get match events (goals, cards, substitutions)
   * @param {string} matchId - Match ID
   * @returns {Promise<Array>} List of match events
   */
  async getMatchEvents(matchId) {
    const response = await fetchAPI(`/matches/${matchId}/events`);
    return response.data || [];
  },

  /**
   * Get match statistics (possession, shots, etc.)
   * @param {string} matchId - Match ID
   * @returns {Promise<Object>} Match statistics
   */
  async getMatchStatistics(matchId) {
    const response = await fetchAPI(`/matches/${matchId}/statistics`);
    return response.data || null;
  },

  /**
   * Get match lineups (starting XI and substitutes)
   * @param {string} matchId - Match ID
   * @returns {Promise<Object>} Match lineups
   */
  async getMatchLineups(matchId) {
    const response = await fetchAPI(`/matches/${matchId}/lineups`);
    return response.data || null;
  },
};

export { ApiError };

