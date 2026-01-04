import { useState, useEffect } from 'react';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching and updating live match events
 * Auto-refreshes every 10-15 seconds for live matches
 */
export function useLiveMatchEvents(matchId, shouldFetch = true, refreshInterval = 12000) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId || !shouldFetch) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let intervalId = null;

    async function fetchEvents() {
      try {
        setError(null);
        const eventsData = await matchAPI.getMatchEvents(matchId);
        
        if (!cancelled) {
          setEvents(eventsData || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Olaylar yüklenirken bir hata oluştu');
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchEvents();

    // Set up auto-refresh if match is live or in half-time
    if (shouldFetch) {
      intervalId = setInterval(() => {
        if (!cancelled) {
          fetchEvents();
        }
      }, refreshInterval);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [matchId, shouldFetch, refreshInterval]);

  return { events, loading, error, refetch: () => {
    setLoading(true);
    matchAPI.getMatchEvents(matchId)
      .then(eventsData => {
        setEvents(eventsData || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Olaylar yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

