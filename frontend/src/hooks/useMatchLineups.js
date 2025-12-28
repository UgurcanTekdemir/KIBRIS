import { useState, useEffect } from 'react';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching match lineups
 */
export function useMatchLineups(matchId, shouldFetch = true) {
  const [lineups, setLineups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId || !shouldFetch) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchLineups() {
      try {
        setError(null);
        setLoading(true);
        const lineupsData = await matchAPI.getMatchLineups(matchId);
        
        if (!cancelled) {
          setLineups(lineupsData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          // Don't show error if lineups are simply not available (404)
          if (err.status === 404) {
            setLineups(null);
          } else {
            setError(err.message || 'Kadrolar yüklenirken bir hata oluştu');
          }
          setLoading(false);
        }
      }
    }

    fetchLineups();

    return () => {
      cancelled = true;
    };
  }, [matchId, shouldFetch]);

  return { lineups, loading, error, refetch: () => {
    setLoading(true);
    matchAPI.getMatchLineups(matchId)
      .then(lineupsData => {
        setLineups(lineupsData);
        setLoading(false);
      })
      .catch(err => {
        if (err.status === 404) {
          setLineups(null);
        } else {
          setError(err.message || 'Kadrolar yüklenirken bir hata oluştu');
        }
        setLoading(false);
      });
  }};
}




