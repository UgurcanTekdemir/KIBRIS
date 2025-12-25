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

