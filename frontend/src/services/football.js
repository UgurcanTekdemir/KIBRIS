/**
 * Football Service
 * Handles all Football API calls via Backend Proxy
 * Uses backend API endpoints instead of direct Sportmonks API
 */

import { fetchAPI } from './api';

/**
 * Make a fetch request to Backend API
 * @param {string} endpoint - Backend API endpoint (e.g., '/matches')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function fetchBackendAPI(endpoint, options = {}) {
  try {
    const data = await fetchAPI(endpoint, options);
    // Backend returns { success: true, data: [...] }
    return data.data || data;
  } catch (error) {
    // Re-throw with user-friendly message
    if (error.message.includes('Backend')) {
      throw new Error(`Backend'e bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.`);
    }
    throw error;
  }
}


/**
 * @typedef {Object} SportmonksFixture
 * @property {number} id - Fixture ID
 * @property {number} sport_id - Sport ID
 * @property {number} league_id - League ID
 * @property {number} state_id - State ID (1=NS, 2=NS, 3=LIVE, 5=FT)
 * @property {string} name - Fixture name (e.g., "Team A vs Team B")
 * @property {string} starting_at - Start time (YYYY-MM-DD HH:mm:ss)
 * @property {number} starting_at_timestamp - Unix timestamp
 * @property {boolean} has_odds - Whether fixture has odds
 * @property {Array<SportmonksParticipant>} [participants] - Participants (if included)
 * @property {Object} [leagues] - League data (if included)
 * @property {Array<SportmonksOdds>} [odds] - Odds data (if included)
 * @property {Array<SportmonksMarket>} [markets] - Markets data (if included)
 */

/**
 * @typedef {Object} SportmonksParticipant
 * @property {number} id - Participant ID
 * @property {number} sport_id - Sport ID
 * @property {number} country_id - Country ID
 * @property {string} name - Team name
 * @property {string} [image_path] - Team logo URL
 * @property {Object} [meta] - Metadata (position, type, etc.)
 */

/**
 * @typedef {Object} SportmonksOdds
 * @property {number} id - Odds ID
 * @property {number} fixture_id - Fixture ID
 * @property {number} market_id - Market ID (1 = Match Winner)
 * @property {string} label - Label (e.g., "1", "X", "2")
 * @property {number} value - Odds value
 * @property {number} [selection_id] - Selection ID
 * @property {Object} [market] - Market data (if included)
 * @property {Array<Object>} [values] - Odds values array
 */

/**
 * @typedef {Object} SportmonksMarket
 * @property {number} id - Market ID
 * @property {string} name - Market name
 * @property {string} developer_name - Developer name
 */

/**
 * @typedef {Object} SportmonksLeague
 * @property {number} id - League ID
 * @property {number} sport_id - Sport ID
 * @property {number} country_id - Country ID
 * @property {string} name - League name
 * @property {boolean} active - Whether league is active
 * @property {string} [image_path] - League logo URL
 * @property {Object} [country] - Country data (if included)
 */

/**
 * Get all livescores
 * @returns {Promise<Array>}
 */
export async function getLivescores() {
  return fetchBackendAPI('/matches/live');
}

/**
 * Get inplay livescores (alias for getLivescores)
 * @returns {Promise<Array>}
 */
export async function getLivescoresInplay() {
  return fetchBackendAPI('/matches/live');
}

/**
 * Get matches (upcoming, live, finished)
 * @param {Object} filters - Filter options (date_from, date_to, league_id, category)
 * @returns {Promise<Array>}
 */
export async function getUpcomingFixtures(filters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.date_from) queryParams.append('date_from', filters.date_from);
  if (filters.date_to) queryParams.append('date_to', filters.date_to);
  if (filters.league_id) queryParams.append('league_id', filters.league_id);
  if (filters.category) queryParams.append('category', filters.category);
  
  const queryString = queryParams.toString();
  const endpoint = `/matches${queryString ? `?${queryString}` : ''}`;
  return fetchBackendAPI(endpoint);
}

/**
 * Get upcoming fixtures by market ID (not supported by backend, returns all upcoming)
 * @param {number} marketId - Market ID (ignored, kept for compatibility)
 * @returns {Promise<Array>}
 */
export async function getUpcomingFixturesByMarketId(marketId) {
  return fetchBackendAPI('/matches?category=upcoming');
}

/**
 * Get fixture by ID
 * @param {number} fixtureId - Fixture ID
 * @returns {Promise<Object>}
 */
export async function getFixtureById(fixtureId) {
  return fetchBackendAPI(`/matches/${fixtureId}`);
}

/**
 * Get all leagues
 * @returns {Promise<Array>}
 */
export async function getLeagues() {
  return fetchBackendAPI('/leagues');
}

// Export default object for convenience
export default {
  getLivescores,
  getLivescoresInplay,
  getUpcomingFixtures,
  getUpcomingFixturesByMarketId,
  getFixtureById,
  getLeagues,
};

