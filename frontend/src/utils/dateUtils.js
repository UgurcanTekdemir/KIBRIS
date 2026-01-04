/**
 * Date/Time utility functions for Firestore timestamps
 */

/**
 * Format Firestore timestamp to date string
 */
export const formatFirestoreDate = (timestamp) => {
  if (!timestamp) return '-';
  
  // If it's a Firestore Timestamp object, convert to Date
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('tr-TR');
  }
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString('tr-TR');
  }
  
  // If it's a timestamp object with seconds/nanoseconds
  if (timestamp.seconds) {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('tr-TR');
  }
  
  // If it's a string, try to parse it
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp).toLocaleDateString('tr-TR');
    } catch (e) {
      return '-';
    }
  }
  
  return '-';
};

/**
 * Format Firestore timestamp to datetime string
 */
export const formatFirestoreDateTime = (timestamp) => {
  if (!timestamp) return '-';
  
  // If it's a Firestore Timestamp object, convert to Date
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString('tr-TR');
  }
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString('tr-TR');
  }
  
  // If it's a timestamp object with seconds/nanoseconds
  if (timestamp.seconds) {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('tr-TR');
  }
  
  // If it's a string, try to parse it
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp).toLocaleString('tr-TR');
    } catch (e) {
      return '-';
    }
  }
  
  return '-';
};

/**
 * Convert time string to Turkey timezone (UTC+3)
 * If time is already in Turkey timezone, return as is
 * @param {string} timeStr - Time string in format HH:mm or HH:mm:ss
 * @returns {string} Time string in Turkey timezone
 */
function convertTimeToTurkey(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr;
  
  // If time is already in HH:mm format, assume it's already in Turkey timezone
  // (backend sends time in Turkey timezone after our fix)
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    // Backend already sends time in Turkey timezone, so return as is
    return timeStr;
  }
  
  return timeStr;
}

/**
 * Format match date and time for display
 * - Normalizes date format (YYYY-MM-DD → DD.MM.YYYY)
 * - Handles time in Turkey timezone (backend sends in UTC+3)
 * - Returns formatted string: "DD.MM.YYYY HH:mm"
 * 
 * @param {string} date - Date string in format YYYY-MM-DD or DD.MM.YYYY
 * @param {string} time - Time string in format HH:mm or HH:mm:ss
 * @returns {string} Formatted date and time string
 */
export function formatMatchDateTime(date, time) {
  // Handle empty inputs
  if (!date && !time) return '';
  if (!date) {
    return time ? convertTimeToTurkey(time) : '';
  }
  
  if (typeof date !== 'string') {
    return time ? convertTimeToTurkey(time) : '';
  }
  
  let formattedDate = date;
  
  // Check if date is already in DD.MM.YYYY format (from matchMapper)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
    // Date is already in correct format
    if (time && typeof time === 'string') {
      return `${date} ${convertTimeToTurkey(time)}`;
    }
    return date;
  }
  
  // Check if date is in YYYY-MM-DD format (legacy or from backend)
  if (date.includes('-') && date.match(/^\d{4}-\d{2}-\d{2}/)) {
    // Convert YYYY-MM-DD to DD.MM.YYYY
    const parts = date.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        formattedDate = `${day}.${month}.${year}`;
      }
    }
  }
  
  // If parsing failed, use original date
  if (time && typeof time === 'string') {
    return `${formattedDate} ${convertTimeToTurkey(time)}`;
  }
  
  return formattedDate;
}








