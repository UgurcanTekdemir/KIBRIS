import { useState, useEffect, useMemo } from 'react';
import { matchAPI } from '../services/api';
import { mapApiMatchesToInternal } from '../utils/matchMapper';

/**
 * Custom hook for fetching matches
 */
export function useMatches(filters = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize filters to avoid unnecessary re-renders
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let cancelled = false;

    async function fetchMatches() {
      try {
        setLoading(true);
        setError(null);
        
        const apiMatches = await matchAPI.getMatches(filters);
        
        if (!cancelled) {
          const mappedMatches = mapApiMatchesToInternal(apiMatches);
          setMatches(mappedMatches);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Maçlar yüklenirken bir hata oluştu');
          console.error('Error fetching matches:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatches();

    return () => {
      cancelled = true;
    };
  }, [filtersKey]); // Re-fetch when filters change (filtersKey is memoized from filters)

  return { matches, loading, error, refetch: () => {
    setLoading(true);
    setError(null);
    matchAPI.getMatches(filters)
      .then(apiMatches => {
        const mappedMatches = mapApiMatchesToInternal(apiMatches);
        setMatches(mappedMatches);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Maçlar yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

/**
 * Custom hook for fetching live matches
 */
export function useLiveMatches(matchType = 1) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLiveMatches() {
      try {
        setLoading(true);
        setError(null);
        
        const apiMatches = await matchAPI.getLiveMatches(matchType);
        
        if (!cancelled) {
          const mappedMatches = mapApiMatchesToInternal(apiMatches);
          // Filter only live matches (in case API returns all matches for today)
          const liveMatches = mappedMatches.filter(m => m.isLive);
          setMatches(liveMatches);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Canlı maçlar yüklenirken bir hata oluştu');
          console.error('Error fetching live matches:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLiveMatches();

    // Refresh every 30 seconds for live matches
    const interval = setInterval(() => {
      if (!cancelled) {
        fetchLiveMatches();
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [matchType]);

  return { matches, loading, error, refetch: () => {
    setLoading(true);
    setError(null);
    matchAPI.getLiveMatches(matchType)
      .then(apiMatches => {
        const mappedMatches = mapApiMatchesToInternal(apiMatches);
        const liveMatches = mappedMatches.filter(m => m.isLive);
        setMatches(liveMatches);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Canlı maçlar yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

/**
 * Custom hook for fetching a single match by ID
 */
export function useMatchDetails(matchId) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMatchDetails() {
      try {
        setLoading(true);
        setError(null);
        
        // Use StatPal API for match details
        const { statpalAPI } = await import('../services/api');
        const { mapStatPalMatchToInternal } = await import('../utils/matchMapper');
        
        const apiMatch = await statpalAPI.getMatchDetails(matchId);
        
        if (!cancelled) {
          if (apiMatch) {
            // Map StatPal match to internal format, but keep original data for events
            const mappedMatch = mapStatPalMatchToInternal(apiMatch);
            // Preserve original StatPal data for events and other details
            mappedMatch.originalData = apiMatch;
            setMatch(mappedMatch);
          } else {
            setError('Maç bulunamadı');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Maç detayları yüklenirken bir hata oluştu');
          console.error('Error fetching match details:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatchDetails();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  return { match, loading, error };
}

