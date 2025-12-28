/**
 * Sportmonks V3 API Type Definitions
 * JSDoc type definitions for Sportmonks V3 JSON schema
 */

/**
 * @typedef {Object} SportmonksParticipant
 * @property {number} id - Participant ID
 * @property {string} name - Team/participant name
 * @property {string|null} image_path - Team logo URL
 * @property {Object} meta - Metadata object
 * @property {string} meta.location - Location: "home" or "away"
 */

/**
 * @typedef {Object} SportmonksScore
 * @property {number} participant_id - ID of the participant this score belongs to
 * @property {number} score - Score value
 * @property {string} description - Score description (e.g., "FT", "HT")
 */

/**
 * @typedef {Object} SportmonksTime
 * @property {string} status - Match status (e.g., "LIVE", "FT", "HT", "POSTP")
 * @property {number|null} minute - Current minute of the match
 * @property {number|null} second - Current second of the match
 * @property {string|null} added_time - Added time
 * @property {string|null} extra_minute - Extra time minute
 * @property {string|null} injury_time - Injury time
 */

/**
 * @typedef {Object} SportmonksEvent
 * @property {number} id - Event ID
 * @property {number} participant_id - ID of the participant (team)
 * @property {number} period_id - Period ID (1=1st half, 2=2nd half, etc.)
 * @property {number} type_id - Event type ID
 * @property {string} section - Section of the event
 * @property {number} minute - Minute when event occurred
 * @property {number|null} second - Second when event occurred
 * @property {number|null} player_id - Player ID (if applicable)
 * @property {string|null} player_name - Player name (if applicable)
 * @property {string} result - Event result
 */

/**
 * @typedef {Object} SportmonksStatistic
 * @property {number} participant_id - ID of the participant (team)
 * @property {number} period_id - Period ID
 * @property {number} type_id - Statistic type ID
 * @property {string} value - Statistic value (can be number as string)
 * @property {Object} type - Statistic type object
 * @property {string} type.name - Statistic name (e.g., "Shots on Goal", "Possession")
 */

/**
 * @typedef {Object} SportmonksLineup
 * @property {number} participant_id - ID of the participant (team)
 * @property {Array<Object>} formations - Formation data
 * @property {Array<Object>} players - Players in the lineup
 */

/**
 * @typedef {Object} SportmonksOdd
 * @property {number} id - Odd ID
 * @property {number} fixture_id - Fixture ID
 * @property {number} market_id - Market ID
 * @property {Object} market - Market object
 * @property {string} market.name - Market name (e.g., "1x2", "Both Teams to Score")
 * @property {Array<Object>} values - Odd values/options
 */

/**
 * @typedef {Object} SportmonksLeague
 * @property {number} id - League ID
 * @property {string} name - League name
 * @property {string|null} image_path - League logo URL
 * @property {Object} country - Country object
 * @property {string} country.name - Country name
 */

/**
 * @typedef {Object} SportmonksVenue
 * @property {number} id - Venue ID
 * @property {string} name - Venue name
 * @property {string|null} city - City name
 * @property {number|null} capacity - Venue capacity
 */

/**
 * @typedef {Object} SportmonksFixture
 * @property {number} id - Fixture ID
 * @property {string} starting_at - Match start time (ISO 8601)
 * @property {SportmonksTime} time - Time/status information
 * @property {Array<SportmonksParticipant>|Object} participants - Participants (teams)
 * @property {Array<SportmonksScore>|Object} scores - Scores array
 * @property {Array<SportmonksEvent>|Object} events - Events array
 * @property {Array<SportmonksStatistic>|Object} statistics - Statistics array
 * @property {Array<SportmonksLineup>|Object} lineups - Lineups array
 * @property {Array<SportmonksOdd>|Object} odds - Odds array
 * @property {SportmonksLeague|Object} league - League information
 * @property {SportmonksVenue|Object} venue - Venue information
 * @property {Object} season - Season information
 */

/**
 * @typedef {Object} SportmonksLivescore
 * @property {number} id - Fixture ID
 * @property {string} starting_at - Match start time (ISO 8601)
 * @property {SportmonksTime} time - Time/status information
 * @property {Array<SportmonksParticipant>|Object} participants - Participants (teams)
 * @property {Array<SportmonksScore>|Object} scores - Scores array
 * @property {Array<SportmonksEvent>|Object} events - Events array
 * @property {SportmonksLeague|Object} league - League information
 */

/**
 * @typedef {Object} SportmonksApiResponse
 * @property {Object|Array} data - Response data (can be object or array)
 * @property {Object} rate_limit - Rate limit information
 * @property {number} rate_limit.remaining - Remaining API calls
 * @property {number} rate_limit.resets_at - Timestamp when rate limit resets
 */

export {};

