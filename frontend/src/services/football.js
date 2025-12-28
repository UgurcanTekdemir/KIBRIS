/**
 * Football Service
 * Handles all Sportmonks V3 Football API calls
 * Uses fetch API directly (no Axios)
 */

const BASE_URL = 'https://api.sportmonks.com';
const VERSION = 'v3';
const SPORT = 'football';

/**
 * Get API token from environment variables
 */
const getApiToken = () => {
  const token = process.env.REACT_APP_SPORTMONKS_API_TOKEN;
  if (!token) {
    console.warn('REACT_APP_SPORTMONKS_API_TOKEN is not set in environment variables');
  }
  return token;
};

/**
 * Make a fetch request to Sportmonks API
 * @param {string} endpoint - API endpoint (e.g., '/v3/football/livescores')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function fetchSportmonksAPI(endpoint, options = {}) {
  const token = getApiToken();
  if (!token) {
    throw new Error('Sportmonks API token is not configured');
  }

  const url = `${BASE_URL}${endpoint}`;
  
  // Log API calls only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🌐 Sportmonks API Call:', url);
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token,
      ...options.headers,
    },
  };

  // Add timeout for fetch requests (60 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitLimit = response.headers.get('x-ratelimit-limit');
    
    if (process.env.NODE_ENV === 'development' && rateLimitRemaining) {
      console.log(`📊 Rate Limit: ${rateLimitRemaining}/${rateLimitLimit}`);
    }

    // Check if response is ok before trying to parse JSON
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        console.error('JSON parse error. Response text:', text);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    } else {
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.detail || `API request failed (${response.status})`
      );
    }

    // Sportmonks V3 response structure: { data: [...], pagination: {...}, ... }
    // Return the data array/object directly
    return data.data || data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      throw new Error('İstek zaman aşımına uğradı. Lütfen daha sonra tekrar deneyin.');
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Network error:', error);
      throw new Error(`Sportmonks API'ye bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.`);
    }

    throw error;
  }
}

/**
 * Build query string from parameters
 * @param {Object} params - Query parameters
 * @returns {string} Query string
 */
function buildQueryString(params) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      queryParams.append(key, value);
    }
  });
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
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
 * @param {string} [include='participants;leagues;odds;markets'] - Include parameters
 * @returns {Promise<Array<SportmonksFixture>>}
 */
export async function getLivescores(include = 'participants;leagues;odds;markets') {
  const endpoint = `/${VERSION}/${SPORT}/livescores${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
}

/**
 * Get inplay livescores
 * @param {string} [include='participants;leagues;odds;markets'] - Include parameters
 * @returns {Promise<Array<SportmonksFixture>>}
 */
export async function getLivescoresInplay(include = 'participants;leagues;odds;markets') {
  const endpoint = `/${VERSION}/${SPORT}/livescores/inplay${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
}

/**
 * Get upcoming fixtures
 * @param {string} [include='participants;leagues;odds;markets'] - Include parameters
 * @returns {Promise<Array<SportmonksFixture>>}
 */
export async function getUpcomingFixtures(include = 'participants;leagues;odds;markets') {
  const endpoint = `/${VERSION}/${SPORT}/fixtures/upcoming${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
}

/**
 * Get upcoming fixtures by market ID
 * @param {number} marketId - Market ID (1 = Match Winner)
 * @param {string} [include='participants;leagues;odds;markets'] - Include parameters
 * @returns {Promise<Array<SportmonksFixture>>}
 */
export async function getUpcomingFixturesByMarketId(marketId, include = 'participants;leagues;odds;markets') {
  const endpoint = `/${VERSION}/${SPORT}/fixtures/upcoming/markets/${marketId}${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
}

/**
 * Get fixture by ID
 * @param {number} fixtureId - Fixture ID
 * @param {string} [include='participants;leagues;odds;markets'] - Include parameters
 * @returns {Promise<SportmonksFixture>}
 */
export async function getFixtureById(fixtureId, include = 'participants;leagues;odds;markets') {
  const endpoint = `/${VERSION}/${SPORT}/fixtures/${fixtureId}${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
}

/**
 * Get all leagues
 * @param {string} [include='country'] - Include parameters
 * @returns {Promise<Array<SportmonksLeague>>}
 */
export async function getLeagues(include = 'country') {
  const endpoint = `/${VERSION}/${SPORT}/leagues${buildQueryString({ include })}`;
  return fetchSportmonksAPI(endpoint);
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

