/**
 * Live Match Safety Utilities
 * Detects dangerous situations in live matches (goals, dangerous attacks)
 * and determines if betting should be locked
 */

/**
 * Check if there was a goal in the last N seconds
 * @param {Array} events - Match events array
 * @param {number} secondsThreshold - Time threshold in seconds (default: 30)
 * @returns {boolean} True if goal occurred recently
 */
export function hasRecentGoal(events, secondsThreshold = 30) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return false;
  }

  const now = Date.now();
  const thresholdMs = secondsThreshold * 1000;

  // Find most recent goal
  const recentGoal = events
    .filter(event => {
      // Handle nested event type structure (Sportmonks API returns type as object)
      const typeName = (
        event.type?.name ||           // Primary: type.name from nested object
        event.type?.type ||           // Alternative: type.type
        (typeof event.type === 'string' ? event.type : '') ||  // If type is string directly
        event.event_type?.name ||
        event.event_type?.type ||
        (typeof event.event_type === 'string' ? event.event_type : '') ||
        event.name ||
        ''
      ).toLowerCase();
      return typeName.includes('goal') || typeName.includes('gol');
    })
    .sort((a, b) => {
      // Sort by minute/time descending
      const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
      const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
      return bMin - aMin;
    })[0];

  if (!recentGoal) return false;

  // Check if goal happened recently
  // If we have timestamp, use it; otherwise estimate from minute
  if (recentGoal.timestamp) {
    const goalTime = new Date(recentGoal.timestamp).getTime();
    return (now - goalTime) < thresholdMs;
  }

  // Estimate: assume events are recent if they're in the last few minutes
  // This is a fallback - ideally API should provide timestamps
  const goalMinute = parseInt(recentGoal.minute || recentGoal.time || recentGoal.elapsed || 0);
  // If goal minute is very recent (last 1-2 minutes), consider it dangerous
  // This is approximate - we'll rely more on statistics for dangerous attacks
  return goalMinute > 0; // If we have a goal event, it's potentially dangerous
}

/**
 * Check if there are dangerous attacks in recent statistics
 * @param {Object} statistics - Match statistics object
 * @param {number} threshold - Minimum number of dangerous attacks to trigger lock
 * @returns {boolean} True if dangerous attacks detected
 */
export function hasDangerousAttacks(statistics, threshold = 3) {
  if (!statistics) return false;

  let stats = statistics;
  
  // Handle different response structures
  if (Array.isArray(statistics)) {
    stats = statistics;
  } else if (statistics.statistics && Array.isArray(statistics.statistics)) {
    stats = statistics.statistics;
  } else if (statistics.stats && Array.isArray(statistics.stats)) {
    stats = statistics.stats;
  } else if (statistics.data && Array.isArray(statistics.data)) {
    stats = statistics.data;
  }

  if (!Array.isArray(stats)) {
    // Try direct properties
    if (statistics.dangerous_attacks || statistics.dangerousAttacks) {
      const homeAttacks = statistics.dangerous_attacks?.[0] || statistics.dangerousAttacks?.home || 0;
      const awayAttacks = statistics.dangerous_attacks?.[1] || statistics.dangerousAttacks?.away || 0;
      return (homeAttacks + awayAttacks) >= threshold;
    }
    if (statistics.shots_on_target || statistics.shotsOnTarget) {
      const homeShots = statistics.shots_on_target?.[0] || statistics.shotsOnTarget?.home || 0;
      const awayShots = statistics.shots_on_target?.[1] || statistics.shotsOnTarget?.away || 0;
      return (homeShots + awayShots) >= threshold;
    }
    return false;
  }

  // Look for dangerous attacks or shots on target
  const dangerousAttacks = stats.find(s => {
    const type = (s.type || s.name || s.statistic || '').toLowerCase();
    return type.includes('dangerous attack') || 
           type.includes('dangerous_attack') ||
           (type.includes('attack') && type.includes('dangerous'));
  });

  const shotsOnTarget = stats.find(s => {
    const type = (s.type || s.name || s.statistic || '').toLowerCase();
    return type.includes('shots on target') || 
           type.includes('shots on goal') ||
           (type.includes('shots') && (type.includes('target') || type.includes('goal')));
  });

  // Get total dangerous attacks or shots on target
  const getTotalValue = (stat) => {
    if (!stat) return 0;
    const home = stat.home || stat.home_value || stat.homeValue || 0;
    const away = stat.away || stat.away_value || stat.awayValue || 0;
    const value = stat.value;
    if (value && typeof value === 'object') {
      return (value.home || 0) + (value.away || 0);
    }
    return (parseInt(home) || 0) + (parseInt(away) || 0);
  };

  const totalDangerous = getTotalValue(dangerousAttacks);
  const totalShotsOnTarget = getTotalValue(shotsOnTarget);

  // Lock if there are many dangerous attacks or shots on target
  return totalDangerous >= threshold || totalShotsOnTarget >= threshold;
}

/**
 * Check if match is in a critical moment (last 10 minutes, close score)
 * @param {Object} match - Match object
 * @returns {boolean} True if match is in critical moment
 */
export function isCriticalMoment(match) {
  if (!match || !match.isLive) return false;

  const minute = parseInt(match.minute || 0);
  const homeScore = parseInt(match.homeScore || 0);
  const awayScore = parseInt(match.awayScore || 0);
  const scoreDiff = Math.abs(homeScore - awayScore);

  // Critical if:
  // - Last 10 minutes of match
  // - Score is close (difference <= 1 goal)
  return minute >= 80 && scoreDiff <= 1;
}

/**
 * Main function to check if betting should be locked for a live match
 * @param {Object} match - Match object
 * @param {Array} events - Match events array
 * @param {Object} statistics - Match statistics object
 * @returns {Object} { isLocked: boolean, reason: string }
 */
export function shouldLockBetting(match, events, statistics) {
  if (!match || !match.isLive) {
    return { isLocked: false, reason: null };
  }

  // Check for recent goal
  if (hasRecentGoal(events, 30)) {
    return {
      isLocked: true,
      reason: 'Son 30 saniye içinde gol atıldı. Oranlar geçici olarak kilitlendi.'
    };
  }

  // Check for dangerous attacks
  if (hasDangerousAttacks(statistics, 3)) {
    return {
      isLocked: true,
      reason: 'Tehlikeli atak durumu tespit edildi. Oranlar geçici olarak kilitlendi.'
    };
  }

  // Check for critical moment
  if (isCriticalMoment(match)) {
    return {
      isLocked: true,
      reason: 'Maç kritik anında. Oranlar geçici olarak kilitlendi.'
    };
  }

  return { isLocked: false, reason: null };
}

