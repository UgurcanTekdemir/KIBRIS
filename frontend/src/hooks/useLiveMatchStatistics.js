import { useState, useEffect } from 'react';
import { matchAPI } from '../services/api';

/**
 * Custom hook for fetching and updating live match statistics
 * Auto-refreshes every 30 seconds for live matches
 */
export function useLiveMatchStatistics(matchId, isLive = true, refreshInterval = 30000) {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId || !isLive) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let intervalId = null;

    async function fetchStatistics() {
      try {
        setError(null);
        const statsData = await matchAPI.getMatchStatistics(matchId);
        
        if (!cancelled) {
          setStatistics(statsData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'İstatistikler yüklenirken bir hata oluştu');
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchStatistics();

    // Set up auto-refresh if match is live
    if (isLive) {
      intervalId = setInterval(() => {
        if (!cancelled) {
          fetchStatistics();
        }
      }, refreshInterval);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [matchId, isLive, refreshInterval]);

  return { statistics, loading, error, refetch: () => {
    setLoading(true);
    matchAPI.getMatchStatistics(matchId)
      .then(statsData => {
        setStatistics(statsData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'İstatistikler yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

