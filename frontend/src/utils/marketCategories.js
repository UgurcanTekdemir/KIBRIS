/**
 * Market Category Classifier
 * Categorizes betting markets into groups for better organization
 */

/**
 * Get category for a market based on its name
 * @param {string} marketName - Name of the market
 * @returns {string} Category name
 */
export function getMarketCategory(marketName) {
  if (!marketName) return 'Diğer';

  const name = marketName.toLowerCase();

  // Ana Sonuç - Match Result
  if (
    name.includes('maç sonucu') ||
    name.includes('match result') ||
    name.includes('1x2') ||
    name.includes('1-x-2') ||
    name === '1' ||
    name === 'x' ||
    name === '2'
  ) {
    return 'Ana Sonuç';
  }

  // Goller - Goals
  if (
    name.includes('gol') ||
    name.includes('goal') ||
    name.includes('toplam gol') ||
    name.includes('total goal') ||
    name.includes('alt') ||
    name.includes('üst') ||
    name.includes('over') ||
    name.includes('under') ||
    name.includes('2.5') ||
    name.includes('1.5') ||
    name.includes('3.5') ||
    name.includes('4.5')
  ) {
    return 'Goller';
  }

  // Kornerler - Corners
  if (
    name.includes('korner') ||
    name.includes('corner') ||
    name.includes('köşe')
  ) {
    return 'Kornerler';
  }

  // Yarı Sonuçları - Half Results
  if (
    name.includes('yarı') ||
    name.includes('half') ||
    name.includes('ilk yarı') ||
    name.includes('second half') ||
    name.includes('ikinci yarı') ||
    name.includes('1. yarı') ||
    name.includes('2. yarı')
  ) {
    return 'Yarı Sonuçları';
  }

  // Oyuncu Golleri - Player Goals (more specific category)
  if (
    name.includes('oyuncu gol') ||
    name.includes('player goal') ||
    name.includes('goalscorer') ||
    name.includes('ilk golü atan') ||
    name.includes('first goalscorer') ||
    name.includes('anytime goalscorer') ||
    name.includes('son golü atan') ||
    name.includes('last goalscorer') ||
    name.includes('oyuncu asist') ||
    name.includes('player assist') ||
    (name.includes('oyuncu') && (name.includes('gol') || name.includes('goal') || name.includes('scorer'))) ||
    (name.includes('player') && (name.includes('goal') || name.includes('scorer')))
  ) {
    return 'Oyuncu Golleri';
  }

  // Gol Bahisleri - Goal Markets
  if (
    name.includes('ilk gol') ||
    name.includes('first goal') ||
    name.includes('son gol') ||
    name.includes('last goal') ||
    name.includes('golcü') ||
    name.includes('scorer')
  ) {
    return 'Gol Bahisleri';
  }

  // Kartlar - Cards
  if (
    name.includes('kart') ||
    name.includes('card') ||
    name.includes('sarı kart') ||
    name.includes('kırmızı kart') ||
    name.includes('yellow') ||
    name.includes('red') ||
    name.includes('total cards') ||
    name.includes('team cards') ||
    name.includes('player cards') ||
    name.includes('bookings') ||
    name.includes('booking') ||
    name.includes('sendings off') ||
    name.includes('dismissal')
  ) {
    return 'Kartlar';
  }

  // Asya Handikap
  if (
    name.includes('handikap') ||
    name.includes('handicap') ||
    name.includes('asya')
  ) {
    return 'Handikap';
  }

  // Çift Şans - Double Chance
  if (
    name.includes('çift şans') ||
    name.includes('double chance') ||
    name.includes('1x') ||
    name.includes('12') ||
    name.includes('x2')
  ) {
    return 'Çift Şans';
  }

  // İstatistikler - Statistics
  if (
    name.includes('istatistik') ||
    name.includes('statistic') ||
    name.includes('şut') ||
    name.includes('shot') ||
    name.includes('ofsayt') ||
    name.includes('offside')
  ) {
    return 'İstatistikler';
  }

  return 'Diğer';
}

/**
 * Group markets by category
 * @param {Array} markets - Array of market objects
 * @returns {Object} Object with categories as keys and markets arrays as values
 */
export function groupMarketsByCategory(markets) {
  if (!markets || !Array.isArray(markets)) return {};

  const grouped = {};

  markets.forEach((market) => {
    const category = getMarketCategory(market.name);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(market);
  });

  return grouped;
}

/**
 * Get category order for display
 * @returns {Array} Array of category names in display order
 */
export function getCategoryOrder() {
  return [
    'Ana Sonuç',
    'Goller',
    'Handikap',
    'Çift Şans',
    'Yarı Sonuçları',
    'Gol Bahisleri',
    'Oyuncu Golleri',
    'Kornerler',
    'Kartlar',
    'İstatistikler',
    'Diğer',
  ];
}

