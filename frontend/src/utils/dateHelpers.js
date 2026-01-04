/**
 * Date utility functions
 * Optimized and reusable date helpers
 */

/**
 * Normalize date format for comparison
 * Handles multiple date formats: YYYY-MM-DD, DD.MM.YYYY, YYYY-MM-DD HH:MM:SS
 */
export function normalizeDateForComparison(dateStr) {
  if (!dateStr) return '';
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  
  // Datetime format: "2026-01-03 15:55:00" -> extract date part
  if (/^\d{4}-\d{2}-\d{2}\s/.test(dateStr)) {
    return dateStr.split(' ')[0];
  }
  
  return dateStr;
}

/**
 * Get match date from various fields (date, commenceTime, commence_time, starting_at)
 */
export function getMatchDate(match) {
  if (!match) return '';
  
  if (match.date) {
    return normalizeDateForComparison(match.date);
  }
  if (match.commenceTime) {
    return normalizeDateForComparison(match.commenceTime);
  }
  if (match.commence_time) {
    return normalizeDateForComparison(match.commence_time);
  }
  if (match.starting_at) {
    return normalizeDateForComparison(match.starting_at);
  }
  
  return '';
}

/**
 * Get match datetime string from various fields
 */
export function getMatchDateTime(match) {
  if (!match) return null;
  
  if (match.commence_time) return match.commence_time;
  if (match.commenceTime) return match.commenceTime;
  if (match.starting_at) return match.starting_at;
  if (match.date && match.date.includes(' ')) return match.date;
  
  return null;
}

/**
 * Parse datetime string to Date object (local timezone)
 * Handles: "2026-01-03 15:55:00", "2026-01-03T15:55:00", ISO format
 */
export function parseMatchDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  
  // Format: "2026-01-03 15:55:00" - parse as local time
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
    const [datePart, timePart] = dateTimeStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second || 0);
  }
  
  // Format: "2026-01-03T15:55:00" or ISO format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateTimeStr)) {
    return new Date(dateTimeStr);
  }
  
  // Try to parse as Date
  const parsed = new Date(dateTimeStr);
  return !isNaN(parsed.getTime()) ? parsed : null;
}

/**
 * Check if match status indicates finished
 */
export function isMatchFinished(match) {
  if (!match) return false;
  
  if (match.isFinished === true) return true;
  
  const status = (match.status || '').toUpperCase();
  return ['FT', 'FINISHED', 'CANCELED', 'CANCELLED', 'AET', 'FT_PEN'].includes(status);
}

/**
 * Check if match status indicates live
 */
export function isMatchLive(match) {
  if (!match) return false;
  
  if (match.isLive === true) return true;
  
  const status = (match.status || '').toUpperCase();
  return ['LIVE', 'INPLAY', 'IN_PLAY', '1ST_HALF', '2ND_HALF'].includes(status);
}

/**
 * Check if match status indicates half-time
 */
export function isMatchHalfTime(match) {
  if (!match) return false;
  
  const status = (match.status || '').toUpperCase();
  return ['HT', 'HALF_TIME', 'BREAK'].includes(status);
}

/**
 * Check if match is postponed
 */
export function isMatchPostponed(match) {
  if (!match) return false;
  
  if (match.isPostponed === true) return true;
  
  const status = (match.status || '').toUpperCase();
  return ['POSTPONED', 'POSTP'].includes(status);
}

/**
 * Get today's date in YYYY-MM-DD format (memoized per day)
 */
let cachedToday = null;
let cachedTodayDate = null;

export function getToday() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Cache for the same day
  if (cachedToday === todayStr) {
    return cachedToday;
  }
  
  cachedToday = todayStr;
  cachedTodayDate = now;
  return cachedToday;
}

/**
 * Get date N days from today
 */
export function getDateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

