/**
 * Live Match Safety Utilities
 * Detects dangerous situations in live matches (goals, dangerous attacks)
 * and determines if betting should be locked
 */

// Store previous events count and last check time to detect new goals
let previousGoalCounts = new Map(); // Map<matchId, goalCount>
let lastCheckTime = new Map(); // Map<matchId, timestamp>

/**
 * Check if there was a goal in the last N seconds
 * @param {Array} events - Match events array
 * @param {number} secondsThreshold - Time threshold in seconds (default: 30)
 * @param {number|string} currentMinute - Current match minute
 * @param {string|number} matchId - Match ID for tracking
 * @returns {boolean} True if goal occurred recently
 */
export function hasRecentGoal(events, secondsThreshold = 30, currentMinute = null, matchId = null) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return false;
  }

  const now = Date.now();
  const thresholdMs = secondsThreshold * 1000;

  // Find all goals
  const goals = events
    .filter(event => {
      // Event type can be nested: event.type.name or direct: event.type
      const type = (
        event.type?.name || 
        event.type?.type ||
        (typeof event.type === 'string' ? event.type : '') ||
        event.event_type?.name ||
        event.event_type?.type ||
        (typeof event.event_type === 'string' ? event.event_type : '') ||
        ''
      ).toLowerCase();
      return type.includes('goal') || type.includes('gol');
    })
    .sort((a, b) => {
      // Sort by minute/time descending
      const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
      const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
      return bMin - aMin;
    });

  if (goals.length === 0) {
    // No goals, clear tracking
    if (matchId) {
      previousGoalCounts.set(matchId, 0);
    }
    return false;
  }

  const recentGoal = goals[0];

  // Check if goal happened recently using timestamp (most accurate)
  if (recentGoal.timestamp) {
    const goalTime = new Date(recentGoal.timestamp).getTime();
    const timeDiff = now - goalTime;
    return timeDiff < thresholdMs;
  }

  // If we have matchId, track goal count to detect new goals
  // This works because events are refreshed every 12 seconds
  // If goal count increased, it's a new goal (likely within last 12 seconds)
  if (matchId) {
    const currentGoalCount = goals.length;
    const previousGoalCount = previousGoalCounts.get(matchId) || 0;
    const lastCheck = lastCheckTime.get(matchId);
    const timeSinceLastCheck = lastCheck ? now - lastCheck : null;
    
    // If goal count increased, it's a new goal
    if (currentGoalCount > previousGoalCount) {
      // Only consider it recent if we've checked before (not first load)
      // and it's been less than 30 seconds since last check
      if (lastCheck && timeSinceLastCheck && timeSinceLastCheck < thresholdMs) {
        // Update tracking
        previousGoalCounts.set(matchId, currentGoalCount);
        lastCheckTime.set(matchId, now);
        // Events refresh every 12 seconds, so new goal is likely within last 12 seconds
        // This is within our 30 second threshold
        return true;
      } else if (!lastCheck) {
        // First time checking - initialize tracking but don't lock
        previousGoalCounts.set(matchId, currentGoalCount);
        lastCheckTime.set(matchId, now);
        return false;
      }
    }
    
    // Update tracking even if no new goal
    previousGoalCounts.set(matchId, currentGoalCount);
    lastCheckTime.set(matchId, now);
  }

  // If we have current minute, compare with goal minute
  // Without timestamp or matchId tracking, we can only approximate
  if (currentMinute !== null && currentMinute !== undefined) {
  const goalMinute = parseInt(recentGoal.minute || recentGoal.time || recentGoal.elapsed || 0);
    const currentMin = parseInt(currentMinute);
    
    if (isNaN(goalMinute) || isNaN(currentMin)) {
      return false;
    }
    
    const minuteDiff = currentMin - goalMinute;
    
    // Without exact timestamps, we cannot accurately determine if goal was within 30 seconds
    // A goal in the same minute could have been at minute 14:00 or minute 14:59
    // We need to be conservative to avoid false positives
    
    // Don't lock based on minute alone - it's too inaccurate
    return false;
  }

  // No timestamp, no matchId tracking, and no current minute available
  return false;
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
    // Handle nested objects (e.g., s.type.name) and ensure we get a string
    const typeValue = (
      (typeof s.type === 'string' ? s.type : s.type?.name || s.type?.type || '') ||
      (typeof s.name === 'string' ? s.name : s.name?.name || '') ||
      (typeof s.statistic === 'string' ? s.statistic : s.statistic?.name || '') ||
      ''
    );
    const type = String(typeValue).toLowerCase();
    return type.includes('dangerous attack') || 
           type.includes('dangerous_attack') ||
           (type.includes('attack') && type.includes('dangerous'));
  });

  const shotsOnTarget = stats.find(s => {
    // Handle nested objects (e.g., s.type.name) and ensure we get a string
    const typeValue = (
      (typeof s.type === 'string' ? s.type : s.type?.name || s.type?.type || '') ||
      (typeof s.name === 'string' ? s.name : s.name?.name || '') ||
      (typeof s.statistic === 'string' ? s.statistic : s.statistic?.name || '') ||
      ''
    );
    const type = String(typeValue).toLowerCase();
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
 * Check if there are dangerous events in recent match events (last 30 seconds)
 * Professional betting sites lock odds when:
 * - Corner kicks occur
 * - Free kicks in dangerous areas
 * - Penalties
 * - Shots on target
 * - Dangerous attacks (detected via events)
 * @param {Array} events - Match events array
 * @param {number} secondsThreshold - Time threshold in seconds (default: 30)
 * @param {number|string} currentMinute - Current match minute
 * @param {string|number} matchId - Match ID for tracking
 * @returns {boolean} True if dangerous event occurred recently
 */
export function hasRecentDangerousEvent(events, secondsThreshold = 30, currentMinute = null, matchId = null) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return false;
  }

  const now = Date.now();
  const thresholdMs = secondsThreshold * 1000;

  // Find dangerous events (corners, free kicks, penalties, shots on target, dangerous attacks)
  const dangerousEvents = events
    .filter(event => {
      // Event type can be nested: event.type.name or direct: event.type
      const type = (
        event.type?.name || 
        event.type?.type ||
        (typeof event.type === 'string' ? event.type : '') ||
        event.event_type?.name ||
        event.event_type?.type ||
        (typeof event.event_type === 'string' ? event.event_type : '') ||
        ''
      ).toLowerCase();

      // Check for dangerous events
      return type.includes('corner') ||
             type.includes('korner') ||
             type.includes('free kick') ||
             type.includes('serbest vuruş') ||
             type.includes('penalty') ||
             type.includes('penaltı') ||
             type.includes('shot on target') ||
             type.includes('shot on goal') ||
             type.includes('dangerous attack') ||
             type.includes('tehlikeli atak') ||
             type.includes('big chance') ||
             type.includes('büyük şans') ||
             type.includes('attack') && (type.includes('dangerous') || type.includes('tehlikeli'));
    })
    .sort((a, b) => {
      // Sort by minute/time descending
      const aMin = parseInt(a.minute || a.time || a.elapsed || 0);
      const bMin = parseInt(b.minute || b.time || b.elapsed || 0);
      return bMin - aMin;
    });

  if (dangerousEvents.length === 0) {
    return false;
  }

  const recentEvent = dangerousEvents[0];

  // Check if event happened recently using timestamp (most accurate)
  if (recentEvent.timestamp) {
    const eventTime = new Date(recentEvent.timestamp).getTime();
    const timeDiff = now - eventTime;
    return timeDiff < thresholdMs;
  }

  // If we have matchId, track event count to detect new events
  if (matchId) {
    const currentEventCount = dangerousEvents.length;
    const previousEventCount = previousGoalCounts.get(`dangerous_${matchId}`) || 0;
    const lastCheck = lastCheckTime.get(`dangerous_${matchId}`);
    const timeSinceLastCheck = lastCheck ? now - lastCheck : null;
    
    // If event count increased, it's a new event
    if (currentEventCount > previousEventCount) {
      // Only consider it recent if we've checked before (not first load)
      // and it's been less than 30 seconds since last check
      if (lastCheck && timeSinceLastCheck && timeSinceLastCheck < thresholdMs) {
        // Update tracking
        previousGoalCounts.set(`dangerous_${matchId}`, currentEventCount);
        lastCheckTime.set(`dangerous_${matchId}`, now);
        return true;
      } else if (!lastCheck) {
        // First time checking - initialize tracking but don't lock
        previousGoalCounts.set(`dangerous_${matchId}`, currentEventCount);
        lastCheckTime.set(`dangerous_${matchId}`, now);
        return false;
      }
    }
    
    // Update tracking even if no new event
    previousGoalCounts.set(`dangerous_${matchId}`, currentEventCount);
    lastCheckTime.set(`dangerous_${matchId}`, now);
  }

  // Without timestamp or matchId tracking, we cannot accurately determine if event was within 30 seconds
  return false;
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
 * Professional betting sites lock odds when:
 * 1. Goal scored in last 30 seconds
 * 2. Dangerous event in last 30 seconds (corner, free kick, penalty, shot on target, dangerous attack)
 * 3. Ongoing dangerous attacks (accumulated statistics)
 * 4. Critical moment (last 10 minutes, close score)
 * @param {Object} match - Match object
 * @param {Array} events - Match events array
 * @param {Object} statistics - Match statistics object
 * @returns {Object} { isLocked: boolean, reason: string }
 */
export function shouldLockBetting(match, events, statistics) {
  if (!match || !match.isLive) {
    return { isLocked: false, reason: null };
  }

  const currentMinute = match.minute || null;
  const matchId = match.id || match.sportmonksId || null;

  // Check for recent goal - highest priority (lock for 30 seconds)
  if (hasRecentGoal(events, 30, currentMinute, matchId)) {
    return {
      isLocked: true,
      reason: 'Son 30 saniye içinde gol atıldı. Oranlar geçici olarak kilitlendi.'
    };
  }

  // Check for recent dangerous event (corner, free kick, penalty, shot on target, dangerous attack)
  // This mimics professional betting sites behavior
  if (hasRecentDangerousEvent(events, 30, currentMinute, matchId)) {
    return {
      isLocked: true,
      reason: 'Tehlikeli pozisyon oluştu. Oranlar geçici olarak kilitlendi.'
    };
  }

  // Check for ongoing dangerous attacks (accumulated statistics)
  // Lock if there are 2 or more dangerous attacks/shots on target in recent period
  if (hasDangerousAttacks(statistics, 2)) {
    return {
      isLocked: true,
      reason: 'Tehlikeli atak durumu tespit edildi. Oranlar geçici olarak kilitlendi.'
    };
  }

  // Check for critical moment (last 10 minutes, close score)
  if (isCriticalMoment(match)) {
    return {
      isLocked: true,
      reason: 'Maç kritik anında. Oranlar geçici olarak kilitlendi.'
    };
  }

  return { isLocked: false, reason: null };
}

