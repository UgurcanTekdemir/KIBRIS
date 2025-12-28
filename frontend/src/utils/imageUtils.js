/**
 * Image Handling Utilities
 * Handles image paths from API and provides fallback icons
 */

/**
 * Get team image path from participant data
 * @param {Object} participant - Participant object
 * @returns {string|null} Image URL or null
 */
export function getTeamImagePath(participant) {
  if (!participant) return null;
  
  // Check for image_path, logo, or image fields
  if (participant.image_path) return participant.image_path;
  if (participant.logo) return participant.logo;
  if (participant.image) return participant.image;
  
  return null;
}

/**
 * Get league image path from league data
 * @param {Object} league - League object
 * @returns {string|null} Image URL or null
 */
export function getLeagueImagePath(league) {
  if (!league) return null;
  
  // Handle nested data structure (league.data)
  const leagueData = league.data || league;
  
  if (leagueData.image_path) return leagueData.image_path;
  if (leagueData.logo) return leagueData.logo;
  if (leagueData.image) return leagueData.image;
  
  return null;
}

/**
 * Get fallback icon/emoji for a team or entity
 * @param {string} name - Name of the team/entity
 * @returns {string} Emoji or default icon
 */
export function getFallbackIcon(name) {
  if (!name) return '⚽';
  
  // Try to extract first letter
  const firstLetter = name.trim().charAt(0).toUpperCase();
  
  // Return first letter as fallback (can be styled with CSS)
  return firstLetter;
}

/**
 * Get country flag emoji (if available)
 * @param {string} countryName - Country name
 * @returns {string} Flag emoji or empty string
 */
export function getCountryFlag(countryName) {
  if (!countryName) return '';
  
  const countryFlags = {
    'Turkey': '🇹🇷',
    'Türkiye': '🇹🇷',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Spain': '🇪🇸',
    'İspanya': '🇪🇸',
    'Italy': '🇮🇹',
    'İtalya': '🇮🇹',
    'Germany': '🇩🇪',
    'Almanya': '🇩🇪',
    'France': '🇫🇷',
    'Fransa': '🇫🇷',
    'Netherlands': '🇳🇱',
    'Hollanda': '🇳🇱',
    'Portugal': '🇵🇹',
    'Belgium': '🇧🇪',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
  };
  
  return countryFlags[countryName] || '';
}

/**
 * Handle image load error by hiding the image or showing fallback
 * @param {Event} event - Image error event
 * @param {string} fallback - Fallback text/icon
 */
export function handleImageError(event, fallback = '⚽') {
  const img = event.target;
  
  // Hide the image
  img.style.display = 'none';
  
  // If there's a parent container, we can add fallback text
  // This is usually handled by the component itself
}

/**
 * Check if image URL is valid
 * @param {string} url - Image URL
 * @returns {boolean} True if URL appears valid
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's a valid URL format
  try {
    new URL(url);
    return true;
  } catch {
    // If URL parsing fails, check if it's a relative path
    return url.startsWith('/') || url.startsWith('./');
  }
}

